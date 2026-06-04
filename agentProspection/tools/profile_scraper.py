import os
import hashlib
import logging
import re
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright

from agentProspection.tools.base_tool import BaseTool
from agentProspection.tools.extractors import (
    extract_email,
    extract_phone,
    detect_platform,
    clean_text,
)
from agentEngagement.social.session_manager import (
    ensure_linkedin_session_async,
    get_linkedin_profile_dir,
    linkedin_login_required_response,
)


logger = logging.getLogger(__name__)

EMAIL_RE = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
PHONE_RE = re.compile(r"(\+?\d[\d\s().-]{7,}\d)")
SUSPICIOUS_WORDS = [
    "sign in",
    "log in",
    "login",
    "captcha",
    "verify",
    "unusual traffic",
    "access denied",
    "enable javascript",
]


def headless_enabled() -> bool:
    value = os.getenv("SOCIAL_SCRAPER_HEADLESS", os.getenv("PLAYWRIGHT_HEADLESS", "true")).lower().strip()
    return value not in {"0", "false", "no", "off"}


def manual_login_enabled() -> bool:
    return os.getenv("SOCIAL_LOGIN_MODE", "manual").lower().strip() == "manual"


def reuse_session_enabled() -> bool:
    value = os.getenv("SOCIAL_REUSE_SESSION", "true").lower().strip()
    return value not in {"0", "false", "no", "off"}


def login_once_per_platform_enabled() -> bool:
    value = os.getenv("SOCIAL_LOGIN_ONCE_PER_PLATFORM", "true").lower().strip()
    return value not in {"0", "false", "no", "off"}


def login_timeout_minutes() -> float:
    try:
        return float(os.getenv("SOCIAL_LOGIN_TIMEOUT_MINUTES", "5"))
    except ValueError:
        return 5.0


def browser_profile_dir(user_id: int | str | None, platform: str) -> str:
    if platform == "linkedin":
        return str(get_linkedin_profile_dir(user_id or "anonymous"))

    root = Path(os.getenv("SOCIAL_BROWSER_PROFILE_DIR", "browser_profiles"))
    safe_user = str(user_id or "anonymous").strip().replace("/", "_").replace("\\", "_")
    return str(root / f"user_{safe_user}" / platform)


def debug_screenshot_path(url: str) -> str:
    os.makedirs("debug_screenshots", exist_ok=True)
    safe_name = hashlib.md5(url.encode()).hexdigest()
    return f"debug_screenshots/{safe_name}.png"


def log_scrape_debug(debug: dict):
    logger.info("PLAYWRIGHT SCRAPE RESULT")
    logger.info("URL: %s", debug.get("url"))
    logger.info("STATUS: %s", debug.get("status"))
    logger.info("TITLE: %s", debug.get("title"))
    logger.info("HTML LENGTH: %s", debug.get("html_length"))
    logger.info("TEXT LENGTH: %s", debug.get("text_length"))
    logger.info("TEXT PREVIEW: %s", debug.get("text_preview"))
    logger.info("LINKS COUNT: %s", debug.get("links_count"))
    logger.info("EMAILS FOUND: %s", debug.get("emails"))
    logger.info("PHONES FOUND: %s", debug.get("phones"))
    logger.info("BLOCKED: %s", debug.get("blocked"))
    logger.info("SCREENSHOT: %s", debug.get("screenshot_path"))


def evaluate_scrape_quality(debug: dict) -> dict:
    html_length = int(debug.get("html_length") or 0)
    text_length = int(debug.get("text_length") or 0)
    title = debug.get("title") or ""
    text_preview = debug.get("text_preview") or ""
    status = debug.get("status")

    has_content = (
        html_length > 0
        or text_length > 500
        or bool(title)
        or bool(text_preview.strip())
    )
    empty = html_length == 0 and text_length == 0

    lower_text = f"{title} {text_preview}".lower()
    suspicious = any(word in lower_text for word in SUSPICIOUS_WORDS)
    blocked = False

    if empty:
        blocked = True
    elif suspicious and text_length <= 500:
        blocked = True

    scraping_success = has_content and not empty
    if status == 999 and text_length > 500:
        scraping_success = True
        blocked = False

    debug["scraping_success"] = scraping_success
    debug["blocked"] = blocked
    return debug


async def collect_scrape_debug(page, url: str, response=None) -> dict:
    result = {
        "url": url,
        "status": response.status if response else None,
        "title": None,
        "html_length": 0,
        "text_length": 0,
        "text_preview": "",
        "links_count": 0,
        "emails": [],
        "phones": [],
        "blocked": False,
        "screenshot_path": None,
        "error": None,
    }

    try:
        result["title"] = await page.title()
        html = await page.content()
        text = await page.locator("body").inner_text(timeout=10000)
        links = await page.locator("a").evaluate_all(
            "(els) => els.map(a => a.href).filter(Boolean)"
        )

        result["html_length"] = len(html or "")
        result["text_length"] = len(text or "")
        result["text_preview"] = (text or "")[:500]
        result["links_count"] = len(links or [])
        result["emails"] = sorted(set(EMAIL_RE.findall(text or "")))
        result["phones"] = sorted(set(PHONE_RE.findall(text or "")))

        result = evaluate_scrape_quality(result)

        if result["blocked"]:
            screenshot_path = debug_screenshot_path(url)
            await page.screenshot(path=screenshot_path, full_page=True)
            result["screenshot_path"] = screenshot_path
    except Exception as exc:
        result["error"] = str(exc)[:300]

    log_scrape_debug(result)
    return result


async def is_login_required(page, platform: str) -> bool:
    url = (page.url or "").lower()

    try:
        text = (await page.locator("body").inner_text(timeout=5000)).lower()
    except Exception:
        text = ""

    async def has_selector(selector: str) -> bool:
        try:
            return await page.locator(selector).count() > 0
        except Exception:
            return False

    if platform == "instagram":
        return (
            "accounts/login" in url
            or "log in" in text
            or "se connecter" in text
            or await has_selector("input[name='username']")
        )

    if platform == "facebook":
        return (
            "/login" in url
            or "login" in url
            or "log in" in text
            or "se connecter" in text
            or await has_selector("input[name='email']")
        )

    if platform == "linkedin":
        return (
            "/login" in url
            or "checkpoint" in url
            or "sign in" in text
            or "s'identifier" in text
            or "s’identifier" in text
            or await has_selector("input[name='session_key']")
        )

    return False


async def wait_for_manual_login(page, platform: str, timeout_minutes: float = 5) -> bool:
    deadline = time.time() + timeout_minutes * 60

    while time.time() < deadline:
        try:
            if not await is_login_required(page, platform):
                await page.wait_for_load_state("domcontentloaded", timeout=10000)
                return True
        except Exception:
            pass

        await page.wait_for_timeout(3000)

    return False


async def get_authenticated_context(playwright, user_id: int | str | None, platform: str):
    profile_dir = browser_profile_dir(user_id, platform)
    Path(profile_dir).mkdir(parents=True, exist_ok=True)
    is_linkedin = platform == "linkedin"

    return await playwright.chromium.launch_persistent_context(
        user_data_dir=profile_dir,
        headless=False if is_linkedin else headless_enabled(),
        slow_mo=300 if is_linkedin else 100,
        viewport={"width": 1400, "height": 900},
        locale="fr-FR",
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        args=[
            "--disable-blink-features=AutomationControlled",
            "--start-maximized",
        ],
    )


class SocialSessionManager:
    def __init__(self, user_id: int | str | None):
        self.user_id = user_id
        self.playwright = None
        self.contexts = {}
        self.login_checked = {}
        self.login_required = {}
        self.login_success = {}

    async def start(self):
        if not self.playwright:
            self.playwright = await async_playwright().start()
        return self.playwright

    async def get_context(self, platform: str):
        if reuse_session_enabled() and platform in self.contexts:
            return self.contexts[platform]

        playwright = await self.start()
        context = await get_authenticated_context(playwright, self.user_id, platform)

        if reuse_session_enabled():
            self.contexts[platform] = context

        return context

    async def ensure_login_once(self, platform: str, test_url: str) -> bool:
        if login_once_per_platform_enabled() and self.login_checked.get(platform):
            return self.login_success.get(platform, False)

        if platform == "linkedin":
            logged = await ensure_linkedin_session_async(int(self.user_id or 0))
            self.login_checked[platform] = True
            self.login_required[platform] = not logged
            self.login_success[platform] = logged
            return logged

        context = await self.get_context(platform)
        page = await context.new_page()

        try:
            await page.goto(test_url, wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_timeout(2500)

            if not await is_login_required(page, platform):
                self.login_checked[platform] = True
                self.login_required[platform] = False
                self.login_success[platform] = True
                return True

            self.login_required[platform] = True

            if manual_login_enabled() and not headless_enabled():
                logged = await wait_for_manual_login(
                    page,
                    platform,
                    timeout_minutes=login_timeout_minutes(),
                )
            else:
                logged = False

            self.login_checked[platform] = True
            self.login_success[platform] = logged
            return logged
        finally:
            try:
                await page.close()
            except Exception:
                pass

    async def mark_session_invalid(self, platform: str):
        self.login_checked[platform] = True
        self.login_success[platform] = False
        self.login_required[platform] = True

    async def close_all(self):
        for context in list(self.contexts.values()):
            try:
                await context.close()
            except Exception:
                pass
        self.contexts.clear()

        if self.playwright:
            try:
                await self.playwright.stop()
            except Exception:
                pass
            self.playwright = None


async def safe_text(page, selector: str, timeout: int = 3000) -> str | None:
    try:
        loc = page.locator(selector)
        if await loc.count() == 0:
            return None
        return (await loc.first.inner_text(timeout=timeout)).strip()
    except Exception:
        return None


async def safe_attr(page, selector: str, attr: str, timeout: int = 3000) -> str | None:
    try:
        loc = page.locator(selector)
        if await loc.count() == 0:
            return None
        return await loc.first.get_attribute(attr, timeout=timeout)
    except Exception:
        return None


def split_name(full_name: str | None) -> tuple[str | None, str | None]:
    parts = (full_name or "").strip().split()
    if not parts:
        return None, None
    if len(parts) == 1:
        return parts[0], None
    return parts[0], " ".join(parts[1:])


def title_clean(title: str | None, platform: str) -> str | None:
    if not title:
        return None

    value = title
    for w in ["| LinkedIn", "LinkedIn", "| Facebook", "Facebook", "| Instagram", "Instagram"]:
        value = value.replace(w, "")

    value = value.strip(" -|")
    return value or None


class ProfileScraperTool(BaseTool):
    name = "profile_scraper"

    async def run(
        self,
        query: str,
        user_id: int | str | None = None,
        session_manager: SocialSessionManager | None = None,
    ) -> dict:
        url = query
        platform = detect_platform(url)

        if platform not in {"linkedin", "facebook", "instagram"}:
            return {
                "raw_url": url,
                "source": "profile_scraper",
                "content": None,
            }

        own_manager = session_manager is None
        manager = session_manager or SocialSessionManager(user_id)
        login_required_this_url = False

        try:
            login_ok = await manager.ensure_login_once(platform, url)
            login_required_this_url = manager.login_required.get(platform, False)

            if not login_ok:
                return self.fallback(
                    url,
                    platform,
                    "Connexion manuelle requise",
                    requires_login=True,
                )

            context = await manager.get_context(platform)
            page = await context.new_page()

            try:
                response = await page.goto(url, wait_until="domcontentloaded", timeout=60000)
                await page.wait_for_timeout(2500)

                if await is_login_required(page, platform):
                    await manager.mark_session_invalid(platform)
                    return self.fallback(
                        url,
                        platform,
                        "Session invalide ou login requis",
                        requires_login=True,
                    )

                scrape_debug = await collect_scrape_debug(page, url, response)
                scrape_debug["requires_login"] = login_required_this_url
                scrape_debug["platform"] = platform
                if login_required_this_url:
                    scrape_debug["step"] = "manual_login_required"

                if platform == "linkedin":
                    data = await self.scrape_linkedin(page, url)
                elif platform == "facebook":
                    data = await self.scrape_facebook(page, url)
                else:
                    data = await self.scrape_instagram(page, url)

                data["scraping_debug"] = scrape_debug
                data["scrape_blocked"] = scrape_debug.get("blocked")
                data["requires_login"] = False
                data["manual_login_required"] = login_required_this_url
                return data

            except PlaywrightTimeoutError:
                return self.fallback(url, platform, "timeout")
            except Exception as exc:
                return self.fallback(url, platform, str(exc)[:300])
            finally:
                try:
                    await page.close()
                except Exception:
                    pass
        finally:
            if own_manager:
                await manager.close_all()

    def fallback(
        self,
        url: str,
        platform: str,
        error: str | None = None,
        requires_login: bool = False,
    ) -> dict:
        data = {
            "raw_url": url,
            "source": f"profile_scraper_{platform}",
            "content": None,
            "source_confidence": 0.3,
            "requires_login": requires_login,
        }

        if platform == "linkedin" and requires_login:
            data.update(linkedin_login_required_response())

        if platform == "linkedin":
            data["linkedin_url"] = url
            data["lead_type"] = "person" if "/in/" in urlparse(url).path.lower() else "company"
        elif platform == "facebook":
            data["facebook_url"] = url
            data["lead_type"] = "company"
        elif platform == "instagram":
            data["instagram_url"] = url
            data["lead_type"] = "company"

        if error:
            data["error"] = error
            data["scraping_debug"] = {
                "url": url,
                "status": None,
                "title": None,
                "html_length": 0,
                "text_length": 0,
                "text_preview": "",
                "links_count": 0,
                "emails": [],
                "phones": [],
                "blocked": True,
                "scraping_success": False,
                "screenshot_path": None,
                "error": error,
                "requires_login": requires_login,
                "platform": platform,
                "scrape_blocked": True,
                "step": "manual_login_required" if requires_login else "scrape_failed",
            }
            data["scrape_blocked"] = True

        return data

    async def scrape_linkedin(self, page, url: str) -> dict:
        path = urlparse(url).path.lower()

        body = await page.locator("body").inner_text(timeout=8000)
        content = clean_text(body)
        page_title = await page.title()

        if "/in/" in path:
            full_name = (
                await safe_text(page, "main h1")
                or await safe_text(page, "h1")
                or title_clean(page_title, "linkedin")
            )

            first_name, last_name = split_name(full_name)

            title = (
                await safe_text(page, ".text-body-medium")
                or await safe_text(page, "main section div")
            )

            return {
                "lead_type": "person",
                "full_name": full_name,
                "first_name": first_name,
                "last_name": last_name,
                "title": title,
                "company_name": None,
                "linkedin_url": url,
                "email": extract_email(body),
                "phone": extract_phone(body),
                "content": content,
                "source": "profile_scraper_linkedin",
                "source_confidence": 0.85,
            }

        company_name = (
            await safe_text(page, "main h1")
            or await safe_text(page, "h1")
            or title_clean(page_title, "linkedin")
        )

        website = (
            await safe_attr(page, "a[href^='http']:has-text('Site web')", "href")
            or await safe_attr(page, "a[href^='http']:has-text('Website')", "href")
            or self.find_external_website_from_text(body)
        )

        return {
            "lead_type": "company",
            "company_name": company_name,
            "website": website,
            "linkedin_url": url,
            "email": extract_email(body),
            "phone": extract_phone(body),
            "content": content,
            "source": "profile_scraper_linkedin",
            "source_confidence": 0.85,
        }

    async def scrape_facebook(self, page, url: str) -> dict:
        body = await page.locator("body").inner_text(timeout=8000)
        content = clean_text(body)
        page_title = await page.title()

        company_name = (
            await safe_text(page, "h1")
            or title_clean(page_title, "facebook")
            or self.name_from_url(url)
        )

        website = await self.find_first_external_link(page, ["facebook.com", "fb.com"])

        return {
            "lead_type": "company",
            "company_name": company_name,
            "facebook_url": url,
            "website": website,
            "email": extract_email(body),
            "phone": extract_phone(body),
            "content": content,
            "source": "profile_scraper_facebook",
            "source_confidence": 0.8,
        }

    async def scrape_instagram(self, page, url: str) -> dict:
        username = urlparse(url).path.strip("/").split("/")[0]
        body = await page.locator("body").inner_text(timeout=8000)
        content = clean_text(body)
        page_title = await page.title()
        description = await safe_attr(page, "meta[name='description']", "content")

        text = f"{body}\n{description or ''}"

        website = await self.find_first_external_link(page, ["instagram.com"])

        return {
            "lead_type": "company",
            "company_name": title_clean(page_title, "instagram") or username,
            "instagram_url": url,
            "website": website,
            "email": extract_email(text),
            "phone": extract_phone(text),
            "content": clean_text(description or body),
            "source": "profile_scraper_instagram",
            "source_confidence": 0.75,
        }

    async def find_first_external_link(self, page, excluded_domains: list[str]) -> str | None:
        anchors = page.locator("a")
        count = await anchors.count()

        for i in range(min(count, 120)):
            try:
                href = await anchors.nth(i).get_attribute("href")
                if not href:
                    continue
                if not href.startswith("http"):
                    continue
                if any(domain in href.lower() for domain in excluded_domains):
                    continue
                return href.split("?")[0].split("#")[0].rstrip("/")
            except Exception:
                continue

        return None

    def find_external_website_from_text(self, text: str | None) -> str | None:
        if not text:
            return None

        import re

        match = re.search(r"https?://[^\s)]+", text)
        if not match:
            return None

        url = match.group(0).rstrip(".,)")
        if any(x in url.lower() for x in ["linkedin.com", "facebook.com", "instagram.com"]):
            return None

        return url

    def name_from_url(self, url: str) -> str | None:
        path = urlparse(url).path.strip("/")
        if not path:
            return None
        return path.split("/")[0].replace(".", " ").replace("-", " ")
