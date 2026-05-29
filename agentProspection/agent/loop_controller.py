from urllib.parse import urlparse

from agentProspection.agent.brain import GeminiBrain
from agentProspection.agent.fusion_engine import (
    is_same_company,
    is_same_person,
    merge_leads,
)
from agentProspection.agent.lead_classifier import (
    classify_lead_type,
    has_valid_contact_url,
    is_noise_lead,
    is_relevant_to_query,
    qualify_entity,
)
from agentProspection.agent.memory import AgentMemory
from agentProspection.crm.importer import import_leads_to_crm
from agentProspection.tools.maps_tool import MapsTool
from agentProspection.tools.profile_scraper import ProfileScraperTool, SocialSessionManager
from agentProspection.tools.serper_tool import SerperTool
from agentProspection.tools.website_scraper import WebsiteScraperTool


website_scraper = WebsiteScraperTool()
serper_tool = SerperTool()
profile_scraper = ProfileScraperTool()
maps_tool = MapsTool()

TOOLS = {
    "maps_search": maps_tool,
    "maps": maps_tool,
    "serper_linkedin": serper_tool,
    "serper_facebook": serper_tool,
    "serper_instagram": serper_tool,
    "serper_general": serper_tool,
    "playwright_profile_scraper": profile_scraper,
    "playwright_scraper": profile_scraper,
    "website_scraper": website_scraper,
}

SOCIAL_DOMAINS = ("linkedin.com", "facebook.com", "instagram.com")


def is_company(lead: dict) -> bool:
    return lead.get("lead_type") == "company"


def is_person(lead: dict) -> bool:
    return lead.get("lead_type") == "person"


def normalize_tool_name(tool_name: str | None) -> str:
    aliases = {
        "maps": "maps_search",
        "google_maps": "maps_search",
        "playwright_scraper": "playwright_profile_scraper",
        "profile_scraper": "playwright_profile_scraper",
        "linkedin": "serper_linkedin",
        "facebook": "serper_facebook",
        "instagram": "serper_instagram",
        "general": "serper_general",
    }
    return aliases.get((tool_name or "").strip(), (tool_name or "").strip())


def normalize_lead(lead: dict, source: str) -> dict:
    lead = dict(lead)
    lead["source"] = lead.get("source") or source

    lead.setdefault("company_name", None)
    lead.setdefault("first_name", None)
    lead.setdefault("last_name", None)
    lead.setdefault("full_name", None)
    lead.setdefault("title", None)
    lead.setdefault("phone", None)
    lead.setdefault("email", None)
    lead.setdefault("website", None)
    lead.setdefault("city", None)
    lead.setdefault("country", "Tunisie")
    lead.setdefault("linkedin_url", None)
    lead.setdefault("facebook_url", None)
    lead.setdefault("instagram_url", None)
    lead.setdefault("google_place_id", None)
    lead.setdefault("raw_url", None)
    lead.setdefault("source_url", lead.get("raw_url") or lead.get("linkedin_url") or lead.get("facebook_url") or lead.get("instagram_url") or lead.get("website"))
    lead.setdefault("profile_url", lead.get("source_url"))
    lead.setdefault("job_title", lead.get("title"))
    lead.setdefault("content", None)

    lead["lead_type"] = lead.get("lead_type") or classify_lead_type(lead)

    if lead.get("lead_score") and not lead.get("score_ia"):
        lead["score_ia"] = lead["lead_score"]
    if lead.get("reason") and not lead.get("raison_score"):
        lead["raison_score"] = lead["reason"]

    return lead


def extract_candidate_urls(lead: dict) -> list[tuple[str, str]]:
    urls = []

    for field in ["raw_url", "website", "linkedin_url", "facebook_url", "instagram_url"]:
        url = lead.get(field)
        if url:
            urls.append((url, field))

    return urls


def add_urls_to_memory(memory: AgentMemory, lead: dict, source: str):
    for url, field in extract_candidate_urls(lead):
        confidence = 0.7

        if field == "website":
            confidence = 0.9
        elif field == "linkedin_url":
            confidence = 0.85
        elif field in {"facebook_url", "instagram_url"}:
            confidence = 0.75

        memory.add_url_candidate(
            url=url,
            source=source,
            entity_type=lead.get("lead_type") or "unknown",
            confidence=confidence,
        )


def add_or_merge_company(companies: list[dict], lead: dict):
    for existing in companies:
        if is_same_company(existing, lead):
            merge_leads(existing, lead)
            return existing

    companies.append(lead)
    return lead


def add_or_merge_person(persons: list[dict], lead: dict):
    for existing in persons:
        if is_same_person(existing, lead):
            merge_leads(existing, lead)
            return existing

    persons.append(lead)
    return lead


def mark_crawled(memory: AgentMemory, url: str):
    for item in memory.discovered_urls:
        if item.get("url") == url:
            item["crawled"] = True
    for item in memory.crawl_queue:
        if item.get("url") == url:
            item["crawled"] = True


def allowed_target_urls(memory: AgentMemory, target_urls: list[str], max_urls: int, max_pages_per_domain: int) -> list[str]:
    discovered = {item.get("url") for item in memory.discovered_urls}
    accepted = []

    for url in target_urls:
        if not url or url not in discovered:
            memory.rejected_results.append({
                "url": url,
                "rejected_reason": "url_not_discovered",
            })
            continue
        if memory.is_blocked_url(url):
            memory.rejected_results.append({
                "url": url,
                "rejected_reason": "blocked_url",
            })
            continue
        if len(memory.crawled_pages) >= max_urls:
            break
        if memory.domain_crawl_count(url) >= max_pages_per_domain:
            memory.rejected_results.append({
                "url": url,
                "rejected_reason": "domain_crawl_limit",
            })
            continue
        if url not in accepted:
            accepted.append(url)

    return accepted


async def execute_single_tool(
    tool_name: str,
    tool_query,
    user_id: int | None = None,
    session_manager: SocialSessionManager | None = None,
):
    tool_name = normalize_tool_name(tool_name)
    tool = TOOLS.get(tool_name)

    if not tool:
        raise RuntimeError(f"Tool introuvable: {tool_name}")

    if tool_name.startswith("serper_"):
        platform = tool_name.replace("serper_", "", 1)
        return await tool.run(tool_query, platform=platform)

    if tool_name in {"playwright_profile_scraper"}:
        return await tool.run(tool_query, user_id=user_id, session_manager=session_manager)

    if tool_name in {"website_scraper"}:
        return await tool.run(tool_query)

    return await tool.run(tool_query)


async def execute_tool(
    tool_name: str,
    tool_query,
    user_id: int | None = None,
    session_manager: SocialSessionManager | None = None,
) -> dict:
    normalized_tool = normalize_tool_name(tool_name)

    try:
        results = await execute_single_tool(
            normalized_tool,
            tool_query,
            user_id=user_id,
            session_manager=session_manager,
        )
        if isinstance(results, dict):
            results = [results]
        if not isinstance(results, list):
            results = []

        return {
            "success": True,
            "tool": normalized_tool,
            "results": results,
            "errors": [],
            "metadata": {"query": tool_query},
        }
    except Exception as exc:
        return {
            "success": False,
            "tool": normalized_tool,
            "results": [],
            "errors": [str(exc)[:400]],
            "metadata": {"query": tool_query},
        }


def observe_tool_result(memory: AgentMemory, standard_result: dict):
    tool_name = standard_result.get("tool") or "unknown"
    results = standard_result.get("results") or []

    memory.raw_results.append(standard_result)

    for error in standard_result.get("errors") or []:
        memory.add_error("tool_error", f"{tool_name}: {error}")

    accepted = 0

    for item in results:
        if not isinstance(item, dict):
            continue

        lead = normalize_lead(item, tool_name)
        add_urls_to_memory(memory, lead, tool_name)
        scrape_debug = lead.get("scraping_debug")
        if scrape_debug:
            memory.add_scrape_debug(scrape_debug)
            if scrape_debug.get("requires_login"):
                platform = scrape_debug.get("platform") or lead.get("source", "").replace("profile_scraper_", "")
                memory.add_log(
                    "manual_login_required",
                    (
                        f"Connexion {platform} requise. Une fenetre navigateur s'est ouverte "
                        "si le mode local visible est actif. Connectez-vous une seule fois."
                    ),
                    platform=platform,
                )
            memory.add_log(
                "scrape_debug",
                (
                    f"URL={scrape_debug.get('url')} STATUS={scrape_debug.get('status')} "
                    f"TITLE={scrape_debug.get('title')} HTML={scrape_debug.get('html_length')} "
                    f"TEXT={scrape_debug.get('text_length')} LINKS={scrape_debug.get('links_count')} "
                    f"EMAILS={len(scrape_debug.get('emails') or [])} "
                    f"PHONES={len(scrape_debug.get('phones') or [])} "
                    f"BLOCKED={scrape_debug.get('blocked')} SCREENSHOT={scrape_debug.get('screenshot_path')}"
                ),
            )

        if tool_name in {"playwright_profile_scraper", "website_scraper"}:
            memory.crawled_pages.append(lead)

        if is_noise_lead(lead):
            lead["rejected_reason"] = lead.get("rejected_reason") or "noise_result"
            memory.rejected_results.append(lead)
            continue

        qualify_entity(lead, memory.intent or {})

        if not is_relevant_to_query(lead, memory.query, memory.intent or {}) and not lead.get("crm_ready"):
            lead["rejected_reason"] = lead.get("rejected_reason") or "irrelevant_to_query"
            memory.rejected_results.append(lead)
            continue

        accepted += 1

        if is_person(lead):
            add_or_merge_person(memory.persons, lead)
        elif is_company(lead):
            add_or_merge_company(memory.companies, lead)

    memory.refresh_prospects()
    memory.add_log(
        "observe",
        (
            f"{len(results)} resultats avec {tool_name}. "
            f"Acceptes={accepted}, Rejetes={len(memory.rejected_results)}, "
            f"Companies={len(memory.companies)}, Persons={len(memory.persons)}, "
            f"URLs={len(memory.discovered_urls)}"
        ),
    )


def pending_entity_snapshot(memory: AgentMemory) -> list[dict]:
    entities = []
    for item in memory.companies:
        if item.get("is_valid") is None:
            entities.append(item)
    for item in memory.persons:
        if item.get("is_valid") is None:
            entities.append(item)
    return entities


def apply_entity_analysis(memory: AgentMemory, entities: list[dict], analysis: dict):
    if analysis.get("gemini_error"):
        memory.add_error("analysis", analysis.get("gemini_error"))

    for result in analysis.get("entities") or []:
        index = result.get("index")
        if not isinstance(index, int) or index < 0 or index >= len(entities):
            continue

        entity = entities[index]
        entity.update(result.get("cleaned_data") or {})
        qualify_entity(entity, memory.intent or {})

        gemini_valid = bool(result.get("is_valid"))
        gemini_score = int(result.get("lead_score") or 0)
        if gemini_score > entity.get("lead_score", 0):
            entity["lead_score"] = gemini_score
            entity["score"] = gemini_score
            entity["score_ia"] = gemini_score

        entity["is_valid"] = gemini_valid or entity.get("crm_ready")
        entity["evaluation"] = result.get("evaluation") or entity.get("evaluation") or "cold"
        gemini_reason = result.get("reason") or ""
        if gemini_reason:
            entity["raison_score"] = f"{entity.get('raison_score') or ''}; Gemini: {gemini_reason}".strip("; ")

        if result.get("qualification_reasons"):
            entity["qualification_reasons"] = list(dict.fromkeys(
                (entity.get("qualification_reasons") or []) + result.get("qualification_reasons")
            ))
        if result.get("enrichment_status"):
            entity["enrichment_status"] = result.get("enrichment_status")

        entity["crm_ready"] = bool(entity.get("crm_ready") or (gemini_valid and entity.get("lead_score", 0) >= 60 and has_valid_contact_url(entity)))

        if not entity["is_valid"]:
            entity["rejected_reason"] = result.get("rejection_reason") or result.get("reason") or "gemini_rejected"
            memory.rejected_results.append(dict(entity))

    memory.refresh_prospects()
    analyzed_count = len(analysis.get("entities") or [])
    memory.add_log("analysis", f"{analyzed_count} entites analysees par Gemini.")

    if entities and analyzed_count == 0:
        memory.add_error("analysis", "Gemini n'a retourne aucune analyse exploitable.")


def default_limits(intent: dict) -> tuple[int, int, int, int]:
    max_leads = min(int((intent or {}).get("max_leads") or 10), 10)
    return 12, max_leads, 20, 4


async def run_agent(query: str, tenant_company_id: int, user_id: int) -> dict:
    memory = AgentMemory(query=query, company_id=tenant_company_id, user_id=user_id)
    brain = GeminiBrain()
    session_manager = SocialSessionManager(user_id)
    import_stats = {}

    memory.add_log("init", "Agent initialise")

    memory.set_phase("intent")
    memory.intent = await brain.extract_intent(query)
    memory.add_log("intent", f"Intent extrait: {memory.intent}")

    max_iterations, max_leads, max_urls, max_pages_per_domain = default_limits(memory.intent)
    memory.max_iterations = max_iterations
    memory.max_leads = max_leads
    memory.max_urls = max_urls
    memory.max_pages_per_domain = max_pages_per_domain

    try:
        while memory.iterations < max_iterations:
            memory.set_phase("decision")
            decision = await brain.decide_next_action(memory.to_summary())
            memory.add_decision(decision)

            action = decision.get("decision")

            if action == "use_tool":
                tool_name = normalize_tool_name(decision.get("tool"))
                tool_query = decision.get("query")

                if not tool_name or not tool_query:
                    memory.add_error("decision", "Decision use_tool incomplete.")
                    break

                if memory.already_used(tool_name, tool_query):
                    memory.add_log("skip", f"Tool deja utilise: {tool_name} | {tool_query}")
                    memory.iterations += 1
                    continue

                memory.add_tool_call(tool_name, tool_query, decision)
                memory.set_phase("searching")
                memory.add_log("act", f"Tool lance: {tool_name} | {tool_query}")
                tool_result = await execute_tool(
                    tool_name,
                    tool_query,
                    user_id=memory.user_id,
                    session_manager=session_manager,
                )
                observe_tool_result(memory, tool_result)

                if tool_name.startswith("serper_") and not tool_result.get("results"):
                    memory.add_log(
                        "search_empty",
                        "Aucun resultat. Gemini devra choisir une requete plus large ou une autre source.",
                    )

            elif action == "crawl_urls":
                tool_name = normalize_tool_name(decision.get("tool"))
                requested_urls = decision.get("target_urls") or [
                    item.get("url")
                    for item in memory.discovered_urls
                    if not item.get("crawled")
                ][:3]
                target_urls = allowed_target_urls(
                    memory,
                    requested_urls,
                    max_urls=max_urls,
                    max_pages_per_domain=max_pages_per_domain,
                )

                if tool_name not in {"playwright_profile_scraper", "website_scraper"}:
                    tool_name = "playwright_profile_scraper"

                memory.set_phase("crawling")

                for url in target_urls:
                    url_l = url.lower()
                    selected_tool = tool_name
                    if not any(domain in url_l for domain in SOCIAL_DOMAINS):
                        selected_tool = "website_scraper"
                    elif selected_tool == "website_scraper":
                        selected_tool = "playwright_profile_scraper"

                    memory.add_tool_call(selected_tool, url, decision)
                    memory.add_log("act", f"Crawl lance: {selected_tool} | {url}")
                    observe_tool_result(
                        memory,
                        await execute_tool(
                            selected_tool,
                            url,
                            user_id=memory.user_id,
                            session_manager=session_manager,
                        ),
                    )
                    mark_crawled(memory, url)

            elif action == "analyze_entities":
                entities = pending_entity_snapshot(memory)
                if not entities:
                    entities = memory.companies + memory.persons
                memory.set_phase("analysis")
                analysis = await brain.analyze_entities(entities, memory.to_summary())
                apply_entity_analysis(memory, entities, analysis)

            elif action == "import_crm":
                memory.set_phase("crm_import")
                companies, persons = memory.crm_ready_entities()
                companies = companies[:max_leads]
                persons = persons[:max_leads]
                if not companies and not persons:
                    memory.add_error("crm_import", "Gemini a demande import_crm sans entite crm_ready.")
                    entities = pending_entity_snapshot(memory) or (memory.companies + memory.persons)
                    analysis = await brain.analyze_entities(entities, memory.to_summary())
                    apply_entity_analysis(memory, entities, analysis)
                    memory.iterations += 1
                    continue

                import_stats = await import_leads_to_crm(
                    companies=companies,
                    persons=persons,
                    tenant_company_id=tenant_company_id,
                    user_id=user_id,
                )
                memory.stop_reason = "imported"
                break

            elif action == "stop":
                if decision.get("gemini_error"):
                    memory.add_error("gemini", decision.get("gemini_error"))
                memory.stop_reason = "stopped"
                break

            else:
                memory.add_error("decision", f"Decision inconnue: {action}")
                memory.stop_reason = "invalid_decision"
                break

            memory.iterations += 1

            total_ready = len(memory.crm_ready_entities()[0]) + len(memory.crm_ready_entities()[1])
            if total_ready >= max_leads and not any(not item.get("crawled") for item in memory.discovered_urls):
                memory.add_log("limit", "Max leads atteint et aucune URL en attente.")

    finally:
        await session_manager.close_all()

    if not import_stats and memory.stop_reason != "stopped" and (memory.companies or memory.persons):
        memory.set_phase("final_analysis")
        entities = pending_entity_snapshot(memory)
        if entities:
            analysis = await brain.analyze_entities(entities, memory.to_summary())
            apply_entity_analysis(memory, entities, analysis)

        memory.set_phase("crm_import")
        companies, persons = memory.crm_ready_entities()
        companies = companies[:max_leads]
        persons = persons[:max_leads]
        if companies or persons:
            import_stats = await import_leads_to_crm(
                companies=companies,
                persons=persons,
                tenant_company_id=tenant_company_id,
                user_id=user_id,
            )
            memory.stop_reason = memory.stop_reason or "imported"

    memory.set_phase("done")

    companies, persons = memory.crm_ready_entities()
    companies = companies[:max_leads]
    persons = persons[:max_leads]

    return {
        "companies_found": len(companies),
        "persons_found": len(persons),
        "iterations": memory.iterations,
        "stop_reason": memory.stop_reason or (memory.decision or {}).get("decision") or "stopped",
        "intent": memory.intent,
        "gemini_decisions": memory.gemini_decisions,
        "import_stats": import_stats,
        "prospect_companies": companies,
        "prospect_persons": persons,
        "discovered_urls": len(memory.discovered_urls),
        "crawled_pages": len(memory.crawled_pages),
        "scraping_debug": memory.scraping_debug,
        "scrape_debug_events": memory.scrape_debug_events[-10:],
        "rejected_results": len(memory.rejected_results),
        "errors": memory.errors,
        "logs": memory.logs,
    }
