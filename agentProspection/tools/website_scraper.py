import os
import re
import hashlib
import logging
from urllib.parse import urljoin, urlparse

from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright

from agentProspection.tools.base_tool import BaseTool
from agentProspection.tools.browser_session import get_context


logger = logging.getLogger(__name__)


EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)
PHONE_RE = re.compile(
    r"(?:(?:\+|00)\s?216|216)?[\s.\-()]*(?:\d[\s.\-()]*){8}",
    re.IGNORECASE,
)

SOCIAL_PATTERNS = {
    "linkedin_url": "linkedin.com",
    "facebook_url": "facebook.com",
    "instagram_url": "instagram.com",
}

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
    value = os.getenv("PLAYWRIGHT_HEADLESS", "true").lower().strip()
    return value not in {"0", "false", "no", "off"}


def clean_phone(value: str | None) -> str | None:
    if not value:
        return None

    digits = re.sub(r"\D", "", value)

    if digits.startswith("00216"):
        digits = "216" + digits[5:]

    if len(digits) == 8 and digits[0] in "24579":
        return f"+216{digits}"

    if digits.startswith("216") and len(digits) >= 11:
        return f"+{digits[:11]}"

    return value.strip()


def first_email(text: str | None) -> str | None:
    if not text:
        return None

    for match in EMAIL_RE.finditer(text):
        email = match.group(0).lower()

        if any(bad in email for bad in ["example.com", "noreply", "no-reply", "schema.org"]):
            continue

        return email

    return None


def first_phone(text: str | None) -> str | None:
    if not text:
        return None

    match = PHONE_RE.search(text)

    if not match:
        return None

    return clean_phone(match.group(0))


def same_domain(base_url: str, candidate: str) -> bool:
    try:
        base = urlparse(base_url).netloc.replace("www.", "")
        other = urlparse(candidate).netloc.replace("www.", "")
        return base == other
    except Exception:
        return False


def is_contact_like(url: str) -> bool:
    path = urlparse(url).path.lower()

    keywords = [
        "contact", "about", "a-propos", "apropos", "qui-sommes-nous",
        "services", "team", "equipe", "cabinet", "agency", "agence",
    ]

    return any(k in path for k in keywords)


def normalize_url(url: str) -> str:
    parsed = urlparse(url)
    return parsed._replace(fragment="", query="").geturl().rstrip("/")


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


class WebsiteScraperTool(BaseTool):
    name = "website_scraper"

    async def run(self, query: str) -> dict:
        url = query

        if not url.startswith(("http://", "https://")):
            url = "https://" + url

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=headless_enabled())
            context = await get_context(browser, None)
            page = await context.new_page()

            try:
                response = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(1500)
                scrape_debug = await collect_scrape_debug(page, url, response)

                main_text = await page.locator("body").inner_text(timeout=8000)
                title = await page.title()

                links = await self.extract_links(page, url)
                priority_links = [link for link in links if is_contact_like(link)][:3]

                collected_text = main_text or ""

                for link in priority_links:
                    try:
                        sub = await context.new_page()
                        await sub.goto(link, wait_until="domcontentloaded", timeout=20000)
                        await sub.wait_for_timeout(1000)
                        collected_text += "\n" + await sub.locator("body").inner_text(timeout=6000)
                        await sub.close()
                    except Exception:
                        continue

                socials = self.extract_socials(links)
                email = first_email(collected_text)
                phone = first_phone(collected_text)

                company_name = self.extract_company_name(title, url)

                return {
                    "lead_type": "company",
                    "company_name": company_name,
                    "website": normalize_url(url),
                    "email": email,
                    "phone": phone,
                    "linkedin_url": socials.get("linkedin_url"),
                    "facebook_url": socials.get("facebook_url"),
                    "instagram_url": socials.get("instagram_url"),
                    "content": collected_text[:1200] if collected_text else None,
                    "source": "website_scraper",
                    "scraping_debug": scrape_debug,
                    "scrape_blocked": scrape_debug.get("blocked"),
                }

            except PlaywrightTimeoutError:
                return {
                    "website": normalize_url(url),
                    "lead_type": "company",
                    "source": "website_scraper",
                    "error": "timeout",
                    "scrape_blocked": True,
                    "scraping_debug": {
                        "url": normalize_url(url),
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
                        "error": "timeout",
                    },
                }
            except Exception as exc:
                return {
                    "website": normalize_url(url),
                    "lead_type": "company",
                    "source": "website_scraper",
                    "error": str(exc)[:300],
                    "scrape_blocked": True,
                    "scraping_debug": {
                        "url": normalize_url(url),
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
                        "error": str(exc)[:300],
                    },
                }
            finally:
                await browser.close()

    async def extract_links(self, page, base_url: str) -> list[str]:
        links = []
        anchors = page.locator("a")
        count = await anchors.count()

        for i in range(min(count, 150)):
            try:
                href = await anchors.nth(i).get_attribute("href")

                if not href:
                    continue

                absolute = normalize_url(urljoin(base_url, href))

                if absolute.startswith(("mailto:", "tel:", "javascript:")):
                    continue

                links.append(absolute)
            except Exception:
                continue

        deduped = []
        seen = set()

        for link in links:
            if link in seen:
                continue

            seen.add(link)
            deduped.append(link)

        return deduped

    def extract_socials(self, links: list[str]) -> dict:
        result = {}

        for field, pattern in SOCIAL_PATTERNS.items():
            for link in links:
                if pattern in link.lower():
                    result[field] = link
                    break

        return result

    def extract_company_name(self, title: str | None, url: str) -> str:
        if title:
            cleaned = re.sub(r"\s*[-|]\s*(Accueil|Home|Contact|Bienvenue).*$", "", title, flags=re.I)
            cleaned = cleaned.strip(" -|")
            if cleaned:
                return cleaned[:255]

        domain = urlparse(url).netloc.replace("www.", "")
        return domain.split(".")[0].replace("-", " ").title()
