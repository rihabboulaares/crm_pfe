import logging
import random
import time
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from .social.session_manager import get_profile_dir

logger = logging.getLogger("agentEngagement.scraper")


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def human_delay(min_ms=800, max_ms=2000):
    time.sleep(random.uniform(min_ms / 1000, max_ms / 1000))


class EngagementScraper:
    def scrape_prospect_profiles(self, prospect, user_id: int = None) -> dict:
        result = {
            "linkedin": {},
            "facebook": {},
            "instagram": {},
            "website": {},
        }

        if prospect.linkedin_url:
            result["linkedin"] = self.scrape_linkedin(prospect.linkedin_url, user_id)
            logger.info("[scraper] LinkedIn scrapé pour Prospect #%s", prospect.pk)

        if prospect.facebook_url:
            result["facebook"] = self.scrape_facebook(prospect.facebook_url, user_id)
            logger.info("[scraper] Facebook scrapé pour Prospect #%s", prospect.pk)

        if prospect.instagram_url:
            result["instagram"] = self.scrape_instagram(prospect.instagram_url, user_id)
            logger.info("[scraper] Instagram scrapé pour Prospect #%s", prospect.pk)

        if prospect.website:
            result["website"] = self.scrape_website(prospect.website)
            logger.info("[scraper] Website scrapé pour Prospect #%s", prospect.pk)

        return result

    # =====================
    # LINKEDIN
    # =====================

    def scrape_linkedin(self, url: str, user_id: int = None) -> dict:
        if not user_id:
            return {"error": "missing_user_id", "platform": "linkedin", "url": url}

        profile_dir = get_profile_dir("linkedin", user_id)

        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(profile_dir),
                headless=False,
                slow_mo=80,
                viewport={"width": 1366, "height": 900},
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
                        "error": "login_required",
                        "platform": "linkedin",
                        "message": "Connexion LinkedIn requise.",
                        "url": url,
                    }

                page.goto(url, wait_until="domcontentloaded", timeout=90000)
                page.wait_for_timeout(7000)

                body = self._safe_body_text(page)

                if self._linkedin_login_text(body):
                    return {
                        "error": "login_required",
                        "platform": "linkedin",
                        "message": "LinkedIn affiche la page de connexion.",
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

                data["recent_posts"] = self._extract_linkedin_posts(page)

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
                    if len(text) > 40 and text not in posts:
                        posts.append(text[:600])
                except Exception:
                    pass
        except Exception:
            pass

        return posts[:3]

    # =====================
    # FACEBOOK / META
    # =====================

    def scrape_facebook(self, url: str, user_id: int = None) -> dict:
        if not user_id:
            return {"error": "missing_user_id", "platform": "facebook", "url": url}

        profile_dir = get_profile_dir("meta", user_id)

        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(profile_dir),
                headless=False,
                slow_mo=80,
                viewport={"width": 1366, "height": 900},
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--start-maximized",
                ],
            )

            page = context.new_page()

            try:
                page.goto("https://www.facebook.com/", wait_until="domcontentloaded", timeout=90000)
                page.wait_for_timeout(5000)
                self._close_meta_popups(page)

                if self._facebook_login_required(page):
                    return {
                        "error": "login_required",
                        "platform": "facebook",
                        "message": "Connexion Meta/Facebook requise.",
                        "url": url,
                    }

                page.goto(url, wait_until="domcontentloaded", timeout=90000)
                page.wait_for_timeout(7000)
                self._close_meta_popups(page)

                body = self._safe_body_text(page)

                if self._facebook_login_text(body):
                    return {
                        "error": "login_required",
                        "platform": "facebook",
                        "message": "Facebook affiche la page login.",
                        "url": url,
                    }

                data = {
                    "url": url,
                    "page_text_preview": body[:2500],
                }

                try:
                    h1 = page.locator("h1").first
                    if h1.is_visible(timeout=3000):
                        data["name"] = h1.inner_text().strip()
                except Exception:
                    pass

                data["recent_posts"] = self._extract_facebook_posts(page)

                return data

            except Exception as exc:
                return {"error": str(exc), "platform": "facebook", "url": url}

            finally:
                context.close()

    def _facebook_login_required(self, page) -> bool:
        url = page.url.lower()
        body = self._safe_body_text(page).lower()

        return (
            "login" in url
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
                    if len(text) > 40 and text not in posts:
                        posts.append(text[:600])
                except Exception:
                    pass
        except Exception:
            pass

        return posts[:3]

    # =====================
    # INSTAGRAM / META
    # =====================

    def scrape_instagram(self, url: str, user_id: int = None) -> dict:
        if not user_id:
            return {"error": "missing_user_id", "platform": "instagram", "url": url}

        profile_dir = get_profile_dir("meta", user_id)

        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(profile_dir),
                headless=False,
                slow_mo=80,
                viewport={"width": 1366, "height": 900},
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--start-maximized",
                ],
            )

            page = context.new_page()

            try:
                page.goto("https://www.instagram.com/", wait_until="domcontentloaded", timeout=90000)
                page.wait_for_timeout(6000)
                self._close_meta_popups(page)

                if self._instagram_login_required(page):
                    return {
                        "error": "login_required",
                        "platform": "instagram",
                        "message": "Connexion Meta/Instagram requise.",
                        "url": url,
                    }

                page.goto(url, wait_until="domcontentloaded", timeout=90000)
                page.wait_for_timeout(7000)
                self._close_meta_popups(page)

                body = self._safe_body_text(page)

                if self._instagram_login_text(body):
                    return {
                        "error": "login_required",
                        "platform": "instagram",
                        "message": "Instagram affiche la page login.",
                        "url": url,
                    }

                data = {
                    "url": url,
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

                data["recent_posts"] = self._extract_instagram_texts(page)

                return data

            except Exception as exc:
                return {"error": str(exc), "platform": "instagram", "url": url}

            finally:
                context.close()

    def _instagram_login_required(self, page) -> bool:
        url = page.url.lower()
        body = self._safe_body_text(page).lower()

        return (
            "accounts/login" in url
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
        texts = []

        try:
            candidates = page.locator("article span, main span")
            count = min(candidates.count(), 30)

            for i in range(count):
                try:
                    text = candidates.nth(i).inner_text(timeout=1000).strip()
                    if len(text) > 30 and text not in texts:
                        texts.append(text[:400])
                except Exception:
                    pass
        except Exception:
            pass

        return texts[:5]

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