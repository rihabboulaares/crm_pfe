from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse


BLOCKED_URL_MARKERS = [
    "annuaire",
    "directory",
    "pagesjaunes",
    "emploi",
    "jobs",
    "/job/",
    "/jobs/",
    "career",
    "careers",
    "blog",
    ".pdf",
    "tiktok.com",
    "scribd.com",
    "youtube.com",
    "youtu.be",
    "threads.net",
]


@dataclass
class AgentMemory:
    query: str
    company_id: int
    user_id: int

    intent: dict[str, Any] | None = None
    plan: dict[str, Any] | None = None
    decision: dict[str, Any] | None = None

    current_state: str = "init"
    current_phase: str = "init"
    iterations: int = 0
    stop_reason: str | None = None
    max_iterations: int = 12
    max_leads: int = 10
    max_urls: int = 20
    max_pages_per_domain: int = 4
    gemini_decisions: list[dict[str, Any]] = field(default_factory=list)

    tool_history: list[dict[str, Any]] = field(default_factory=list)
    raw_results: list[dict[str, Any]] = field(default_factory=list)

    discovered_urls: list[dict[str, Any]] = field(default_factory=list)
    crawl_queue: list[dict[str, Any]] = field(default_factory=list)
    crawled_pages: list[dict[str, Any]] = field(default_factory=list)
    scrape_debug_events: list[dict[str, Any]] = field(default_factory=list)
    scraping_debug: dict[str, int] = field(default_factory=lambda: {
        "crawled_pages": 0,
        "successful_scrapes": 0,
        "blocked_scrapes": 0,
        "empty_pages": 0,
        "failed_scrapes": 0,
    })

    companies: list[dict[str, Any]] = field(default_factory=list)
    persons: list[dict[str, Any]] = field(default_factory=list)
    prospects: list[dict[str, Any]] = field(default_factory=list)

    rejected_results: list[dict[str, Any]] = field(default_factory=list)
    errors: list[dict[str, str]] = field(default_factory=list)
    logs: list[dict[str, str]] = field(default_factory=list)

    def set_phase(self, phase: str):
        self.current_phase = phase
        self.current_state = phase
        self.add_log("phase", phase)

    def add_log(self, step: str, message: str, **extra):
        self.logs.append({"step": step, "message": str(message), **extra})

    def add_error(self, step: str, message: str):
        self.errors.append({"step": step, "message": str(message)})
        self.add_log("error", f"{step}: {message}")

    def add_tool_call(self, tool: str, query: str, decision: dict[str, Any] | None = None):
        self.tool_history.append({
            "tool": tool,
            "query": str(query),
            "decision": (decision or {}).get("decision"),
            "reason": (decision or {}).get("reason"),
        })

    def already_used(self, tool: str, query: str) -> bool:
        return any(
            item.get("tool") == tool and item.get("query") == str(query)
            for item in self.tool_history
        )

    def add_decision(self, decision: dict[str, Any]):
        self.decision = decision
        self.gemini_decisions.append(decision)
        self.add_log("decision", decision.get("reason") or decision.get("decision") or "")

    def is_blocked_url(self, url: str | None) -> bool:
        value = str(url or "").strip().lower()
        if not value:
            return True
        if any(marker in value for marker in BLOCKED_URL_MARKERS):
            return True

        parsed = urlparse(value)
        host = parsed.netloc.replace("www.", "")
        return host in {"tiktok.com", "scribd.com", "youtube.com", "youtu.be", "threads.net"}

    def domain_crawl_count(self, url: str) -> int:
        domain = urlparse(url).netloc.lower().replace("www.", "")
        return sum(
            1
            for item in self.crawled_pages
            if urlparse(str(item.get("raw_url") or item.get("website") or "")).netloc.lower().replace("www.", "") == domain
        )

    def add_url_candidate(
        self,
        url: str | None,
        source: str,
        entity_type: str = "unknown",
        confidence: float = 0.5,
    ):
        if not url:
            return

        url = str(url).strip()
        if not url.startswith(("http://", "https://")):
            return

        if self.is_blocked_url(url):
            self.rejected_results.append({
                "url": url,
                "source": source,
                "rejected_reason": "blocked_url",
            })
            return

        for item in self.discovered_urls:
            if item.get("url") == url:
                return

        candidate = {
            "url": url,
            "source": source,
            "entity_type": entity_type,
            "confidence": confidence,
            "crawled": False,
        }

        self.discovered_urls.append(candidate)
        self.crawl_queue.append(candidate)

    def next_crawl_url(self) -> dict[str, Any] | None:
        self.crawl_queue.sort(
            key=lambda x: float(x.get("confidence", 0)),
            reverse=True,
        )

        for item in self.crawl_queue:
            if not item.get("crawled"):
                item["crawled"] = True
                return item

        return None

    def refresh_prospects(self):
        self.prospects = self.companies + self.persons

    def add_scrape_debug(self, debug: dict[str, Any] | None):
        if not debug:
            return

        self.scrape_debug_events.append(debug)
        self.scraping_debug["crawled_pages"] += 1

        if debug.get("error"):
            self.scraping_debug["failed_scrapes"] += 1
        elif debug.get("blocked"):
            self.scraping_debug["blocked_scrapes"] += 1
        elif not debug.get("scraping_success") or int(debug.get("text_length") or 0) == 0:
            self.scraping_debug["empty_pages"] += 1
        else:
            self.scraping_debug["successful_scrapes"] += 1

    def valid_companies(self) -> list[dict[str, Any]]:
        return [
            item for item in self.companies
            if item.get("crm_ready") or item.get("is_valid") is True
        ]

    def valid_persons(self) -> list[dict[str, Any]]:
        return [
            item for item in self.persons
            if item.get("crm_ready") or item.get("is_valid") is True
        ]

    def crm_ready_entities(self) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        companies = [item for item in self.companies if item.get("crm_ready")]
        persons = [item for item in self.persons if item.get("crm_ready")]

        return companies, persons

    def to_summary(self) -> dict[str, Any]:
        return {
            "query": self.query,
            "company_id": self.company_id,
            "user_id": self.user_id,
            "intent": self.intent,
            "current_state": self.current_state,
            "iterations": self.iterations,
            "tools_used": self.tool_history[-12:],
            "urls_found": self.discovered_urls[-20:],
            "pending_urls": [
                item for item in self.discovered_urls
                if not item.get("crawled")
            ][:15],
            "crawled_pages_count": len(self.crawled_pages),
            "scraping_debug": self.scraping_debug,
            "scrape_debug_sample": self.scrape_debug_events[-5:],
            "companies_count": len(self.companies),
            "persons_count": len(self.persons),
            "valid_leads_count": len(self.valid_companies()) + len(self.valid_persons()),
            "limits": {
                "max_iterations": self.max_iterations,
                "max_leads": self.max_leads,
                "max_urls": self.max_urls,
                "max_pages_per_domain": self.max_pages_per_domain,
            },
            "companies_sample": self.companies[-8:],
            "persons_sample": self.persons[-8:],
            "rejected_results_count": len(self.rejected_results),
            "errors": self.errors[-8:],
        }

    def to_dict(self):
        return {
            "query": self.query,
            "company_id": self.company_id,
            "user_id": self.user_id,
            "intent": self.intent,
            "plan": self.plan,
            "decision": self.decision,
            "gemini_decisions": self.gemini_decisions,
            "current_state": self.current_state,
            "current_phase": self.current_phase,
            "iterations": self.iterations,
            "tool_history": self.tool_history,
            "raw_results": self.raw_results[-20:],
            "discovered_urls": self.discovered_urls[-30:],
            "crawled_pages": self.crawled_pages[-20:],
            "scraping_debug": self.scraping_debug,
            "scrape_debug_events": self.scrape_debug_events[-20:],
            "companies": self.companies,
            "persons": self.persons,
            "prospects": self.prospects,
            "rejected_results": self.rejected_results[-20:],
            "errors": self.errors,
            "logs": self.logs,
        }
