import re
import time
import hashlib
import os
import unicodedata
from typing import Optional
from urllib.parse import urlparse, urlunparse

try:
    import requests
except ImportError:
    requests = None

try:
    from ddgs import DDGS
except ImportError:
    try:
        from duckduckgo_search import DDGS
    except ImportError:
        DDGS = None


# ─────────────────────────────────────────────────────────────────────────────
# Mots-clés qui NE PEUVENT PAS apparaître dans un vrai nom humain
# ─────────────────────────────────────────────────────────────────────────────
FAKE_NAME_TERMS = {
    "republique", "democratic", "democratique", "populaire", "royaume",
    "microsoft", "google", "apple", "amazon", "facebook", "instagram",
    "linkedin", "powerpoint", "excel", "word", "windows", "office",
    "surveillance", "critique", "autorise", "securite",
    "societe", "company", "sarl", "suarl", "groupe", "holding",
    "agence", "cabinet", "centre", "institut", "ecole", "universite",
    "association", "fondation", "ministere", "gouvernement",
    "nationale", "national", "international",
    "tunisie", "algerie", "maroc", "france",
    "profil", "page", "site", "web", "blog",
    "annuaire", "formation", "cours", "emploi", "recrutement",
    "rapport", "document", "fichier", "pdf", "presentation",
    "departement", "direction", "service", "division",
    "snus", "snusit",
}

# ─────────────────────────────────────────────────────────────────────────────
# Prénoms valides connus (Tunisie + France)
# ─────────────────────────────────────────────────────────────────────────────
KNOWN_FIRST_NAMES = {
    "ahmed", "mohamed", "ali", "omar", "youssef", "hamza", "amine",
    "mehdi", "bilel", "bilal", "sami", "wissem", "wassim", "aymen",
    "ayman", "karim", "tarek", "tariq", "hedi", "riadh", "nabil",
    "adel", "slim", "houssem", "chiheb", "montassar", "firas",
    "malek", "oussama", "zied", "imed", "lotfi", "habib", "hatem",
    "khaled", "walid", "bassem", "anis", "skander", "iskander",
    "ramzi", "hassen", "mounir", "fethi", "ridha", "mokhtar",
    "samir", "sofien", "sofiane", "marouane", "ghassen", "saber",
    "adem", "adam", "iyed", "rami", "anas", "seifeddine", "seif",
    "fedi", "ghazi", "nidhal", "ameur", "aziz", "faouzi", "naim",
    "emna", "fatma", "mariem", "meriem", "salma", "sana", "hana",
    "hanen", "amira", "rania", "rim", "nadia", "asma", "ines",
    "yosra", "yasmine", "lobna", "olfa", "hela", "sonia", "donia",
    "nour", "sarah", "sirine", "leila", "lilia", "manel", "wafa",
    "nesrine", "cyrine", "jihene", "jihen", "hajer", "maryem",
    "roua", "chaima", "khawla", "molka", "rihab", "oumaima",
    "ghofrane", "azza", "intissar", "amel", "ahlem", "dhouha",
    "abir", "afef", "dalel", "imen", "najet", "sawssen", "raoudha",
    "jean", "pierre", "paul", "marie", "sophie", "claire", "thomas",
    "nicolas", "julien", "antoine", "alexandre", "maxime", "lucas",
    "hugo", "lea", "emma", "camille", "julie", "laura", "marine",
    "aurelie", "stephanie", "charlotte", "alice", "anne", "marc",
    "philippe", "eric", "david", "michael", "patrick", "francois",
    "christian", "daniel", "laurent", "bernard", "claude", "rene",
    "adam", "sam", "ryan", "kevin", "brian", "jason", "jessica",
}


class SocialTool:
    GOOGLE_SEARCH_URL = "https://www.googleapis.com/customsearch/v1"
    SERPER_SEARCH_URL = "https://google.serper.dev/search"
    BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search"
    SEARCH_SLEEP_SECONDS = 0.4
    LINKEDIN_PROFILE_BLOCKED_PATHS = ("/posts/", "/pulse/", "/jobs/", "/company/", "/school/")
    NOISE_TERMS = {
        "annuaire", "directory", "pages jaunes", "liste", "classement",
        "meilleur", "meilleurs", "cours", "formation", "formations",
        "ecole", "universite", "faculte", "master", "diplome",
        "emploi", "job", "stage", "article", "blog", "forum", "pdf",
    }

    def __init__(
        self,
        google_search_api_key: str = "",
        google_cse_id: str = "",
        serper_api_key: str = "",
        brave_search_api_key: str = "",
    ):
        self.google_search_api_key = (
            google_search_api_key
            or os.getenv("GOOGLE_CUSTOM_SEARCH_API_KEY")
            or os.getenv("GOOGLE_CSE_API_KEY")
            or os.getenv("GOOGLE_SEARCH_API_KEY")
            or ""
        )
        self.google_cse_id = (
            google_cse_id
            or os.getenv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID")
            or os.getenv("GOOGLE_CSE_ID")
            or os.getenv("GOOGLE_CX")
            or ""
        )
        self.serper_api_key = (
            serper_api_key
            or os.getenv("SERPER_API_KEY")
            or os.getenv("SERPER_DEV_API_KEY")
            or ""
        )
        self.brave_search_api_key = (
            brave_search_api_key
            or os.getenv("BRAVE_SEARCH_API_KEY")
            or ""
        )
        self.search_trace: list[dict] = []

        print("\n" + "="*60)
        print("[SocialTool] INITIALISATION")
        print(f"  serper_key   : {'OK (' + self.serper_api_key[:6] + '...)' if self.serper_api_key else 'MANQUANT'}")
        print(f"  ddgs         : {'OK' if DDGS is not None else 'NON INSTALLE'}")
        print(f"  engines dispo: {self.available_search_engines()}")
        print("="*60 + "\n")

    # ─────────────────────────────────────────────────────────────────────
    # API publique
    # ─────────────────────────────────────────────────────────────────────

    def reset_trace(self) -> None:
        self.search_trace = []

    def get_trace(self) -> list[dict]:
        return list(self.search_trace)

    def available_search_engines(self) -> list[str]:
        engines = []
        if self.serper_api_key:
            engines.append("serper")
        if DDGS is not None:
            engines.append("duckduckgo")
        return engines

    def chercher(self, nom: str, ville: str, plateformes: list[str] | None = None) -> dict:
        enabled = set(plateformes or ["facebook", "instagram", "linkedin"])
        resultat = {
            "facebook_url": None, "instagram_url": None, "linkedin_url": None,
            "facebook_tel": None, "facebook_email": None,
            "facebook_bio": None, "instagram_bio": None, "linkedin_bio": None,
        }
        if "facebook" in enabled:
            resultat.update(self._chercher_plateforme("facebook", nom, ville))
        if "instagram" in enabled:
            resultat.update(self._chercher_plateforme("instagram", nom, ville))
        if "linkedin" in enabled:
            resultat.update(self._chercher_plateforme("linkedin", nom, ville))

        texte_social = " ".join(filter(None, [
            resultat.get("facebook_bio"),
            resultat.get("instagram_bio"),
            resultat.get("linkedin_bio"),
        ]))
        resultat["facebook_tel"] = self._tel(texte_social)
        resultat["facebook_email"] = self._email(texte_social)
        return resultat

    def rechercher_entreprises(self, secteur, ville, plateformes, max_resultats=10):
        companies = []
        for plateforme in plateformes:
            companies.extend(
                self._chercher_entreprises_plateforme(plateforme, secteur, ville, max_resultats)
            )
        return self._dedupe_entities(companies, limit=max_resultats)

    def rechercher_prospects(self, company, job_title, ville, seniority_level="", max_resultats=3):
        company_name = (
            company.get("nom") or company.get("name")
            or company.get("prospect_company_name") or ""
        )
        if not company_name or not job_title:
            print(f"[rechercher_prospects] SKIP — company_name='{company_name}' job_title='{job_title}'")
            return []

        print(f"\n[rechercher_prospects] company='{company_name}' job='{job_title}' ville='{ville}'")

        queries = self._linkedin_profile_queries(
            job_title=job_title,
            secteur=company.get("secteur") or "",
            ville=ville,
            company_name=company_name,
            seniority_level=seniority_level,
        )
        queries = self._mark_relaxed_queries(queries, strict_count=2)

        results = []
        seen_urls = set()
        for query in queries:
            if len(results) >= max_resultats:
                break
            relaxed = self._is_relaxed_query(query)
            raw_query = self._strip_relaxed_marker(query)
            items = self._web_search(raw_query, max_results=8)

            print(f"  [prospects] query={'RELAXED ' if relaxed else ''}'{raw_query[:80]}' -> {len(items)} items")

            for item in items:
                url = self._canonical_url(item.get("href") or "")
                title = item.get("title", "")
                if not self._is_linkedin_profile_url(url):
                    continue
                if url in seen_urls:
                    continue
                if not relaxed and not self._looks_related(company_name, ville, item, url, min_tokens=1):
                    continue
                if not relaxed and not self._job_matches(job_title, item):
                    continue

                prospect = self._prospect_from_linkedin_result(item, url, company_name, job_title)
                if not prospect:
                    continue
                seen_urls.add(url)
                print(f"    [OK] prospect: {prospect['first_name']} {prospect['last_name']} | {prospect['title']}")
                results.append(prospect)
                if len(results) >= max_resultats:
                    break

        self._record_pipeline_trace("linkedin_company_profile_candidates", len(results))
        print(f"  [rechercher_prospects] total: {len(results)}")
        return results

    def rechercher_profils_publics(self, job_title, secteur, ville, plateformes, max_resultats=10):
        enabled = set(plateformes or ["linkedin"])
        print(f"\n[rechercher_profils_publics] job='{job_title}' secteur='{secteur}' ville='{ville}' plateformes={list(enabled)}")
        results = []

        if "linkedin" in enabled:
            found = self._chercher_profils_plateforme("linkedin", job_title, secteur, ville, max_resultats)
            print(f"  [linkedin] {len(found)} profil(s) trouvé(s)")
            results.extend(found)
        if "facebook" in enabled:
            found = self._chercher_profils_plateforme("facebook", job_title, secteur, ville, max_resultats)
            print(f"  [facebook] {len(found)} profil(s) trouvé(s)")
            results.extend(found)
        if "instagram" in enabled:
            found = self._chercher_profils_plateforme("instagram", job_title, secteur, ville, max_resultats)
            print(f"  [instagram] {len(found)} profil(s) trouvé(s)")
            results.extend(found)
        if "website" in enabled:
            found = self._chercher_profils_web(job_title, secteur, ville, max_resultats)
            print(f"  [website] {len(found)} profil(s) trouvé(s)")
            results.extend(found)

        deduped = []
        seen = set()
        for prospect in results:
            key = (
                prospect.get("linkedin_url") or prospect.get("facebook_url")
                or prospect.get("instagram_url") or prospect.get("source_url")
            )
            key = key or f"{prospect.get('first_name')}:{prospect.get('last_name')}:{prospect.get('title')}"
            if key in seen:
                continue
            seen.add(key)
            deduped.append(prospect)
            if len(deduped) >= max_resultats:
                break

        print(f"  [rechercher_profils_publics] total après dédup: {len(deduped)}")
        return deduped

    def rechercher_createurs_contenu(
        self,
        niche: str,
        ville: str = "",
        plateforme: str = "instagram",
        max_resultats: int = 10,
    ) -> list[dict]:
        """
        Recherche spécialisée créateurs de contenu / influenceurs.
        """
        queries = self._createur_queries(niche, ville, plateforme)
        queries = self._mark_relaxed_queries(queries, strict_count=3)

        platform_config = {
            "instagram": {
                "domains": ["instagram.com/"],
                "url_key": "instagram_url",
                "blocked": ["/explore/", "/tags/", "/reel/", "/p/", "/stories/"],
            },
            "facebook": {
                "domains": ["facebook.com/"],
                "url_key": "facebook_url",
                "blocked": ["/groups/", "/events/", "/watch/", "/posts/", "/photos/"],
            },
        }
        cfg = platform_config.get(plateforme)
        if not cfg:
            return []

        results = []
        seen_urls = set()

        for query in queries:
            if len(results) >= max_resultats:
                break
            relaxed = self._is_relaxed_query(query)
            raw_query = self._strip_relaxed_marker(query)
            items = self._web_search(raw_query, max_results=10)

            print(f"  [createurs:{plateforme}] {'RELAXED ' if relaxed else ''}'{raw_query[:70]}' -> {len(items)} items")

            for item in items:
                url = self._canonical_url(item.get("href") or "")
                if not url or url in seen_urls:
                    continue
                if not any(d in url.lower() for d in cfg["domains"]):
                    continue
                if any(b in url.lower() for b in cfg["blocked"]):
                    continue

                handle = self._extract_handle(url, plateforme)
                if not handle:
                    continue

                title = item.get("title", "") or ""
                body = item.get("body", "") or ""

                name_candidate = self._clean_person_name(title.split("|")[0].split("-")[0])
                first_name, last_name = self._split_name(name_candidate)

                profile = {
                    cfg["url_key"]: url,
                    "source_url": url,
                    "origin": plateforme,
                    "title": niche,
                    "prospect_company_name": "",
                    "public_text": f"{title} {body}"[:800],
                    "evidence": f"Profil {plateforme} public : {title[:120]}",
                    "confidence": 0.65 if not relaxed else 0.45,
                    "email": self._email(f"{title} {body}") or "",
                    "phone": self._tel(f"{title} {body}") or "",
                }

                if first_name and last_name:
                    profile["first_name"] = first_name
                    profile["last_name"] = last_name
                else:
                    profile["first_name"] = handle
                    profile["last_name"] = ""

                seen_urls.add(url)
                results.append(profile)
                print(f"    [OK] {profile['first_name']} | {url[:55]}")

                if len(results) >= max_resultats:
                    break

        self._record_pipeline_trace(f"{plateforme}_creator_candidates", len(results))
        return results

    # ─────────────────────────────────────────────────────────────────────
    # Moteur de recherche avec logs
    # ─────────────────────────────────────────────────────────────────────

    def _web_search(self, query: str, max_results: int = 8) -> list[dict]:
        if self.serper_api_key:
            items = self._serper_search(query, max_results)
            if items:
                self._record_search_trace(query, "serper", len(items))
                return items

        if self.brave_search_api_key:
            items = self._brave_search(query, max_results)
            if items:
                self._record_search_trace(query, "brave", len(items))
                return items

        if self.google_search_api_key and self.google_cse_id:
            items = self._google_custom_search(query, max_results)
            if items:
                self._record_search_trace(query, "google_cse", len(items))
                return items

        items = self._duckduckgo_search(query, max_results)
        self._record_search_trace(query, "duckduckgo", len(items))
        return items

    def _google_custom_search(self, query: str, max_results: int) -> list[dict]:
        if requests is None or not self.google_search_api_key or not self.google_cse_id:
            return []
        try:
            response = requests.get(
                self.GOOGLE_SEARCH_URL,
                params={
                    "key": self.google_search_api_key,
                    "cx": self.google_cse_id,
                    "q": query,
                    "num": max(1, min(int(max_results), 10)),
                },
                timeout=10,
            )
            response.raise_for_status()
            payload = response.json()
            items = payload.get("items", [])
            print(f"  [GoogleCSE] '{query[:60]}' -> {len(items)} resultats")
            return [
                self._normalize_search_item({
                    "title": item.get("title", ""),
                    "href": item.get("link", ""),
                    "body": item.get("snippet", ""),
                }, source="google_custom_search")
                for item in items if item.get("link")
            ]
        except Exception as exc:
            print(f"  [GoogleCSE] ERREUR: {exc}")
            self._record_engine_error(query, "google_custom_search", exc)
            return []

    def _serper_search(self, query: str, max_results: int) -> list[dict]:
        if requests is None or not self.serper_api_key:
            return []
        try:
            response = requests.post(
                self.SERPER_SEARCH_URL,
                headers={
                    "X-API-KEY": self.serper_api_key,
                    "Content-Type": "application/json",
                },
                json={
                    "q": query,
                    "num": max(1, min(int(max_results), 10)),
                    "gl": "tn",
                    "hl": "fr",
                },
                timeout=10,
            )
            response.raise_for_status()
            payload = response.json()
        except Exception as exc:
            print(f"  [Serper] ERREUR: {exc}")
            self._record_engine_error(query, "serper", exc)
            return []

        results = []
        for item in payload.get("organic", []):
            if item.get("link"):
                results.append(self._normalize_search_item({
                    "title": item.get("title", ""),
                    "href": item.get("link", ""),
                    "body": item.get("snippet", ""),
                }, source="serper"))

        sitelinks = payload.get("sitelinks") or {}
        for item in sitelinks.get("inline", []) or []:
            if item.get("link"):
                results.append(self._normalize_search_item({
                    "title": item.get("title", ""),
                    "href": item.get("link", ""),
                    "body": "",
                }, source="serper_sitelinks"))

        print(f"  [Serper] '{query[:60]}' -> {len(results)} resultats (organic+sitelinks)")
        return results

    def _brave_search(self, query: str, max_results: int) -> list[dict]:
        if requests is None or not self.brave_search_api_key:
            return []
        try:
            response = requests.get(
                self.BRAVE_SEARCH_URL,
                headers={
                    "Accept": "application/json",
                    "X-Subscription-Token": self.brave_search_api_key,
                },
                params={
                    "q": query,
                    "count": max(1, min(int(max_results), 10)),
                    "country": "TN",
                    "search_lang": "fr",
                },
                timeout=10,
            )
            response.raise_for_status()
            payload = response.json()
            results_raw = (payload.get("web") or {}).get("results") or []
            print(f"  [Brave] '{query[:60]}' -> {len(results_raw)} resultats")
            return [
                self._normalize_search_item({
                    "title": item.get("title", ""),
                    "href": item.get("url", ""),
                    "body": item.get("description", ""),
                }, source="brave_search")
                for item in results_raw if item.get("url")
            ]
        except Exception as exc:
            print(f"  [Brave] ERREUR: {exc}")
            self._record_engine_error(query, "brave_search", exc)
            return []

    def _duckduckgo_search(self, query: str, max_results: int) -> list[dict]:
        if DDGS is None:
            print("  [DDG] NON DISPONIBLE — installe: pip install ddgs")
            return []

        clean_query = self._ddg_friendly_query(query)
        if clean_query != query:
            print(f"  [DDG] query transformée: '{clean_query[:70]}'")

        try:
            with DDGS() as ddg:
                items = list(ddg.text(clean_query, max_results=max_results))
            time.sleep(self.SEARCH_SLEEP_SECONDS)
            print(f"  [DDG] '{clean_query[:60]}' -> {len(items)} resultats")
            return [self._normalize_search_item(item, source="duckduckgo") for item in items]
        except Exception as exc:
            print(f"  [DDG] ERREUR: {exc}")
            self._record_engine_error(query, "duckduckgo", exc)
            return []

    def _ddg_friendly_query(self, query: str) -> str:
        if "site:linkedin.com/in" in query:
            clean = query.replace("site:linkedin.com/in", "").strip()
            return f"{clean} LinkedIn profil Tunisie"
        if "site:linkedin.com/company" in query:
            clean = query.replace("site:linkedin.com/company", "").strip()
            return f"{clean} LinkedIn entreprise Tunisie"
        if "site:facebook.com" in query:
            clean = query.replace("site:facebook.com", "").strip()
            return f"{clean} Facebook Tunisie"
        if "site:instagram.com" in query:
            clean = query.replace("site:instagram.com", "").strip()
            return f"{clean} Instagram Tunisie"
        return query

    # ─────────────────────────────────────────────────────────────────────
    # Validation du nom humain
    # ─────────────────────────────────────────────────────────────────────

    def _split_name(self, full_name: str) -> tuple[str, str]:
        parts = [p for p in full_name.strip().split() if p]
        if len(parts) < 2:
            print(f"    [_split_name] REJET (1 mot): '{full_name[:50]}'")
            return "", ""

        if len(parts) > 4:
            print(f"    [_split_name] REJET (>{4} mots): '{full_name[:50]}'")
            return "", ""

        if re.search(r"[@•()\[\]#%&*=+<>]", full_name):
            print(f"    [_split_name] REJET (caractères suspects): '{full_name[:50]}'")
            return "", ""

        if re.search(r"\d", full_name):
            print(f"    [_split_name] REJET (chiffres): '{full_name[:50]}'")
            return "", ""

        full_fp = self._fingerprint(full_name)
        all_words = full_fp.split()

        bad_word = next((w for w in all_words if w in FAKE_NAME_TERMS), None)
        if bad_word:
            print(f"    [_split_name] REJET (mot interdit '{bad_word}'): '{full_name[:50]}'")
            return "", ""

        first_clean = re.sub(r"[^a-zA-ZÀ-ÿ]", "", parts[0])
        last_raw = " ".join(parts[1:])
        last_clean = re.sub(r"[^a-zA-ZÀ-ÿ\- ]", "", last_raw)

        if not (2 <= len(first_clean) <= 14 and first_clean.isalpha()):
            print(f"    [_split_name] REJET (prénom invalide '{first_clean}'): '{full_name[:50]}'")
            return "", ""

        last_no_space = last_clean.replace(" ", "").replace("-", "")
        if not (2 <= len(last_no_space) <= 35 and last_no_space.isalpha()):
            print(f"    [_split_name] REJET (nom invalide '{last_clean}'): '{full_name[:50]}'")
            return "", ""

        first_lower = first_clean.lower()
        is_known = first_lower in KNOWN_FIRST_NAMES
        starts_with_capital = parts[0][0].isupper() if parts[0] else False

        if not is_known and not starts_with_capital:
            print(f"    [_split_name] REJET (prénom non reconnu + pas de majuscule): '{full_name[:50]}'")
            return "", ""

        last_words_fp = self._fingerprint(last_raw).split()
        bad_last = next((w for w in last_words_fp if w in FAKE_NAME_TERMS), None)
        if bad_last:
            print(f"    [_split_name] REJET (nom famille interdit '{bad_last}'): '{full_name[:50]}'")
            return "", ""

        print(f"    [_split_name] VALIDE: '{parts[0]} {last_raw}'")
        return parts[0], last_raw

    # ─────────────────────────────────────────────────────────────────────
    # Construction des prospects
    # ─────────────────────────────────────────────────────────────────────

    def _prospect_from_linkedin_result(self, item, url, company_name, requested_title):
        raw_title = item.get("title", "") or ""
        body = item.get("body", "") or ""

        title_parts = [p.strip() for p in re.split(r"\s[-|]\s", raw_title) if p.strip()]
        name_raw = self._clean_person_name(title_parts[0] if title_parts else raw_title)

        first_name, last_name = self._split_name(name_raw)
        if not first_name or not last_name:
            return None

        inferred_title = requested_title
        for part in title_parts[1:3]:
            clean_part = part.replace("LinkedIn", "").strip()
            if clean_part and self._job_matches(requested_title, {"title": clean_part, "body": body}):
                inferred_title = clean_part
                break

        return {
            "first_name": first_name,
            "last_name": last_name,
            "title": inferred_title,
            "email": self._email(f"{raw_title} {body}") or "",
            "phone": self._tel(f"{raw_title} {body}") or "",
            "linkedin_url": url,
            "origin": "linkedin",
            "prospect_company_name": company_name,
            "confidence": 0.65,
            "evidence": f'LinkedIn public "{company_name}": {raw_title} {body}'[:500],
            "public_text": f"{raw_title} {body}"[:1000],
        }

    def _prospect_from_public_result(self, item, url, url_key, requested_title, ville):
        raw_title = item.get("title", "") or ""
        body = item.get("body", "") or ""

        title_parts = [p.strip() for p in re.split(r"\s[-|]\s", raw_title) if p.strip()]
        name_raw = self._clean_person_name(title_parts[0] if title_parts else raw_title)

        first_name, last_name = self._split_name(name_raw)
        if not first_name or not last_name:
            return None

        inferred_title = requested_title
        for part in title_parts[1:3]:
            clean_part = (
                part.replace("LinkedIn", "").replace("Facebook", "")
                .replace("Instagram", "").strip()
            )
            if clean_part and self._job_matches(requested_title, {"title": clean_part, "body": body}):
                inferred_title = clean_part
                break

        company_name = ""
        for part in title_parts[1:4]:
            clean_part = (
                part.replace("LinkedIn", "").replace("Facebook", "")
                .replace("Instagram", "").strip(" -|")
            )
            if not clean_part or self._job_matches(requested_title, {"title": clean_part, "body": ""}):
                continue
            if self._contains_noise(clean_part):
                continue
            company_name = clean_part
            break

        origin = (
            "linkedin" if url_key == "linkedin_url"
            else "facebook" if url_key == "facebook_url"
            else "instagram" if url_key == "instagram_url"
            else "website"
        )
        prospect = {
            "first_name": first_name,
            "last_name": last_name,
            "title": inferred_title,
            "email": self._email(f"{raw_title} {body}") or "",
            "phone": self._tel(f"{raw_title} {body}") or "",
            url_key: url,
            "origin": origin,
            "city": ville,
            "country": "Tunisie",
            "prospect_company_name": company_name,
            "confidence": 0.55 if origin == "linkedin" else 0.45,
            "evidence": f"Public {origin}: {raw_title} {body}"[:500],
            "public_text": f"{raw_title} {body}"[:1000],
        }
        if url_key == "source_url":
            prospect["source_url"] = url
        return prospect

    # ─────────────────────────────────────────────────────────────────────
    # Recherche de profils par plateforme
    # ─────────────────────────────────────────────────────────────────────

    def _chercher_profils_plateforme(self, plateforme, job_title, secteur, ville, max_resultats):
        variants = self._job_title_variants(job_title or secteur)
        configs = {
            "linkedin": {
                "queries": self._linkedin_profile_queries(
                    job_title=job_title or secteur,
                    secteur=secteur,
                    ville=ville,
                ),
                "domains": ["linkedin.com/in/", "linkedin.com/pub/"],
                "url_key": "linkedin_url",
                "blocked_strict": ["/posts/", "/pulse/", "/jobs/", "/company/", "/school/"],
            },
            "facebook": {
                "queries": self._profile_queries("facebook", variants, secteur, ville),
                "domains": ["facebook.com/"],
                "url_key": "facebook_url",
                "blocked_strict": ["/groups/", "/events/", "/watch/"],
            },
            "instagram": {
                "queries": self._profile_queries("instagram", variants, secteur, ville),
                "domains": ["instagram.com/"],
                "url_key": "instagram_url",
                "blocked_strict": ["/explore/", "/tags/"],
            },
        }
        cfg = configs[plateforme]
        cfg["queries"] = self._mark_relaxed_queries(cfg["queries"], strict_count=2)
        results = []
        seen_urls = set()

        print(f"\n  [_chercher_profils_{plateforme}] {len(cfg['queries'])} requêtes à exécuter")

        for query in cfg["queries"]:
            if len(results) >= max_resultats:
                break
            relaxed = self._is_relaxed_query(query)
            raw_query = self._strip_relaxed_marker(query)
            items = self._web_search(raw_query, max_results=8)

            print(f"  [{plateforme}] {'RELAXED ' if relaxed else ''}query: '{raw_query[:70]}' -> {len(items)} items bruts")

            for item in items:
                url = self._canonical_url(item.get("href") or "")
                lower_url = url.lower()
                title = item.get("title", "")

                if url in seen_urls:
                    continue
                if not any(domain in lower_url for domain in cfg["domains"]):
                    continue
                if not relaxed and any(blocked in lower_url for blocked in cfg["blocked_strict"]):
                    continue
                if plateforme == "linkedin" and not self._is_linkedin_profile_url(url):
                    continue
                if not relaxed and self._is_noise_result(item, url):
                    continue
                if not relaxed and not self._job_matches(job_title or secteur, item):
                    continue
                if not self._looks_like_person_result(item, url, job_title, secteur, strict=not relaxed):
                    continue

                prospect = self._prospect_from_public_result(
                    item, url, cfg["url_key"], job_title or secteur, ville
                )
                if not prospect:
                    continue

                seen_urls.add(url)
                print(f"    [OK] {prospect['first_name']} {prospect['last_name']} | {prospect['title']} | {url[:50]}")
                results.append(prospect)
                if len(results) >= max_resultats:
                    break

        self._record_pipeline_trace(f"{plateforme}_profile_candidates", len(results))
        print(f"  [{plateforme}] TOTAL VALIDES: {len(results)}")
        return results

    def _chercher_entreprises_plateforme(self, plateforme, secteur, ville, max_resultats):
        configs = {
            "facebook": {
                "queries": self._company_queries("facebook", secteur, ville),
                "url_field": "facebook_url",
                "domains": ["facebook.com/"],
                "blocked_strict": ["/groups/", "/events/", "/watch/"],
            },
            "instagram": {
                "queries": self._company_queries("instagram", secteur, ville),
                "url_field": "instagram_url",
                "domains": ["instagram.com/"],
                "blocked_strict": ["/explore/", "/tags/"],
            },
            "linkedin": {
                "queries": self._company_queries("linkedin", secteur, ville),
                "url_field": "linkedin_url",
                "domains": ["linkedin.com/company/", "linkedin.com/school/", "linkedin.com/showcase/"],
                "blocked_strict": ["/jobs/"],
            },
        }
        if plateforme not in configs:
            return []

        cfg = configs[plateforme]
        results = []
        seen_urls = set()

        try:
            for index, query in enumerate(cfg["queries"]):
                if len(results) >= max_resultats:
                    break
                relaxed = index > 0
                items = self._web_search(query, max_results=max(max_resultats * 2, 8))
                for item in items:
                    url = self._canonical_url(item.get("href", ""))
                    lower_url = url.lower()
                    if url in seen_urls:
                        continue
                    if not any(domain in lower_url for domain in cfg["domains"]):
                        continue
                    if not relaxed and any(blocked in lower_url for blocked in cfg["blocked_strict"]):
                        continue
                    if not relaxed and self._is_noise_result(item, url):
                        continue
                    if not relaxed and not self._looks_related(secteur, ville, item, url, min_tokens=1):
                        continue
                    if relaxed and not self._has_minimal_business_signal(item, url, secteur, ville):
                        continue
                    title = self._clean_title(item.get("title", ""), relaxed=relaxed)
                    if not title:
                        continue
                    seen_urls.add(url)
                    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]
                    results.append({
                        "place_id": f"{plateforme}_{digest}",
                        "nom": title,
                        "secteur": secteur,
                        "ville": ville,
                        "country": "Tunisie",
                        "source": plateforme,
                        "source_url": url,
                        cfg["url_field"]: url,
                        f"{plateforme}_bio": f'{item.get("title", "")} {item.get("body", "")}'[:500],
                    })
                    if len(results) >= max_resultats:
                        break
        except Exception as exc:
            print(f"  [Social] Recherche entreprises {plateforme} erreur: {exc}")

        self._record_pipeline_trace(f"{plateforme}_company_candidates", len(results))
        return results

    def _chercher_plateforme(self, plateforme, nom, ville):
        configs = {
            "facebook": {
                "queries": [
                    f'site:facebook.com "{nom}" "{ville}"',
                    f'RELAXED::site:facebook.com "{nom}" Tunisie',
                    f'RELAXED::site:facebook.com "{nom}"',
                ],
                "url_key": "facebook_url", "bio_key": "facebook_bio",
                "domains": ["facebook.com/"],
                "blocked_strict": ["/groups/", "/events/", "/watch/"],
            },
            "instagram": {
                "queries": [
                    f'site:instagram.com "{nom}" "{ville}"',
                    f'RELAXED::site:instagram.com "{nom}" Tunisie',
                    f'RELAXED::site:instagram.com "{nom}"',
                ],
                "url_key": "instagram_url", "bio_key": "instagram_bio",
                "domains": ["instagram.com/"],
                "blocked_strict": ["/explore/", "/tags/"],
            },
            "linkedin": {
                "queries": [
                    f'site:linkedin.com/company "{nom}" "{ville}"',
                    f'RELAXED::site:linkedin.com/company "{nom}" Tunisie',
                    f'RELAXED::site:linkedin.com/school "{nom}" Tunisie',
                ],
                "url_key": "linkedin_url", "bio_key": "linkedin_bio",
                "domains": ["linkedin.com/company/", "linkedin.com/school/", "linkedin.com/showcase/"],
                "blocked_strict": ["/jobs/"],
            },
        }
        cfg = configs[plateforme]
        response = {cfg["url_key"]: None, cfg["bio_key"]: None}

        try:
            for query in cfg["queries"]:
                relaxed = self._is_relaxed_query(query)
                resultats = self._web_search(self._strip_relaxed_marker(query), max_results=5)
                for item in resultats:
                    url = self._canonical_url(item.get("href", ""))
                    lower_url = url.lower()
                    if not any(domain in lower_url for domain in cfg["domains"]):
                        continue
                    if not relaxed and any(blocked in lower_url for blocked in cfg["blocked_strict"]):
                        continue
                    if not relaxed and self._is_noise_result(item, url):
                        continue
                    if not relaxed and not self._looks_related(nom, ville, item, url, min_tokens=1):
                        continue
                    if relaxed and not self._has_minimal_business_signal(item, url, nom, ville):
                        continue
                    texte = f'{item.get("title", "")} {item.get("body", "")}'.strip()
                    response[cfg["url_key"]] = url
                    response[cfg["bio_key"]] = texte[:500]
                    break
                if response[cfg["url_key"]]:
                    break
        except Exception as exc:
            print(f"  [Social] Erreur {plateforme}: {exc}")

        return response

    def _chercher_profils_web(self, job_title, secteur, ville, max_resultats):
        variants = self._job_title_variants(job_title or secteur)[:3]
        industry = self._industry_variants(secteur)[:2]
        queries = []
        for variant in variants:
            parts = [f'"{variant}"']
            if industry:
                parts.append(f'"{industry[0]}"')
            if ville:
                parts.append(f'"{ville}"')
            parts.append("Tunisie contact email")
            queries.append(" ".join(parts))
            queries.append(f'"{variant}" "{ville}" company Tunisia')
        if secteur:
            queries.append(f'"{secteur}" "{ville}" equipe contact')
            queries.append(f'"{secteur}" "{ville}" RH manager')

        results = []
        seen_urls = set()
        for query in self._mark_relaxed_queries(queries, strict_count=2):
            if len(results) >= max_resultats:
                break
            relaxed = self._is_relaxed_query(query)
            for item in self._web_search(self._strip_relaxed_marker(query), max_results=8):
                url = self._canonical_url(item.get("href") or "")
                if not url or url in seen_urls:
                    continue
                if not relaxed and self._is_noise_result(item, url):
                    continue
                if not relaxed and not self._job_matches(job_title or secteur, item):
                    continue
                if not self._looks_like_person_result(item, url, job_title, secteur, strict=not relaxed):
                    continue
                prospect = self._prospect_from_public_result(
                    item, url, "source_url", job_title or secteur, ville
                )
                if not prospect:
                    continue
                seen_urls.add(url)
                results.append(prospect)
                if len(results) >= max_resultats:
                    break
        self._record_pipeline_trace("website_profile_candidates", len(results))
        return results

    # ─────────────────────────────────────────────────────────────────────
    # Génération des requêtes
    # ─────────────────────────────────────────────────────────────────────

    def _linkedin_profile_queries(self, job_title, secteur, ville, company_name="", seniority_level=""):
        title_variants = self._job_title_variants(job_title, seniority_level)[:5]
        industry_variants = self._industry_variants(secteur)[:3]
        queries = []

        if company_name:
            clean_company = self._clean_company_name(company_name)
            print(f"  [linkedin_queries] company nettoye: '{company_name[:40]}' -> '{clean_company}'")
            for variant in title_variants[:3]:
                queries.append(f'site:linkedin.com/in "{variant}" "{clean_company}" "{ville}"')
                queries.append(f'site:linkedin.com/in "{variant}" "{clean_company}"')
        else:
            for variant in title_variants:
                for industry in industry_variants[:2] or [""]:
                    parts = [f'site:linkedin.com/in "{variant}"']
                    if industry:
                        parts.append(f'"{industry}"')
                    if ville:
                        parts.append(f'"{ville}"')
                    parts.append("Tunisie")
                    queries.append(" ".join(parts))
                queries.append(f'site:linkedin.com/in "{variant}" "{ville}" Tunisie')
                queries.append(f'site:linkedin.com/in "{variant}" Tunisie')

        for variant in title_variants[:2]:
            if company_name:
                clean_company = self._clean_company_name(company_name)
                queries.append(f'"{variant}" "{clean_company}" LinkedIn')
            else:
                queries.append(f'"{variant}" "{ville}" LinkedIn profil Tunisie')

        return self._dedupe_strings(queries)[:4]

    def _clean_company_name(self, raw: str) -> str:
        clean = re.split(r"[\(@•]", raw)[0].strip()
        clean = re.sub(r"\s+(and|et|ou|or|•|\|).*$", "", clean, flags=re.IGNORECASE).strip()
        return clean

    def _job_title_variants(self, job_title, seniority_level=""):
        base = self._fingerprint(job_title)
        variants = [job_title.strip()]
        aliases = {
            "responsable rh": ["Responsable RH", "HR Manager", "Human Resources Manager", "Talent Acquisition", "People Manager", "DRH"],
            "ressources humaines": ["Responsable RH", "HR Manager", "Human Resources Manager", "Talent Acquisition", "DRH"],
            "human resources": ["Responsable RH", "HR Manager", "Human Resources Manager", "Talent Acquisition"],
            "rh": ["Responsable RH", "HR Manager", "Human Resources Manager", "Talent Acquisition", "DRH"],
            "hr": ["Responsable RH", "HR Manager", "Human Resources Manager", "Talent Acquisition"],
            "marketing": ["Responsable Marketing", "Marketing Manager", "Head of Marketing", "Digital Marketing Manager"],
            "commercial": ["Directeur Commercial", "Sales Manager", "Business Development Manager", "Responsable Commercial"],
            "sales": ["Directeur Commercial", "Sales Manager", "Business Development Manager"],
            "ceo": ["CEO", "Founder", "Co-Founder", "Directeur General", "DG", "PDG"],
            "cto": ["CTO", "Chief Technology Officer", "Directeur Technique"],
            "dentiste": ["Dentiste", "Chirurgien Dentiste", "Dental Surgeon", "Dentist"],
            "medecin": ["Medecin", "Docteur", "Doctor", "Physician"],
            "developpeur": ["Développeur", "Developer", "Software Engineer", "Ingénieur"],
        }
        for key, items in aliases.items():
            if key in base:
                variants.extend(items)
        if seniority_level:
            variants.append(f"{seniority_level} {job_title}".strip())

        deduped = []
        seen_lower = set()
        for v in variants:
            if v and v.lower() not in seen_lower:
                seen_lower.add(v.lower())
                deduped.append(v)
        return deduped

    def _industry_variants(self, secteur):
        base = self._fingerprint(secteur)
        variants = [secteur.strip()] if secteur else []
        aliases = {
            "it": ["IT", "informatique", "software", "technologie", "startup", "SaaS", "tech"],
            "informatique": ["informatique", "IT", "software", "technologie", "startup"],
            "hotel": ["hotel", "hotellerie", "hospitality", "tourisme"],
            "restaurant": ["restaurant", "restauration"],
            "marketing": ["marketing", "digital marketing", "communication"],
            "banque": ["banque", "banking", "finance"],
            "pharmacie": ["pharmacie", "pharmaceutical", "sante"],
        }
        for key, items in aliases.items():
            if key in base:
                variants.extend(items)
        return self._dedupe_strings(variants)

    def _company_queries(self, plateforme, secteur, ville):
        sites = {
            "facebook": ["site:facebook.com"],
            "instagram": ["site:instagram.com"],
            "linkedin": ["site:linkedin.com/company"],
        }.get(plateforme, [])
        industry_variants = self._industry_variants(secteur)[:3] or [secteur]
        queries = []
        for site in sites:
            for industry in industry_variants[:2]:
                queries.append(f'{site} "{industry}" "{ville}" Tunisie')
                queries.append(f'{site} "{industry}" "{ville}"')
            queries.append(f'{site} "{secteur}" entreprise "{ville}"')
        for industry in industry_variants[:2]:
            if plateforme == "linkedin":
                queries.append(f'"{industry}" "{ville}" LinkedIn entreprise Tunisie')
            elif plateforme == "facebook":
                queries.append(f'"{industry}" "{ville}" Facebook Tunisie')
            elif plateforme == "instagram":
                queries.append(f'"{industry}" "{ville}" Instagram Tunisie')
        return self._dedupe_strings(queries)[:3]

    def _profile_queries(self, plateforme, variants, secteur, ville):
        site = "site:facebook.com" if plateforme == "facebook" else "site:instagram.com"
        queries = []
        for variant in variants[:3]:
            queries.append(f'{site} "{variant}" "{ville}" Tunisie -annuaire -formation -cours')
            queries.append(f'{site} "{variant}" "{ville}"')
            queries.append(f'"{variant}" "{ville}" {plateforme.capitalize()} Tunisie')
        if secteur:
            queries.append(f'{site} "{secteur}" "{ville}" contact')
        return self._dedupe_strings(queries)

    def _createur_queries(self, niche: str, ville: str, plateforme: str) -> list[str]:
        site = f"site:{plateforme}.com"
        variants = self._creator_niche_variants(niche)
        queries = []
        for variant in variants[:4]:
            if ville:
                queries.append(f'{site} "{variant}" "{ville}" Tunisie')
            queries.append(f'{site} "{variant}" Tunisie')
            queries.append(f'{site} "{variant}" Tunisia')
        for variant in variants[:2]:
            if ville:
                queries.append(f'"{variant}" {plateforme} {ville} Tunisie')
            queries.append(f'influenceur "{variant}" Tunisie {plateforme}')
            queries.append(f'"{variant}" blogger Tunisie {plateforme}')
        return self._dedupe_strings(queries)

    def _creator_niche_variants(self, niche: str) -> list[str]:
        base = self._fingerprint(niche)
        variants = [niche.strip()] if niche else []
        aliases = {
            "cuisine":    ["food blogger", "foodblogger", "recette", "chef cuisinier",
                       "cuisine tunisienne", "food photography", "gastronomie"],
            "food":       ["food blogger", "foodblogger", "recette", "cuisine",
                       "food photography", "chef"],
            "recette":    ["food blogger", "recette cuisine", "chef cuisinier"],
            "sport":      ["coach fitness", "coach sportif", "musculation", "yoga",
                       "running", "football", "gym", "wellness"],
            "fitness":    ["coach fitness", "personal trainer", "musculation", "sport"],
            "beaute":     ["beauty blogger", "makeup artist", "maquillage", "skincare",
                       "influenceur beauté", "cosmétique"],
            "beauty":     ["beauty blogger", "makeup artist", "maquillage", "skincare"],
            "makeup":     ["makeup artist", "maquillage", "beauty blogger"],
            "voyage":     ["travel blogger", "bloggeur voyage", "aventure", "tourisme"],
            "travel":     ["travel blogger", "voyageur", "aventure"],
            "mode":       ["fashion blogger", "style", "tendance", "outfits", "mode"],
            "fashion":    ["fashion blogger", "style", "tendance"],
            "photo":      ["photographe", "photography", "photo professionnel"],
            "tech":       ["tech blogger", "informatique", "developer", "startup"],
            "business":   ["entrepreneur", "startup", "marketing digital"],
            "influenceur":["influenceur", "content creator", "créateur contenu",
                       "bloggeur", "blogger"],
            "blogger":    ["blogger", "bloggeur", "influenceur", "content creator"],
            "bloggeur":   ["bloggeur", "blogger", "influenceur", "créateur contenu"],
        }
        for key, values in aliases.items():
            if key in base:
                variants.extend(values)
        return self._dedupe_strings(variants)

    # ─────────────────────────────────────────────────────────────────────
    # Filtres de qualité
    # ─────────────────────────────────────────────────────────────────────

    def _looks_like_person_result(self, item, url, job_title, secteur, strict=True):
        title = item.get("title", "") or ""
        body = item.get("body", "") or ""

        name_part = re.split(r"\s[-|]\s", title)[0]
        name = self._clean_person_name(name_part)
        first_name, last_name = self._split_name(name)
        if not first_name or not last_name:
            return False

        text = self._fingerprint(f"{title} {body} {url}")
        expected = job_title or secteur
        if strict and expected and not self._job_matches(expected, item):
            return False

        blocked_name_terms = {"annuaire", "formation", "cours", "cabinet", "clinique", "centre", "page"}
        if strict and any(term in self._fingerprint(name) for term in blocked_name_terms):
            return False

        return bool(text)

    def _is_noise_result(self, item, url):
        identity = self._fingerprint(f'{item.get("title", "")} {url}')
        body = self._fingerprint(item.get("body", ""))
        hard_noise = {
            "annuaire", "directory", "pages jaunes", "cours", "formation",
            "universite", "faculte", "emploi", "job", "stage", "article", "blog", "forum", "pdf",
        }
        if any(self._fingerprint(term) in identity for term in hard_noise):
            return True
        severe_body = {"emploi", "job", "stage", "pdf"}
        return any(self._fingerprint(term) in body for term in severe_body)

    def _contains_noise(self, value):
        text = self._fingerprint(value)
        return any(self._fingerprint(term) in text for term in self.NOISE_TERMS)

    def _job_matches(self, job_title, item):
        haystack = self._fingerprint(f'{item.get("title", "")} {item.get("body", "")}')
        variants = self._job_title_variants(job_title)
        for variant in variants:
            tokens = [
                t for t in self._fingerprint(variant).split()
                if len(t) > 2 and t not in {"manager", "responsable", "directeur"}
            ]
            if not tokens and self._fingerprint(variant) in haystack:
                return True
            if tokens and any(t in haystack for t in tokens):
                return True
        return False

    def _has_minimal_business_signal(self, item, url, target, ville):
        text = self._fingerprint(f'{item.get("title", "")} {item.get("body", "")} {url}')
        target_tokens = [t for t in self._fingerprint(target).split() if len(t) > 2]
        city = self._fingerprint(ville)
        business_terms = {
            "contact", "adresse", "telephone", "societe", "entreprise",
            "company", "agence", "services", "sarl", "tunisie", "tunisia",
        }
        return (
            any(t in text for t in target_tokens)
            or bool(city and city in text)
            or any(t in text for t in business_terms)
        )

    def _looks_related(self, target, ville, item, url, min_tokens):
        haystack = self._fingerprint(f'{item.get("title", "")} {item.get("body", "")} {url}')
        target_tokens = [
            t for t in self._fingerprint(target).split()
            if len(t) > 2 and t not in {"tunisie", "tunis", "page", "officiel"}
        ]
        ville_token = self._fingerprint(ville)
        if not target_tokens:
            return bool(ville_token and ville_token in haystack)
        matches = sum(1 for t in target_tokens if t in haystack)
        required = min(min_tokens, len(target_tokens))
        return matches >= required or (matches >= 1 and ville_token and ville_token in haystack)

    def _is_linkedin_profile_url(self, url):
        parsed = urlparse(url)
        domain = parsed.netloc.lower().replace("www.", "")
        if not domain.endswith("linkedin.com"):
            return False
        path = parsed.path.lower()
        if any(blocked in path for blocked in self.LINKEDIN_PROFILE_BLOCKED_PATHS):
            return False
        parts = [p for p in path.split("/") if p]
        return len(parts) >= 2 and parts[0] in {"in", "pub"}

    def _extract_handle(self, url: str, plateforme: str) -> str:
        parsed = urlparse(url)
        parts = [p for p in parsed.path.strip("/").split("/") if p]
        if not parts:
            return ""
        handle = parts[0].lower()
        blocked_handles = {
            "explore", "tags", "reel", "p", "stories", "groups",
            "events", "watch", "posts", "login", "about", "pages",
            "help", "legal", "privacy", "terms",
        }
        return "" if handle in blocked_handles else handle

    # ─────────────────────────────────────────────────────────────────────
    # Utilitaires
    # ─────────────────────────────────────────────────────────────────────

    def _record_search_trace(self, query, engine, result_count):
        if "site:linkedin.com/in" in query or "linkedin.com/in" in query:
            source = "linkedin_public_index"
        elif "site:linkedin.com/company" in query:
            source = "linkedin_company_index"
        elif "site:facebook.com" in query or "facebook.com" in query:
            source = "facebook_public_index"
        elif "site:instagram.com" in query or "instagram.com" in query:
            source = "instagram_public_index"
        else:
            source = "web_public_index"
        self.search_trace.append({"source": source, "engine": engine, "query": query, "result_count": result_count})

    def _record_pipeline_trace(self, source, result_count):
        self.search_trace.append({"source": source, "engine": "local_filter", "query": source, "result_count": result_count})

    def _record_engine_error(self, query, engine, exc):
        self.search_trace.append({"source": "search_engine_error", "engine": engine, "query": query, "result_count": 0, "error": str(exc)[:240]})

    def _normalize_search_item(self, item, source):
        return {
            "title": item.get("title", "") or "",
            "href": self._canonical_url(item.get("href") or item.get("link") or ""),
            "body": item.get("body") or item.get("snippet") or "",
            "search_source": source,
        }

    def _clean_title(self, title, relaxed=False):
        if not relaxed and self._contains_noise(title):
            return ""
        title = re.sub(r"\s+\|\s+.*$", "", title or "")
        title = re.sub(r"\s+-\s+.*$", "", title)
        title = title.replace("Facebook", "").replace("Instagram", "").replace("LinkedIn", "")
        title = re.sub(r"\b(Page|Profile|Profil|Photos|Videos|Reels)\b", "", title, flags=re.IGNORECASE)
        return title.strip(" -|")

    def _clean_person_name(self, value):
        text = re.sub(r"\s+\|\s+.*$", "", value or "")
        text = re.sub(r"\s+-\s+.*$", "", text)
        text = re.sub(r"\s*,\s+.*$", "", text)
        text = re.sub(r"\(@[^)]+\)", "", text)
        text = re.sub(r"•.*$", "", text)
        text = text.replace("LinkedIn", "").replace("Facebook", "").replace("Instagram", "")
        text = re.sub(r"\b(profile|profil)\b", "", text, flags=re.IGNORECASE)
        return text.strip(" -|")

    def _dedupe_strings(self, values):
        deduped, seen = [], set()
        for v in values:
            text = str(v or "").strip()
            key = self._fingerprint(text)
            if not text or key in seen:
                continue
            seen.add(key)
            deduped.append(text)
        return deduped

    def _dedupe_entities(self, values, limit):
        deduped, seen = [], set()
        for item in values:
            key = (
                item.get("linkedin_url") or item.get("facebook_url")
                or item.get("instagram_url") or item.get("source_url")
                or item.get("site_web")
            )
            key = key or self._fingerprint(f"{item.get('nom')} {item.get('ville')}")
            if not key or key in seen:
                continue
            seen.add(key)
            deduped.append(item)
            if len(deduped) >= limit:
                break
        return deduped

    def _mark_relaxed_queries(self, queries, strict_count=1):
        marked = []
        for i, q in enumerate(self._dedupe_strings(queries)):
            marked.append(q if i < strict_count else f"RELAXED::{q}")
        return marked

    def _is_relaxed_query(self, query):
        return str(query or "").startswith("RELAXED::")

    def _strip_relaxed_marker(self, query):
        return str(query or "").replace("RELAXED::", "", 1)

    def _tel(self, texte):
        for pattern in [r"\+216\s*\d{2}\s*\d{3}\s*\d{3}", r"\b[24579]\d\s*\d{3}\s*\d{3}\b", r"\b[24579]\d{7}\b"]:
            match = re.search(pattern, texte)
            if match:
                return re.sub(r"\s+", " ", match.group(0)).strip()
        return None

    def _email(self, texte):
        match = re.search(r"\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b", texte)
        if not match:
            return None
        email = match.group(0).lower()
        return None if "noreply" in email or "example.com" in email else email

    def _canonical_url(self, value):
        url = str(value or "").strip().rstrip(".,)")
        if not url:
            return ""
        if url.startswith("//"):
            url = f"https:{url}"
        elif url.startswith("www."):
            url = f"https://{url}"
        if not url.startswith(("http://", "https://")):
            return url
        parsed = urlparse(url)
        netloc = parsed.netloc.lower()
        path = re.sub(r"/+", "/", parsed.path).rstrip("/")
        return urlunparse(("https", netloc, path, "", "", ""))

    def _fingerprint(self, value):
        text = unicodedata.normalize("NFKD", str(value or ""))
        text = "".join(c for c in text if not unicodedata.combining(c))
        text = re.sub(r"[^a-zA-Z0-9]+", " ", text).lower()
        return " ".join(text.split())