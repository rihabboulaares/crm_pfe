import logging
import random
import re
import time
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from .social.session_manager import (
    ensure_linkedin_session,
    get_profile_dir,
    get_social_profile_dir,
    linkedin_login_required_response,
)
from .social.manual_login import (
    facebook_login_required,
    instagram_login_required,
    wait_manual_login,
)

logger = logging.getLogger("agentEngagement.scraper")


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def human_delay(min_ms=800, max_ms=2000):
    time.sleep(random.uniform(min_ms / 1000, max_ms / 1000))


def is_valid_social_profile_data(data):
    if not data:
        return False

    if data.get("username"):
        return True

    if data.get("full_name"):
        return True

    if data.get("bio"):
        return True

    if data.get("header"):
        return True

    if data.get("main_text"):
        return True

    preview = data.get("page_text_preview") or ""
    if len(preview.strip()) > 80:
        return True

    posts = data.get("recent_posts") or data.get("posts") or []
    if isinstance(posts, list) and len(posts) > 0:
        return True

    if data.get("followers") or data.get("posts_count"):
        return True

    return False


class EngagementScraper:
    def scrape_prospect_profiles(self, prospect, user_id: int = None) -> dict:
        result = {
            "linkedin": {},
            "facebook": {},
            "instagram": {},
            "website": {},
        }

        if prospect.linkedin_url:
            linkedin_result = self.scrape_linkedin(prospect.linkedin_url, user_id)
            if linkedin_result.get("success") is False or linkedin_result.get("error"):
                result["linkedin"] = {
                    "success": False,
                    "platform": "linkedin",
                    "status": linkedin_result.get("status"),
                    "error": linkedin_result.get("error")
                    or linkedin_result.get("message")
                    or "linkedin_scrape_failed",
                }
                logger.warning("[scraper] LinkedIn failed but workflow continues")
            else:
                result["linkedin"] = linkedin_result.get("data", linkedin_result)
                logger.info("[scraper] LinkedIn scraped for Prospect #%s", prospect.pk)

        if prospect.facebook_url:
            logger.info("[scraper] Facebook scraping started")
            facebook_result = self.scrape_facebook(prospect.facebook_url, user_id)
            if not facebook_result.get("success", True):
                result["facebook"] = {
                    "success": False,
                    "error": facebook_result.get("error")
                    or facebook_result.get("message")
                    or facebook_result.get("status"),
                    "status": facebook_result.get("status"),
                    "platform": "facebook",
                }
                logger.warning("[scraper] Facebook failed but workflow continues")
            else:
                result["facebook"] = facebook_result.get("data", facebook_result)
                logger.info("[scraper] Facebook scraped with partial data")

        if prospect.instagram_url:
            logger.info("[scraper] Instagram scraping started")
            instagram_result = self.scrape_instagram(prospect.instagram_url, user_id)
            if not instagram_result.get("success", True):
                result["instagram"] = {
                    "success": False,
                    "error": instagram_result.get("error")
                    or instagram_result.get("message")
                    or instagram_result.get("status"),
                    "status": instagram_result.get("status"),
                    "platform": "instagram",
                }
                logger.warning("[scraper] Instagram failed but workflow continues")
            else:
                result["instagram"] = instagram_result.get("data", instagram_result)
                logger.info("[scraper] Instagram scraped with partial data")

        if prospect.website:
            result["website"] = self.scrape_website(prospect.website)
            logger.info("[scraper] Website scraped for Prospect #%s", prospect.pk)

        return result
    # =====================
    # LINKEDIN
    # =====================

    def scrape_linkedin(self, url: str, user_id: int = None) -> dict:
        if not user_id:
            return {"error": "missing_user_id", "platform": "linkedin", "url": url}

        if not ensure_linkedin_session(user_id):
            return {
                **linkedin_login_required_response(),
                "error": "linkedin_login_required",
                "platform": "linkedin",
                "url": url,
            }

        profile_dir = get_profile_dir("linkedin", user_id)

        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(profile_dir),
                headless=False,
                slow_mo=300,
                viewport={"width": 1400, "height": 900},
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--start-maximized",
                ],
            )

            page = context.new_page()

            try:
                page.goto("https://www.linkedin.com/feed/", wait_until="domcontentloaded", timeout=90000)
                page.wait_for_timeout(5000)

                if self._linkedin_login_required(page):
                    return {
                        "error": "linkedin_login_required",
                        "status": "linkedin_login_required",
                        "success": False,
                        "platform": "linkedin",
                        "message": "Veuillez vous connecter à LinkedIn dans la fenêtre ouverte puis relancer l’action.",
                        "url": url,
                    }

                page.goto(url, wait_until="domcontentloaded", timeout=90000)
                page.wait_for_timeout(7000)

                body = self._safe_body_text(page)

                if self._linkedin_login_text(body):
                    return {
                        "error": "linkedin_login_required",
                        "status": "linkedin_login_required",
                        "success": False,
                        "platform": "linkedin",
                        "message": "Veuillez vous connecter à LinkedIn dans la fenêtre ouverte puis relancer l’action.",
                        "url": url,
                    }

                data = {
                    "url": url,
                    "page_text_preview": body[:2500],
                }

                try:
                    name = page.locator("h1").first
                    if name.is_visible(timeout=3000):
                        data["name"] = name.inner_text().strip()
                except Exception:
                    pass

                try:
                    headline = page.locator("div.text-body-medium").first
                    if headline.is_visible(timeout=3000):
                        data["headline"] = headline.inner_text().strip()
                except Exception:
                    pass

                try:
                    location = page.locator("span.text-body-small.inline").first
                    if location.is_visible(timeout=3000):
                        data["location"] = location.inner_text().strip()
                except Exception:
                    pass

                try:
                    about = page.locator("section:has-text('A propos'), section:has-text('À propos'), section:has-text('About')").first
                    if about.is_visible(timeout=2000):
                        data["about"] = about.inner_text(timeout=3000).strip()[:3000]
                except Exception:
                    pass

                try:
                    experience = page.locator("section:has-text('Experience'), section:has-text('Expérience'), section:has-text('Experience')").first
                    if experience.is_visible(timeout=2000):
                        data["experience"] = experience.inner_text(timeout=3000).strip()[:4000]
                except Exception:
                    pass

                try:
                    education = page.locator("section:has-text('Formation'), section:has-text('Education')").first
                    if education.is_visible(timeout=2000):
                        data["education"] = education.inner_text(timeout=3000).strip()[:3000]
                except Exception:
                    pass

                data["recent_posts"] = self._extract_linkedin_posts(page)
                data["posts"] = data["recent_posts"]

                return data

            except Exception as exc:
                return {"error": str(exc), "platform": "linkedin", "url": url}

            finally:
                context.close()

    def _linkedin_login_required(self, page) -> bool:
        url = page.url.lower()
        body = self._safe_body_text(page).lower()

        return (
            "login" in url
            or "checkpoint" in url
            or "join linkedin" in body
            or "agree & join" in body
            or "already on linkedin" in body
        )

    def _linkedin_login_text(self, body: str) -> bool:
        body = (body or "").lower()
        return (
            "join linkedin" in body
            or "agree & join" in body
            or "password (6+ characters)" in body
            or "already on linkedin" in body
        )

    def _extract_linkedin_posts(self, page) -> list:
        posts = []

        try:
            page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
            page.wait_for_timeout(2500)

            candidates = page.locator(
                "div.feed-shared-update-v2, "
                "div.update-components-text, "
                "span.break-words"
            )

            count = min(candidates.count(), 15)

            for i in range(count):
                try:
                    text = candidates.nth(i).inner_text(timeout=1200).strip()
                    if len(text) > 40 and text not in [post.get("text") for post in posts]:
                        posts.append(
                            {
                                "url": "",
                                "text": text[:1000],
                                "hashtags": sorted(set(re.findall(r"#([\w\-]+)", text)))[:10],
                                "platform": "linkedin",
                            }
                        )
                except Exception:
                    pass
        except Exception:
            pass

        return posts[:10]

    # =====================
    # FACEBOOK / META
    # =====================

    def scrape_facebook(self, url: str, user_id: int = None) -> dict:
        if not user_id:
            return {
                "success": False,
                "status": "facebook_scrape_empty",
                "error": "missing_user_id",
                "platform": "facebook",
                "message": "Le profil Facebook n’a pas pu être scrapé ou les données sont vides.",
                "data": {},
                "url": url,
            }

        profile_dir = get_social_profile_dir("facebook", user_id)
        keep_context_open = False
        playwright = sync_playwright().start()

        try:
            context = playwright.chromium.launch_persistent_context(
                user_data_dir=str(profile_dir),
                headless=False,
                slow_mo=80,
                viewport={"width": 1366, "height": 900},
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--start-maximized",
                ],
            )

            page = context.pages[0] if context.pages else context.new_page()

            try:
                page.goto(url, wait_until="domcontentloaded", timeout=60000)

                if facebook_login_required(page):
                    ok = wait_manual_login(page, "facebook")

                    if not ok:
                        keep_context_open = True
                        return {
                        "success": False,
                        "status": "facebook_login_required",
                        "error": "login_required",
                        "platform": "facebook",
                        "message": "Connexion Facebook ou vérification requise.",
                        "data": {},
                        "url": url,
                    }

                page.goto(url, wait_until="domcontentloaded", timeout=60000)
                page.wait_for_timeout(8000)
                self._close_meta_popups(page)

                current_url = page.url.lower()
                if "login" in current_url or "checkpoint" in current_url:
                    ok = wait_manual_login(page, "facebook")

                    if not ok:
                        keep_context_open = True
                        return {
                        "success": False,
                        "status": "facebook_login_required",
                        "platform": "facebook",
                        "message": "Facebook demande une connexion ou une vérification.",
                        "data": {},
                            "url": url,
                        }

                    page.goto(url, wait_until="domcontentloaded", timeout=60000)
                    page.wait_for_timeout(8000)

                body = self._safe_body_text(page)

                if self._facebook_login_text(body):
                    ok = wait_manual_login(page, "facebook")

                    if not ok:
                        keep_context_open = True
                        return {
                        "success": False,
                        "status": "facebook_login_required",
                        "error": "login_required",
                        "platform": "facebook",
                        "message": "Facebook demande une connexion ou une vérification.",
                        "data": {},
                            "url": url,
                        }

                    page.goto(url, wait_until="domcontentloaded", timeout=60000)
                    page.wait_for_timeout(8000)
                    body = self._safe_body_text(page)

                data = {
                    "profile_url": url,
                    "username": self._username_from_url(url),
                    "page_text_preview": body[:2500],
                }

                try:
                    h1 = page.locator("h1").first
                    if h1.is_visible(timeout=3000):
                        data["full_name"] = h1.inner_text().strip()
                except Exception:
                    pass

                self._hydrate_meta_profile_data(page, data)
                self._hydrate_social_counts(body, data)
                self._hydrate_external_url(page, data, "facebook.com")
                data["recent_posts"] = self._extract_facebook_posts(page)

                print("[scraper] url =", url)
                print("[scraper] username =", data.get("username"))
                print("[scraper] bio =", data.get("bio"))
                print("[scraper] followers =", data.get("followers"))
                print("[scraper] external_url =", data.get("external_url"))

                if not is_valid_social_profile_data(data):
                    return {
                        "success": False,
                        "status": "facebook_scrape_empty",
                        "message": "Profil Facebook non scrapé. Vérifier la session, l’URL ou les sélecteurs.",
                        "data": {},
                        "platform": "facebook",
                        "url": url,
                    }

                return {
                    "success": True,
                    "status": "scraped",
                    "platform": "facebook",
                    "data": data,
                }

            except Exception as exc:
                return {
                    "success": False,
                    "status": "facebook_scrape_error",
                    "error": str(exc),
                    "platform": "facebook",
                    "message": "Le profil Facebook n’a pas pu être scrapé ou les données sont vides.",
                    "data": {},
                    "url": url,
                }

            finally:
                if not keep_context_open:
                    context.close()
        finally:
            if not keep_context_open:
                playwright.stop()

    def _facebook_login_required(self, page) -> bool:
        url = page.url.lower()
        body = self._safe_body_text(page).lower()

        return (
            "login" in url
            or "checkpoint" in url
            or "two_step_verification" in url
            or ("email" in body and "password" in body and "facebook" in body)
            or ("se connecter" in body and "mot de passe" in body)
        )

    def _facebook_login_text(self, body: str) -> bool:
        body = (body or "").lower()
        return (
            "log in to facebook" in body
            or "se connecter à facebook" in body
            or ("email or phone" in body and "password" in body)
        )

    def _extract_facebook_posts(self, page) -> list:
        posts = []

        try:
            page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
            page.wait_for_timeout(2500)

            candidates = page.locator("div[role='article'] span")
            count = min(candidates.count(), 25)

            for i in range(count):
                try:
                    text = candidates.nth(i).inner_text(timeout=1000).strip()
                    if len(text) > 40 and text not in [post.get("text") for post in posts]:
                        posts.append(
                            {
                                "url": "",
                                "text": text[:1000],
                                "hashtags": sorted(set(re.findall(r"#([\w\-]+)", text)))[:10],
                                "platform": "facebook",
                            }
                        )
                except Exception:
                    pass
        except Exception:
            pass

        return posts[:10]

    # =====================
    # INSTAGRAM / META
    # =====================

    def scrape_instagram(self, url: str, user_id: int = None) -> dict:
        if not user_id:
            return {
                "success": False,
                "status": "instagram_scrape_empty",
                "error": "missing_user_id",
                "platform": "instagram",
                "message": "Le profil Instagram n’a pas pu être scrapé ou les données sont vides.",
                "data": {},
                "url": url,
            }

        profile_dir = get_social_profile_dir("instagram", user_id)
        keep_context_open = False
        playwright = sync_playwright().start()

        try:
            context = playwright.chromium.launch_persistent_context(
                user_data_dir=str(profile_dir),
                headless=False,
                slow_mo=80,
                viewport={"width": 1366, "height": 900},
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--start-maximized",
                ],
            )

            page = context.pages[0] if context.pages else context.new_page()

            try:
                page.goto(url, wait_until="domcontentloaded", timeout=60000)
                logger.info("[scraper][instagram] profile opened")

                if instagram_login_required(page):
                    ok = wait_manual_login(page, "instagram")

                    if not ok:
                        keep_context_open = True
                        return {
                        "success": False,
                        "status": "instagram_login_required",
                        "error": "login_required",
                        "platform": "instagram",
                        "message": "Connexion Instagram ou vérification requise.",
                        "data": {},
                        "url": url,
                    }

                page.goto(url, wait_until="domcontentloaded", timeout=60000)
                page.wait_for_timeout(8000)
                self._close_meta_popups(page)

                current_url = page.url.lower()
                if "accounts/login" in current_url or "challenge" in current_url:
                    ok = wait_manual_login(page, "instagram")

                    if not ok:
                        keep_context_open = True
                        return {
                        "success": False,
                        "status": "instagram_login_required",
                        "platform": "instagram",
                        "message": "Instagram demande une connexion ou une vérification.",
                        "data": {},
                            "url": url,
                        }

                    page.goto(url, wait_until="domcontentloaded", timeout=60000)
                    page.wait_for_timeout(8000)

                body = self._safe_body_text(page)

                if self._instagram_login_text(body):
                    ok = wait_manual_login(page, "instagram")

                    if not ok:
                        keep_context_open = True
                        return {
                        "success": False,
                        "status": "instagram_login_required",
                        "error": "login_required",
                        "platform": "instagram",
                        "message": "Instagram demande une connexion ou une vérification.",
                        "data": {},
                            "url": url,
                        }

                    page.goto(url, wait_until="domcontentloaded", timeout=60000)
                    page.wait_for_timeout(8000)
                    body = self._safe_body_text(page)

                data = {
                    "profile_url": url,
                    "username": self._username_from_url(url),
                    "page_text_preview": body[:2500],
                }

                try:
                    header = page.locator("header").first
                    if header.is_visible(timeout=3000):
                        data["header"] = header.inner_text().strip()[:1000]
                except Exception:
                    pass

                try:
                    main = page.locator("main").first
                    if main.is_visible(timeout=3000):
                        data["main_text"] = main.inner_text().strip()[:1500]
                except Exception:
                    pass

                self._hydrate_meta_profile_data(page, data)
                self._hydrate_social_counts(body, data)
                self._hydrate_external_url(page, data, "instagram.com")
                data["recent_posts"] = self._extract_instagram_texts(page)
                data["posts"] = data["recent_posts"]

                if not data.get("bio"):
                    data["bio"] = data.get("header") or data.get("main_text") or ""

                print("[scraper] url =", url)
                print("[scraper] username =", data.get("username"))
                print("[scraper] bio =", data.get("bio"))
                print("[scraper] followers =", data.get("followers"))
                print("[scraper] external_url =", data.get("external_url"))
                logger.info("[scraper][instagram] username=%s", data.get("username"))
                logger.info("[scraper][instagram] bio=%s", data.get("bio"))
                logger.info("[scraper][instagram] posts_count=%s", len(data.get("recent_posts") or []))

                if not is_valid_social_profile_data(data):
                    return {
                        "success": False,
                        "status": "instagram_scrape_empty",
                        "message": "Profil Instagram non scrapé. Vérifier la session, l’URL ou les sélecteurs.",
                        "data": {},
                        "platform": "instagram",
                        "url": url,
                    }

                return {
                    "success": True,
                    "status": "scraped",
                    "platform": "instagram",
                    "data": data,
                }

            except Exception as exc:
                return {
                    "success": False,
                    "status": "instagram_scrape_error",
                    "error": str(exc),
                    "platform": "instagram",
                    "message": "Le profil Instagram n’a pas pu être scrapé ou les données sont vides.",
                    "data": {},
                    "url": url,
                }

            finally:
                if not keep_context_open:
                    context.close()
        finally:
            if not keep_context_open:
                playwright.stop()

    def _instagram_login_required(self, page) -> bool:
        url = page.url.lower()
        body = self._safe_body_text(page).lower()

        return (
            "accounts/login" in url
            or "challenge" in url
            or "two_step_verification" in url
            or ("log in" in body and "password" in body)
            or ("phone number, username, or email" in body)
            or ("se connecter" in body and "mot de passe" in body)
        )

    def _instagram_login_text(self, body: str) -> bool:
        body = (body or "").lower()
        return (
            "log in" in body and "password" in body
            or "sign up" in body and "instagram" in body
            or "connectez-vous" in body
        )

    def _extract_instagram_texts(self, page) -> list:
        posts = []

        try:
            page.evaluate("window.scrollTo(0, 0)")
            page.wait_for_timeout(2000)

            links = []
            loc = page.locator('a[href*="/p/"], a[href*="/reel/"]')
            count = min(loc.count(), 10)

            for i in range(count):
                try:
                    href = loc.nth(i).get_attribute("href")
                    if not href:
                        continue
                    if href.startswith("/"):
                        href = "https://www.instagram.com" + href
                    if href not in links:
                        links.append(href)
                except Exception:
                    pass

            logger.info("[scraper][instagram] post links found: %s", len(links))

            for href in links[:8]:
                post_page = None
                try:
                    post_page = page.context.new_page()
                    post_page.goto(href, wait_until="domcontentloaded", timeout=60000)
                    post_page.wait_for_timeout(4000)

                    body = self._safe_body_text(post_page).strip()
                    if not body:
                        continue

                    clean = body[:1200]
                    hashtags = sorted(set(re.findall(r"#([\w\-]+)", clean)))

                    posts.append(
                        {
                            "url": href,
                            "text": clean,
                            "hashtags": hashtags[:10],
                            "platform": "instagram",
                        }
                    )
                except Exception:
                    logger.warning("[scraper][instagram] post scrape failed %s", href)
                finally:
                    if post_page:
                        try:
                            post_page.close()
                        except Exception:
                            pass

            if posts:
                logger.info("[scraper][instagram] posts scraped: %s", len(posts))
                return posts

            candidates = page.locator("main span, article span, header span")
            count = min(candidates.count(), 40)

            fallback = []
            seen = set()
            for i in range(count):
                try:
                    text = candidates.nth(i).inner_text(timeout=1000).strip()
                    if len(text) > 30 and text not in seen:
                        seen.add(text)
                        fallback.append(
                            {
                                "text": text[:800],
                                "hashtags": sorted(set(re.findall(r"#([\w\-]+)", text)))[:10],
                                "platform": "instagram",
                            }
                        )
                except Exception:
                    pass

            return fallback[:10]
        except Exception:
            logger.warning("[scraper][instagram] extract posts failed")
            return posts

    # =====================
    # WEBSITE
    # =====================

    def scrape_website(self, url: str) -> dict:
        try:
            if not url.startswith("http"):
                url = "https://" + url

            with sync_playwright() as p:
                browser = p.chromium.launch(
                    headless=True,
                    args=["--disable-blink-features=AutomationControlled"],
                )

                context = browser.new_context(
                    user_agent=USER_AGENT,
                    viewport={"width": 1366, "height": 900},
                )

                page = context.new_page()
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
                human_delay(1200, 2200)

                body = self._safe_body_text(page)

                data = {
                    "url": url,
                    "title": page.title(),
                    "page_text_preview": body[:2500],
                }

                try:
                    meta = page.get_attribute('meta[name="description"]', "content")
                    if meta:
                        data["description"] = meta[:500]
                except Exception:
                    pass

                try:
                    h1 = page.locator("h1").first
                    if h1.is_visible(timeout=2000):
                        data["h1"] = h1.inner_text().strip()
                except Exception:
                    pass

                context.close()
                browser.close()

                return data

        except PlaywrightTimeout:
            return {"error": "timeout", "platform": "website", "url": url}
        except Exception as exc:
            return {"error": str(exc), "platform": "website", "url": url}

    # =====================
    # COMMON
    # =====================

    def _username_from_url(self, url: str) -> str:
        match = re.search(r"(?:facebook\.com|instagram\.com)/([^/?#]+)", url or "", re.I)
        if not match:
            return ""

        username = match.group(1).strip("/")
        if username.lower() in {"profile.php", "pages", "people"}:
            return ""
        return username

    def _hydrate_meta_profile_data(self, page, data: dict) -> None:
        for selector in [
            'meta[property="og:title"]',
            'meta[name="title"]',
        ]:
            try:
                value = page.get_attribute(selector, "content")
                if value and not data.get("full_name"):
                    data["full_name"] = value.strip().split("•")[0].strip()
            except Exception:
                pass

        for selector in [
            'meta[property="og:description"]',
            'meta[name="description"]',
        ]:
            try:
                value = page.get_attribute(selector, "content")
                if value and not data.get("bio"):
                    data["bio"] = value.strip()[:500]
            except Exception:
                pass

    def _hydrate_social_counts(self, body: str, data: dict) -> None:
        body = body or ""

        followers_patterns = [
            r"([\d\s.,KkMm]+)\s+followers",
            r"([\d\s.,KkMm]+)\s+abonnés",
        ]
        posts_patterns = [
            r"([\d\s.,KkMm]+)\s+posts",
            r"([\d\s.,KkMm]+)\s+publications",
        ]

        for pattern in followers_patterns:
            match = re.search(pattern, body, re.I)
            if match:
                data["followers"] = match.group(1).strip()
                break

        for pattern in posts_patterns:
            match = re.search(pattern, body, re.I)
            if match:
                data["posts_count"] = match.group(1).strip()
                break

    def _hydrate_external_url(self, page, data: dict, platform_domain: str) -> None:
        try:
            links = page.locator("a[href^='http']")
            count = min(links.count(), 30)
            for i in range(count):
                href = links.nth(i).get_attribute("href")
                if href and platform_domain not in href and "facebook.com" not in href:
                    data["external_url"] = href
                    return
        except Exception:
            pass

    def _close_meta_popups(self, page):
        selectors = [
            "button:has-text('Tout accepter')",
            "button:has-text('Accept all')",
            "button:has-text('Autoriser tous les cookies')",
            "button:has-text('Allow all cookies')",
            "button:has-text('Pas maintenant')",
            "button:has-text('Not Now')",
            "div[aria-label='Fermer'][role='button']",
            "div[aria-label='Close'][role='button']",
        ]

        for sel in selectors:
            try:
                btn = page.locator(sel).first
                if btn.is_visible(timeout=1200):
                    btn.click()
                    page.wait_for_timeout(600)
            except Exception:
                pass

    def _safe_body_text(self, page) -> str:
        try:
            return page.inner_text("body", timeout=10000)
        except Exception:
            return ""
