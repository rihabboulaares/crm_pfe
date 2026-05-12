import re
import time
import hashlib
import unicodedata
from typing import Optional

try:
    from ddgs import DDGS
except ImportError:
    from duckduckgo_search import DDGS


class SocialTool:
    """

    NOISE_TERMS = {
        "annuaire",
        "directory",
        "pages jaunes",
        "liste",
        "classement",
        "meilleur",
        "meilleurs",
        "cours",
        "formation",
        "formations",
        "ecole",
        "universite",
        "faculte",
        "master",
        "diplome",
        "emploi",
        "recrutement",
        "job",
        "stage",
        "article",
        "blog",
        "forum",
        "pdf",
    }
    Decouverte gratuite de liens publics.

    Important: on ne se connecte pas a Facebook/Instagram/LinkedIn et on ne
    scrape pas leurs pages. On recupere seulement les URLs et snippets visibles
    dans les resultats DuckDuckGo.
    """

    def chercher(self, nom: str, ville: str, plateformes: list[str] | None = None) -> dict:
        enabled = set(plateformes or ["facebook", "instagram", "linkedin"])
        resultat = {
            "facebook_url": None,
            "instagram_url": None,
            "linkedin_url": None,
            "facebook_tel": None,
            "facebook_email": None,
            "facebook_bio": None,
            "instagram_bio": None,
            "linkedin_bio": None,
        }

        if "facebook" in enabled:
            resultat.update(self._chercher_plateforme("facebook", nom, ville))
        if "instagram" in enabled:
            resultat.update(self._chercher_plateforme("instagram", nom, ville))
        if "linkedin" in enabled:
            resultat.update(self._chercher_plateforme("linkedin", nom, ville))

        texte_social = " ".join(
            filter(
                None,
                [
                    resultat.get("facebook_bio"),
                    resultat.get("instagram_bio"),
                    resultat.get("linkedin_bio"),
                ],
            )
        )
        resultat["facebook_tel"] = self._tel(texte_social)
        resultat["facebook_email"] = self._email(texte_social)
        return resultat

    def rechercher_entreprises(
        self,
        secteur: str,
        ville: str,
        plateformes: list[str],
        max_resultats: int = 10,
    ) -> list[dict]:
        companies = []
        for plateforme in plateformes:
            companies.extend(self._chercher_entreprises_plateforme(plateforme, secteur, ville, max_resultats))
        return companies[:max_resultats]

    def rechercher_prospects(
        self,
        company: dict,
        job_title: str,
        ville: str,
        seniority_level: str = "",
        max_resultats: int = 3,
    ) -> list[dict]:
        """
        Recherche des profils professionnels publics lies a une entreprise.

        La methode utilise uniquement les resultats indexes par le moteur de
        recherche. Elle ne se connecte pas a LinkedIn et ne visite pas les
        profils prives.
        """
        company_name = company.get("nom") or company.get("name") or company.get("prospect_company_name") or ""
        if not company_name or not job_title:
            return []

        title_variants = self._job_title_variants(job_title, seniority_level)
        queries = [
            f'site:linkedin.com/in "{variant}" "{company_name}" "{ville}"'
            for variant in title_variants[:4]
        ]
        queries.append(f'site:linkedin.com/in "{job_title}" "{company_name}" Tunisie')

        results = []
        seen_urls = set()
        for query in queries:
            if len(results) >= max_resultats:
                break
            try:
                with DDGS() as ddg:
                    items = list(ddg.text(query, max_results=6))
                time.sleep(0.8)
            except Exception as exc:
                print(f"  [Social] Recherche prospects LinkedIn erreur: {exc}")
                continue

            for item in items:
                url = (item.get("href") or "").rstrip(".,)")
                lower_url = url.lower()
                if "linkedin.com/in/" not in lower_url:
                    continue
                if any(blocked in lower_url for blocked in ["/posts/", "/pulse/", "/jobs/", "/company/"]):
                    continue
                if url in seen_urls:
                    continue
                if not self._looks_related(company_name, ville, item, url, min_tokens=1):
                    continue
                if not self._job_matches(job_title, item):
                    continue

                prospect = self._prospect_from_linkedin_result(item, url, company_name, job_title)
                if not prospect:
                    continue
                seen_urls.add(url)
                results.append(prospect)
                if len(results) >= max_resultats:
                    break

        return results

    def rechercher_profils_publics(
        self,
        job_title: str,
        secteur: str,
        ville: str,
        plateformes: list[str],
        max_resultats: int = 10,
    ) -> list[dict]:
        enabled = set(plateformes or ["linkedin"])
        results = []

        if "linkedin" in enabled:
            results.extend(self._chercher_profils_plateforme("linkedin", job_title, secteur, ville, max_resultats))
        if "facebook" in enabled:
            results.extend(self._chercher_profils_plateforme("facebook", job_title, secteur, ville, max_resultats))
        if "instagram" in enabled:
            results.extend(self._chercher_profils_plateforme("instagram", job_title, secteur, ville, max_resultats))

        deduped = []
        seen = set()
        for prospect in results:
            key = prospect.get("linkedin_url") or prospect.get("facebook_url") or prospect.get("instagram_url")
            key = key or f"{prospect.get('first_name')}:{prospect.get('last_name')}:{prospect.get('title')}"
            if key in seen:
                continue
            seen.add(key)
            deduped.append(prospect)
            if len(deduped) >= max_resultats:
                break
        return deduped

    def _chercher_entreprises_plateforme(
        self,
        plateforme: str,
        secteur: str,
        ville: str,
        max_resultats: int,
    ) -> list[dict]:
        configs = {
            "facebook": {
                "query": f'site:facebook.com "{secteur}" "{ville}" Tunisie',
                "url_field": "facebook_url",
                "must_contain": "facebook.com/",
                "blocked": ["/posts/", "/photos/", "/videos/", "/reel/", "/share/"],
            },
            "instagram": {
                "query": f'site:instagram.com "{secteur}" "{ville}" Tunisie',
                "url_field": "instagram_url",
                "must_contain": "instagram.com/",
                "blocked": ["/p/", "/reel/", "/explore/", "/tags/"],
            },
            "linkedin": {
                "query": f'site:linkedin.com/company "{secteur}" "{ville}" Tunisie',
                "url_field": "linkedin_url",
                "must_contain": "linkedin.com/company/",
                "blocked": ["/posts/", "/pulse/", "/jobs/"],
            },
        }
        if plateforme not in configs:
            return []

        cfg = configs[plateforme]
        results = []

        try:
            with DDGS() as ddg:
                items = list(ddg.text(cfg["query"], max_results=max_resultats))
            time.sleep(0.8)

            for item in items:
                url = item.get("href", "")
                lower_url = url.lower()
                if cfg["must_contain"] not in lower_url:
                    continue
                if any(blocked in lower_url for blocked in cfg["blocked"]):
                    continue
                if self._is_noise_result(item, url):
                    continue
                if not self._looks_related(secteur, ville, item, url, min_tokens=1):
                    continue

                title = self._clean_title(item.get("title", ""))
                if not title:
                    continue

                digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]
                results.append(
                    {
                        "place_id": f"{plateforme}_{digest}",
                        "nom": title,
                        "secteur": secteur,
                        "ville": ville,
                        "country": "Tunisie",
                        "source": plateforme,
                        "source_url": url.rstrip(".,)"),
                        cfg["url_field"]: url.rstrip(".,)"),
                        f"{plateforme}_bio": f'{item.get("title", "")} {item.get("body", "")}'[:300],
                    }
                )
        except Exception as exc:
            print(f"  [Social] Recherche entreprises {plateforme} erreur: {exc}")

        return results

    def _clean_title(self, title: str) -> str:
        if self._contains_noise(title):
            return ""
        title = re.sub(r"\s+\|\s+.*$", "", title or "")
        title = re.sub(r"\s+-\s+.*$", "", title)
        title = title.replace("Facebook", "").replace("Instagram", "").replace("LinkedIn", "")
        return title.strip(" -|")

    def _job_title_variants(self, job_title: str, seniority_level: str = "") -> list[str]:
        base = self._fingerprint(job_title)
        variants = [job_title.strip()]
        aliases = {
            "responsable rh": ["Responsable RH", "HR Manager", "Human Resources Manager", "Talent Acquisition"],
            "rh": ["Responsable RH", "HR Manager", "Talent Acquisition", "People Manager"],
            "marketing": ["Responsable Marketing", "Marketing Manager", "Head of Marketing", "Digital Marketing Manager"],
            "commercial": ["Directeur Commercial", "Sales Manager", "Business Development Manager"],
            "achat": ["Responsable Achat", "Purchasing Manager", "Procurement Manager"],
            "ceo": ["CEO", "Founder", "Co-Founder", "Directeur General"],
            "dentiste": ["Dentiste", "Chirurgien Dentiste", "Dental Surgeon", "Dentist", "Docteur Dentiste"],
            "chirurgien dentiste": ["Chirurgien Dentiste", "Dentiste", "Dental Surgeon", "Dentist"],
            "medecin": ["Medecin", "Docteur", "Doctor", "Physician"],
        }
        for key, items in aliases.items():
            if key in base:
                variants.extend(items)
        if seniority_level:
            variants.append(f"{seniority_level} {job_title}".strip())
        deduped = []
        for variant in variants:
            if variant and variant.lower() not in [item.lower() for item in deduped]:
                deduped.append(variant)
        return deduped

    def _job_matches(self, job_title: str, item: dict) -> bool:
        haystack = self._fingerprint(f'{item.get("title", "")} {item.get("body", "")}')
        variants = self._job_title_variants(job_title)
        for variant in variants:
            tokens = [
                token
                for token in self._fingerprint(variant).split()
                if len(token) > 2 and token not in {"manager", "responsable", "directeur"}
            ]
            if not tokens and self._fingerprint(variant) in haystack:
                return True
            if tokens and any(token in haystack for token in tokens):
                return True
        return False

    def _prospect_from_linkedin_result(
        self,
        item: dict,
        url: str,
        company_name: str,
        requested_title: str,
    ) -> Optional[dict]:
        raw_title = item.get("title", "") or ""
        body = item.get("body", "") or ""
        title_parts = [part.strip() for part in re.split(r"\s[-|]\s", raw_title) if part.strip()]
        name = self._clean_person_name(title_parts[0] if title_parts else raw_title)
        first_name, last_name = self._split_name(name)
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
            "linkedin_url": url,
            "origin": "linkedin",
            "prospect_company_name": company_name,
            "confidence": 0.65,
            "evidence": f'Resultat LinkedIn public lie a "{company_name}": {raw_title} {body}'[:500],
            "public_text": f"{raw_title} {body}"[:1000],
        }

    def _clean_person_name(self, value: str) -> str:
        text = re.sub(r"\s+\|\s+.*$", "", value or "")
        text = re.sub(r"\s+-\s+.*$", "", text)
        text = text.replace("LinkedIn", "")
        text = re.sub(r"\b(profile|profil)\b", "", text, flags=re.IGNORECASE)
        return text.strip(" -|")

    def _split_name(self, full_name: str) -> tuple[str, str]:
        parts = [part for part in full_name.strip().split() if part]
        if len(parts) < 2:
            return "", ""
        return parts[0], " ".join(parts[1:])

    def _chercher_profils_plateforme(
        self,
        plateforme: str,
        job_title: str,
        secteur: str,
        ville: str,
        max_resultats: int,
    ) -> list[dict]:
        variants = self._job_title_variants(job_title or secteur)
        configs = {
            "linkedin": {
                "queries": [
                    f'site:linkedin.com/in "{variant}" "{ville}" Tunisie -annuaire -formation -cours'
                    for variant in variants[:4]
                ],
                "must_contain": "linkedin.com/in/",
                "url_key": "linkedin_url",
                "blocked": ["/posts/", "/pulse/", "/jobs/", "/company/", "/school/"],
            },
            "facebook": {
                "queries": [
                    f'site:facebook.com "{variant}" "{ville}" Tunisie -annuaire -formation -cours'
                    for variant in variants[:3]
                ],
                "must_contain": "facebook.com/",
                "url_key": "facebook_url",
                "blocked": ["/posts/", "/photos/", "/videos/", "/reel/", "/share/", "/groups/", "/events/"],
            },
            "instagram": {
                "queries": [
                    f'site:instagram.com "{variant}" "{ville}" Tunisie -annuaire -formation -cours'
                    for variant in variants[:3]
                ],
                "must_contain": "instagram.com/",
                "url_key": "instagram_url",
                "blocked": ["/p/", "/reel/", "/explore/", "/tags/"],
            },
        }
        cfg = configs[plateforme]
        results = []

        for query in cfg["queries"]:
            if len(results) >= max_resultats:
                break
            try:
                with DDGS() as ddg:
                    items = list(ddg.text(query, max_results=6))
                time.sleep(0.8)
            except Exception as exc:
                print(f"  [Social] Recherche profils {plateforme} erreur: {exc}")
                continue

            for item in items:
                url = (item.get("href") or "").rstrip(".,)")
                lower_url = url.lower()
                if cfg["must_contain"] not in lower_url:
                    continue
                if any(blocked in lower_url for blocked in cfg["blocked"]):
                    continue
                if self._is_noise_result(item, url):
                    continue
                if not self._job_matches(job_title or secteur, item):
                    continue
                if not self._looks_like_person_result(item, url, job_title, secteur):
                    continue

                prospect = self._prospect_from_public_result(item, url, cfg["url_key"], job_title or secteur, ville)
                if not prospect:
                    continue
                results.append(prospect)
                if len(results) >= max_resultats:
                    break

        return results

    def _prospect_from_public_result(
        self,
        item: dict,
        url: str,
        url_key: str,
        requested_title: str,
        ville: str,
    ) -> Optional[dict]:
        raw_title = item.get("title", "") or ""
        body = item.get("body", "") or ""
        title_parts = [part.strip() for part in re.split(r"\s[-|]\s", raw_title) if part.strip()]
        name = self._clean_person_name(title_parts[0] if title_parts else raw_title)
        first_name, last_name = self._split_name(name)
        if not first_name or not last_name:
            return None

        origin = "linkedin" if url_key == "linkedin_url" else "facebook" if url_key == "facebook_url" else "instagram"
        return {
            "first_name": first_name,
            "last_name": last_name,
            "title": requested_title,
            url_key: url,
            "origin": origin,
            "city": ville,
            "country": "Tunisie",
            "confidence": 0.55 if origin == "linkedin" else 0.45,
            "evidence": f"Resultat public {origin}: {raw_title} {body}"[:500],
            "public_text": f"{raw_title} {body}"[:1000],
        }

    def _chercher_plateforme(self, plateforme: str, nom: str, ville: str) -> dict:
        configs = {
            "facebook": {
                "query": f'site:facebook.com "{nom}" "{ville}"',
                "url_key": "facebook_url",
                "bio_key": "facebook_bio",
                "must_contain": "facebook.com/",
                "blocked": ["/posts/", "/photos/", "/videos/", "/reel/", "/share/"],
            },
            "instagram": {
                "query": f'site:instagram.com "{nom}" "{ville}"',
                "url_key": "instagram_url",
                "bio_key": "instagram_bio",
                "must_contain": "instagram.com/",
                "blocked": ["/p/", "/reel/", "/explore/", "/tags/"],
            },
            "linkedin": {
                "query": f'site:linkedin.com/company "{nom}" "{ville}"',
                "url_key": "linkedin_url",
                "bio_key": "linkedin_bio",
                "must_contain": "linkedin.com/company/",
                "blocked": ["/posts/", "/pulse/", "/jobs/"],
            },
        }
        cfg = configs[plateforme]
        response = {cfg["url_key"]: None, cfg["bio_key"]: None}

        try:
            print(f"  [Social] {plateforme} : {nom}")
            with DDGS() as ddg:
                resultats = list(ddg.text(cfg["query"], max_results=3))

            time.sleep(0.8)

            for item in resultats:
                url = item.get("href", "")
                lower_url = url.lower()
                if cfg["must_contain"] not in lower_url:
                    continue
                if any(blocked in lower_url for blocked in cfg["blocked"]):
                    continue
                if self._is_noise_result(item, url):
                    continue
                if not self._looks_related(nom, ville, item, url, min_tokens=2):
                    continue

                texte = f'{item.get("title", "")} {item.get("body", "")}'.strip()
                response[cfg["url_key"]] = url.rstrip(".,)")
                response[cfg["bio_key"]] = texte[:300]
                break
        except Exception as exc:
            print(f"  [Social] Erreur {plateforme} : {exc}")

        return response

    def _tel(self, texte: str) -> Optional[str]:
        patterns = [
            r"\+216\s*\d{2}\s*\d{3}\s*\d{3}",
            r"\b[24579]\d\s*\d{3}\s*\d{3}\b",
            r"\b[24579]\d{7}\b",
        ]
        for pattern in patterns:
            match = re.search(pattern, texte)
            if match:
                return re.sub(r"\s+", " ", match.group(0)).strip()
        return None

    def _email(self, texte: str) -> Optional[str]:
        match = re.search(r"\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b", texte)
        if not match:
            return None
        email = match.group(0).lower()
        if "noreply" in email or "example.com" in email:
            return None
        return email

    def _is_noise_result(self, item: dict, url: str) -> bool:
        text = self._fingerprint(f'{item.get("title", "")} {item.get("body", "")} {url}')
        return any(self._fingerprint(term) in text for term in self.NOISE_TERMS)

    def _contains_noise(self, value: str) -> bool:
        text = self._fingerprint(value)
        return any(self._fingerprint(term) in text for term in self.NOISE_TERMS)

    def _looks_like_person_result(self, item: dict, url: str, job_title: str, secteur: str) -> bool:
        title = item.get("title", "") or ""
        body = item.get("body", "") or ""
        text = self._fingerprint(f"{title} {body} {url}")
        expected = job_title or secteur
        if expected and not self._job_matches(expected, item):
            return False
        name_part = re.split(r"\s[-|]\s", title)[0]
        name = self._clean_person_name(name_part)
        first_name, last_name = self._split_name(name)
        if not first_name or not last_name:
            return False
        blocked_name_terms = {"annuaire", "formation", "cours", "cabinet", "clinique", "centre", "page"}
        if any(term in self._fingerprint(name) for term in blocked_name_terms):
            return False
        return bool(text)

    def _looks_related(
        self,
        target: str,
        ville: str,
        item: dict,
        url: str,
        min_tokens: int,
    ) -> bool:
        haystack = self._fingerprint(
            f'{item.get("title", "")} {item.get("body", "")} {url}'
        )
        target_tokens = [
            token
            for token in self._fingerprint(target).split()
            if len(token) > 2 and token not in {"tunisie", "tunis", "page", "officiel"}
        ]
        ville_token = self._fingerprint(ville)

        if not target_tokens:
            return bool(ville_token and ville_token in haystack)

        matches = sum(1 for token in target_tokens if token in haystack)
        required = min(min_tokens, len(target_tokens))
        return matches >= required or (matches >= 1 and ville_token and ville_token in haystack)

    def _fingerprint(self, value: str) -> str:
        text = unicodedata.normalize("NFKD", str(value or ""))
        text = "".join(char for char in text if not unicodedata.combining(char))
        text = re.sub(r"[^a-zA-Z0-9]+", " ", text).lower()
        return " ".join(text.split())
