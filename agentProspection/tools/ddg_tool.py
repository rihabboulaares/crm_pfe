import hashlib
import re
import time
import unicodedata
from typing import Optional
from urllib.parse import urlparse

try:
    from ddgs import DDGS
except ImportError:
    from duckduckgo_search import DDGS


class DDGTool:
    NOISE_TERMS = {
        "annuaire",
        "directory",
        "pages jaunes",
        "page jaune",
        "liste",
        "top ",
        "classement",
        "meilleur",
        "meilleurs",
        "cours",
        "formation",
        "formations",
        "ecole",
        "école",
        "universite",
        "université",
        "faculte",
        "faculté",
        "master",
        "diplome",
        "diplôme",
        "certificat",
        "emploi",
        "recrutement",
        "job",
        "stage",
        "article",
        "blog",
        "forum",
        "pdf",
        "wikipedia",
    }

    """
    Enrichissement web gratuit via DuckDuckGo.

    On ne scrape pas les sites trouves. On utilise seulement les titres,
    extraits et URLs retournes par le moteur.
    """

    def rechercher_entreprises(self, secteur: str, ville: str, max_resultats: int = 10) -> list[dict]:
        """Decouvre des entreprises via resultats web publics, sans scraper les sites."""
        companies = []
        seen_urls = set()

        for index, query in enumerate(self._company_queries(secteur, ville)):
            if len(companies) >= max_resultats:
                break
            relaxed = index > 0
            print(f"  [DDG] Decouverte entreprises : {query}")
            resultats = self._rechercher(query, max_results=10 if relaxed else 6)

            for item in resultats:
                url = (item.get("href") or "").rstrip(".,)")
                if url in seen_urls:
                    continue
                if not self._is_valid_site_url(url):
                    continue
                if not relaxed and self._is_noise_result(item, url):
                    continue
                if not relaxed and not self._looks_like_business(item, secteur, ville):
                    continue
                if relaxed and not self._has_minimal_business_signal(item, secteur, ville):
                    continue

                title = self._clean_title(item.get("title", ""))
                if not title:
                    continue

                seen_urls.add(url)
                digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]
                texte = f'{item.get("title", "")} {item.get("body", "")} {url}'.strip()
                companies.append(
                    {
                        "place_id": f"web_{digest}",
                        "nom": title,
                        "secteur": secteur,
                        "ville": ville,
                        "country": "Tunisie",
                        "site_web": url,
                        "source": "website",
                        "source_url": url,
                        "texte_web": texte[:1000],
                    }
                )
                if len(companies) >= max_resultats:
                    break

        return companies

    def _company_queries(self, secteur: str, ville: str) -> list[str]:
        variants = [secteur, *self._industry_variants(secteur)]
        queries = []
        for variant in self._dedupe_strings(variants)[:3]:
            queries.append(
                f'"{variant}" "{ville}" Tunisie entreprise contact site officiel '
                "-annuaire -formation -cours -emploi -job"
            )
            queries.append(f'"{variant}" "{ville}" entreprise')
            queries.append(f'"{variant}" "{ville}" contact')
        queries.append(f'"{secteur}" Tunisia company contact')
        return self._dedupe_strings(queries)[:2]

    def _industry_variants(self, secteur: str) -> list[str]:
        base = self._fingerprint(secteur)
        aliases = {
            "marketing": ["digital marketing", "communication", "agence marketing"],
            "it": ["informatique", "software", "technologie"],
            "informatique": ["IT", "software", "technologie"],
            "hotel": ["hotellerie", "tourisme"],
            "restaurant": ["restauration"],
            "clinique": ["sante", "medical"],
            "commercial": ["sales", "vente"],
        }
        results = []
        for key, values in aliases.items():
            if key in base:
                results.extend(values)
        return results

    def _dedupe_strings(self, values: list[str]) -> list[str]:
        deduped = []
        seen = set()
        for value in values:
            text = str(value or "").strip()
            key = self._fingerprint(text)
            if not text or key in seen:
                continue
            seen.add(key)
            deduped.append(text)
        return deduped

    def enrichir(self, nom: str, ville: str) -> dict:
        resultat = {
            "telephone": None,
            "site_web": None,
            "email": None,
            "texte_brut": "",
        }

        queries = [
            f'"{nom}" "{ville}" Tunisie contact telephone email site officiel -annuaire -formation -cours -emploi -job',
        ]
        resultats = []
        for index, query in enumerate(queries):
            print(f"  [DDG] Recherche : {query}")
            relaxed = index > 0
            raw_results = self._rechercher(query, max_results=8 if relaxed else 6)
            resultats = [
                item
                for item in raw_results
                if self._is_valid_site_url(item.get("href") or "")
                and (relaxed or not self._is_noise_result(item, item.get("href") or ""))
                and (relaxed or self._looks_related_to_name(item, nom, ville))
            ]
            if resultats:
                break
        if not resultats:
            return resultat

        texte = " ".join(
            f'{r.get("title", "")} {r.get("body", "")} {r.get("href", "")}'
            for r in resultats
        )

        resultat["texte_brut"] = texte[:3000]
        resultat["telephone"] = self._extraire_telephone(texte)
        resultat["email"] = self._extraire_email(texte)
        resultat["site_web"] = self._extraire_site(resultats)
        return resultat

    def _rechercher(self, query: str, max_results: int = 6) -> list[dict]:
        try:
            with DDGS() as ddg:
                resultats = list(ddg.text(query, max_results=max_results))
            time.sleep(0.7)
            return resultats
        except Exception as exc:
            print(f"  [DDG] Erreur : {exc}")
            return []

    def _extraire_telephone(self, texte: str) -> Optional[str]:
        patterns = [
            r"\+216\s*\d{2}\s*\d{3}\s*\d{3}",
            r"00216\s*\d{8}",
            r"\b[24579]\d\s*\d{3}\s*\d{3}\b",
            r"\b[24579]\d{7}\b",
        ]
        for pattern in patterns:
            match = re.search(pattern, texte)
            if match:
                return re.sub(r"\s+", " ", match.group(0)).strip()
        return None

    def _extraire_email(self, texte: str) -> Optional[str]:
        pattern = r"\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b"
        for match in re.finditer(pattern, texte):
            email = match.group(0).lower()
            exclusions = ["noreply", "no-reply", "example.com", "@sentry", "@schema.org"]
            if not any(ex in email for ex in exclusions):
                return email
        return None

    def _extraire_site(self, resultats: list[dict]) -> Optional[str]:
        for item in resultats:
            url = item.get("href") or ""
            if self._is_valid_site_url(url) and not self._is_noise_result(item, url):
                return url.rstrip(".,)")
        return None

    def _is_valid_site_url(self, url: str) -> bool:
        if not url.startswith(("http://", "https://")):
            return False
        domain = urlparse(url).netloc.lower().replace("www.", "")
        return not self._is_excluded_domain(domain)

    def _is_excluded_domain(self, domain: str) -> bool:
        excluded_domains = [
            "facebook.com",
            "instagram.com",
            "linkedin.com",
            "google.",
            "duckduckgo.",
            "tripadvisor.",
            "booking.",
            "youtube.",
            "maps.",
            "wikipedia.",
            "pagesjaunes.",
            "pagejaune.",
            "annuaire",
            "tunisieindex",
            "made-in-tunisia",
            "med.tn",
            "tunisiedestinationsante",
            "doctolib",
            "emploi",
            "tanitjobs",
            "keejob",
        ]
        return any(ex in domain for ex in excluded_domains)

    def _clean_title(self, title: str) -> str:
        clean = re.sub(r"\s+\|\s+.*$", "", title or "")
        clean = re.sub(
            r"\s+-\s+(Accueil|Home|Facebook|Instagram|LinkedIn).*$",
            "",
            clean,
            flags=re.IGNORECASE,
        )
        clean = re.sub(r"\s+(site officiel|official site).*$", "", clean, flags=re.IGNORECASE)
        return clean.strip(" -|\t\n")

    def _is_noise_result(self, item: dict, url: str) -> bool:
        identity = self._fingerprint(f'{item.get("title", "")} {url}')
        body = self._fingerprint(item.get("body", ""))
        hard_noise = {
            "annuaire",
            "directory",
            "pages jaunes",
            "page jaune",
            "cours",
            "formation",
            "universite",
            "faculte",
            "emploi",
            "recrutement",
            "job",
            "stage",
            "wikipedia",
            "pdf",
        }
        if any(self._fingerprint(term) in identity for term in hard_noise):
            return True
        severe_body = {"emploi", "recrutement", "job", "stage", "pdf"}
        return any(self._fingerprint(term) in body for term in severe_body)

    def _looks_like_business(self, item: dict, secteur: str, ville: str) -> bool:
        text = self._fingerprint(f'{item.get("title", "")} {item.get("body", "")} {item.get("href", "")}')
        sector_text = self._fingerprint(secteur)
        sector_aliases = {
            "marketing": ["marketing", "communication", "digital", "agence"],
            "it": ["it", "informatique", "software", "technologie", "saas"],
            "informatique": ["informatique", "it", "software", "technologie"],
            "hotel": ["hotel", "hotellerie", "tourisme"],
            "restaurant": ["restaurant", "restauration"],
            "clinique": ["clinique", "sante", "medical"],
            "banque": ["banque", "finance"],
        }
        sector_tokens = [token for token in sector_text.split() if len(token) > 2]
        for key, aliases in sector_aliases.items():
            if key in sector_text:
                sector_tokens.extend(aliases)
        city = self._fingerprint(ville)
        business_terms = {
            "contact",
            "telephone",
            "téléphone",
            "adresse",
            "cabinet",
            "clinique",
            "societe",
            "société",
            "agence",
            "restaurant",
            "hotel",
            "docteur",
            "dr",
            "entreprise",
            "company",
            "sarl",
            "suarl",
        }
        sector_match = any(token in text for token in sector_tokens)
        city_match = bool(city and city in text)
        business_match = any(self._fingerprint(term) in text for term in business_terms)
        return (sector_match and (city_match or business_match)) or (city_match and business_match)

    def _has_minimal_business_signal(self, item: dict, secteur: str, ville: str) -> bool:
        text = self._fingerprint(f'{item.get("title", "")} {item.get("body", "")} {item.get("href", "")}')
        sector_tokens = [token for token in self._fingerprint(secteur).split() if len(token) > 2]
        city = self._fingerprint(ville)
        business_terms = {
            "contact",
            "adresse",
            "telephone",
            "societe",
            "entreprise",
            "company",
            "agence",
            "services",
            "sarl",
            "tunisie",
            "tunisia",
        }
        return (
            any(token in text for token in sector_tokens)
            or bool(city and city in text)
            or any(term in text for term in business_terms)
        )

    def _looks_related_to_name(self, item: dict, nom: str, ville: str) -> bool:
        text = self._fingerprint(f'{item.get("title", "")} {item.get("body", "")} {item.get("href", "")}')
        name_tokens = [
            token
            for token in self._fingerprint(nom).split()
            if len(token) > 2 and token not in {"cabinet", "clinique", "societe", "société"}
        ]
        city = self._fingerprint(ville)
        matches = sum(1 for token in name_tokens if token in text)
        return matches >= min(2, len(name_tokens)) or (matches >= 1 and city and city in text)

    def _fingerprint(self, value: str) -> str:
        text = unicodedata.normalize("NFKD", str(value or ""))
        text = "".join(char for char in text if not unicodedata.combining(char))
        text = re.sub(r"[^a-zA-Z0-9]+", " ", text).lower()
        return " ".join(text.split())
