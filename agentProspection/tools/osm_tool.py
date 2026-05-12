import math
import re
import time
import unicodedata

import requests
from pydantic import BaseModel
from typing import Optional


VILLES_TUNISIE = {
    "tunis": (36.8189, 10.1658),
    "sfax": (34.7406, 10.7603),
    "sousse": (35.8245, 10.6346),
    "kairouan": (35.6781, 10.0964),
    "bizerte": (37.2746, 9.8739),
    "gabes": (33.8815, 10.0982),
    "ariana": (36.8663, 10.1647),
    "gafsa": (34.4250, 8.7842),
    "monastir": (35.7643, 10.8113),
    "nabeul": (36.4561, 10.7376),
    "ben arous": (36.7533, 10.2281),
    "la marsa": (36.8784, 10.3249),
    "la goulette": (36.8180, 10.3050),
    "hammamet": (36.4000, 10.6167),
    "mahdia": (35.5047, 11.0622),
    "djerba": (33.8076, 10.8451),
}

SECTEUR_FILTERS = {
    "restaurant": ['["amenity"="restaurant"]'],
    "cafe": ['["amenity"="cafe"]'],
    "hotel": ['["tourism"="hotel"]', '["tourism"="guest_house"]'],
    "pharmacie": ['["amenity"="pharmacy"]'],
    "medecin": ['["amenity"="doctors"]', '["healthcare"="doctor"]'],
    "dentiste": ['["amenity"="dentist"]', '["healthcare"="dentist"]'],
    "clinique": ['["amenity"="clinic"]', '["healthcare"="clinic"]'],
    "supermarche": ['["shop"="supermarket"]'],
    "banque": ['["amenity"="bank"]'],
    "coiffeur": ['["shop"="hairdresser"]'],
    "gym": ['["leisure"="fitness_centre"]'],
    "garage": ['["shop"="car_repair"]', '["craft"="car_repair"]'],
    "boulangerie": ['["shop"="bakery"]'],
    "agence": ['["office"="company"]', '["office"="advertising"]'],
    "marketing": ['["office"="advertising"]', '["name"~"(marketing|communication|digital|media|publicit)",i]'],
    "it": ['["office"="it"]', '["shop"="computer"]', '["name"~"(informatique|software|digital|data|tech|IT)",i]'],
    "informatique": ['["office"="it"]', '["shop"="computer"]', '["name"~"(informatique|software|digital|data|tech|IT)",i]'],
    "startup": ['["office"="company"]', '["name"~"(startup|tech|digital|software|innovation)",i]'],
    "cabinet": ['["office"]', '["healthcare"]'],
    "magasin": ['["shop"]'],
}

OVERPASS_SERVERS = [
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
]

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "agent-prospection-pfe/1.0 contact:student-project"


class Entreprise(BaseModel):
    place_id: str
    nom: str
    adresse: str
    ville: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    telephone: Optional[str] = None
    site_web: Optional[str] = None
    email: Optional[str] = None
    categorie: Optional[str] = None
    source_url: Optional[str] = None
    osm_url: Optional[str] = None
    facebook_url: Optional[str] = None
    instagram_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    opening_hours: Optional[str] = None
    cuisine: Optional[str] = None
    postcode: Optional[str] = None
    distance_km: Optional[float] = None
    data_quality: int = 0
    source: str = "openstreetmap"

    def afficher(self):
        print(f"  Nom      : {self.nom}")
        print(f"  Adresse  : {self.adresse}")
        print(f"  Tel      : {self.telephone or '-'}")
        print(f"  Site     : {self.site_web or '-'}")
        print(f"  Categorie: {self.categorie or '-'}")
        print(f"  Position : {self.latitude or '-'}, {self.longitude or '-'}")


class OSMTool:
    def __init__(self):
        self.overpass_servers = OVERPASS_SERVERS
        self._nominatim_cache: dict[str, tuple[float, float]] = {}

    def rechercher(
        self,
        secteur: str,
        ville: str,
        rayon_km: int = 5,
        max_resultats: int = 20,
    ) -> list[Entreprise]:
        print(f"\n[OSM] Recherche : {secteur} a {ville} ({rayon_km} km)")

        coords = self._get_coords(ville)
        if not coords:
            print(f"[OSM] Ville inconnue : {ville}")
            return []

        filters = self._trouver_filters(secteur)
        lat, lng = coords
        elements = self._overpass(filters, lat, lng, rayon_km * 1000)

        entreprises = []
        seen = set()

        for element in elements:
            entreprise = self._construire(element, ville, lat, lng)
            if not entreprise or entreprise.place_id in seen:
                continue
            seen.add(entreprise.place_id)
            entreprises.append(entreprise)

        entreprises.sort(
            key=lambda item: (
                item.distance_km if item.distance_km is not None else 999,
                -item.data_quality,
                item.nom.lower(),
            )
        )
        entreprises = entreprises[:max_resultats]

        print(f"[OSM] {len(entreprises)} entreprises extraites")
        return entreprises

    def _get_coords(self, ville: str) -> Optional[tuple[float, float]]:
        normalized = self._normalize_text(ville)
        if normalized in VILLES_TUNISIE:
            return VILLES_TUNISIE[normalized]
        return self._nominatim_coords(ville)

    def _trouver_filters(self, secteur: str) -> list[str]:
        normalized = self._normalize_text(secteur)
        for key, filters in SECTEUR_FILTERS.items():
            if key in normalized or normalized in key:
                return filters

        words = [word for word in re.split(r"\W+", normalized) if len(word) > 2]
        if words:
            pattern = "|".join(re.escape(word) for word in words[:4])
            return [f'["name"~"{pattern}",i]']
        return ['["name"]']

    def _overpass(self, filters: list[str], lat: float, lng: float, rayon_m: int) -> list[dict]:
        blocks = []
        for filtre in filters:
            blocks.extend(
                [
                    f"node{filtre}(around:{rayon_m},{lat},{lng});",
                    f"way{filtre}(around:{rayon_m},{lat},{lng});",
                    f"relation{filtre}(around:{rayon_m},{lat},{lng});",
                ]
            )

        query = f"""
        [out:json][timeout:35];
        (
          {' '.join(blocks)}
        );
        out center tags;
        """

        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        }

        for url in self.overpass_servers:
            try:
                print(f"[OSM] Serveur : {url}")
                response = requests.post(
                    url,
                    data={"data": query},
                    headers=headers,
                    timeout=35,
                )
                response.raise_for_status()
                elements = response.json().get("elements", [])
                return [item for item in elements if item.get("tags", {}).get("name")]
            except requests.Timeout:
                print(f"[OSM] Timeout sur {url}")
            except requests.HTTPError as exc:
                print(f"[OSM] HTTP {exc.response.status_code} sur {url}")
            except Exception as exc:
                print(f"[OSM] Erreur sur {url} : {exc}")

        return []

    def _construire(
        self,
        element: dict,
        ville: str,
        search_lat: float,
        search_lng: float,
    ) -> Optional[Entreprise]:
        tags = element.get("tags", {})
        nom = tags.get("name", "").strip()
        if not nom:
            return None

        adresse = tags.get("addr:full") or " ".join(
            filter(
                None,
                [
                    tags.get("addr:housenumber", ""),
                    tags.get("addr:street", ""),
                    tags.get("addr:city", ville),
                ],
            )
        ).strip() or ville

        center = element.get("center") or {}
        latitude = element.get("lat") or center.get("lat")
        longitude = element.get("lon") or center.get("lon")

        telephone = self._normalize_phone(
            tags.get("phone")
            or tags.get("contact:phone")
            or tags.get("contact:mobile")
            or tags.get("mobile")
        )
        site_web = self._normalize_url(
            tags.get("website")
            or tags.get("contact:website")
            or tags.get("url")
        )
        email = (tags.get("email") or tags.get("contact:email") or "").strip().lower() or None
        categorie = (
            tags.get("amenity")
            or tags.get("shop")
            or tags.get("tourism")
            or tags.get("office")
            or tags.get("leisure")
            or tags.get("healthcare")
        )
        osm_url = f"https://www.openstreetmap.org/{element.get('type', 'node')}/{element.get('id', 0)}"
        distance_km = self._distance_km(search_lat, search_lng, latitude, longitude)

        return Entreprise(
            place_id=f"osm_{element.get('type', 'node')}_{element.get('id', 0)}",
            nom=nom,
            adresse=adresse,
            ville=ville,
            latitude=latitude,
            longitude=longitude,
            telephone=telephone,
            site_web=site_web,
            email=email,
            categorie=categorie,
            source_url=osm_url,
            osm_url=osm_url,
            facebook_url=self._normalize_url(tags.get("contact:facebook") or tags.get("facebook")),
            instagram_url=self._normalize_url(tags.get("contact:instagram") or tags.get("instagram")),
            linkedin_url=self._normalize_url(tags.get("contact:linkedin") or tags.get("linkedin")),
            opening_hours=tags.get("opening_hours"),
            cuisine=tags.get("cuisine"),
            postcode=tags.get("addr:postcode"),
            distance_km=distance_km,
            data_quality=self._data_quality(
                adresse=adresse,
                latitude=latitude,
                longitude=longitude,
                telephone=telephone,
                site_web=site_web,
                email=email,
                categorie=categorie,
                tags=tags,
            ),
        )

    def _nominatim_coords(self, ville: str) -> Optional[tuple[float, float]]:
        key = self._normalize_text(ville)
        if key in self._nominatim_cache:
            return self._nominatim_cache[key]

        try:
            response = requests.get(
                NOMINATIM_URL,
                params={
                    "q": f"{ville}, Tunisie",
                    "format": "json",
                    "limit": 1,
                    "countrycodes": "tn",
                },
                headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
                timeout=12,
            )
            response.raise_for_status()
            payload = response.json()
            if payload:
                coords = (float(payload[0]["lat"]), float(payload[0]["lon"]))
                self._nominatim_cache[key] = coords
                time.sleep(1)
                return coords
        except Exception as exc:
            print(f"[OSM] Nominatim indisponible pour {ville}: {exc}")
        return None

    def _normalize_phone(self, value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        raw = str(value).strip()
        numbers = re.findall(r"(?:\+|00)?216\s*\d{2}\s*\d{3}\s*\d{3}|\b[24579]\d\s*\d{3}\s*\d{3}\b|\b[24579]\d{7}\b", raw)
        phone = numbers[0] if numbers else raw
        compact = re.sub(r"[^\d+]", "", phone)
        if compact.startswith("00216"):
            compact = "+216" + compact[5:]
        elif compact.startswith("216") and len(compact) == 11:
            compact = "+" + compact
        elif len(compact) == 8 and compact[0] in "24579":
            compact = "+216" + compact
        return compact or None

    def _normalize_url(self, value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        url = str(value).strip().rstrip(".,)")
        if not url:
            return None
        if url.startswith("www."):
            return f"https://{url}"
        if not url.startswith(("http://", "https://")) and "." in url:
            return f"https://{url}"
        return url if url.startswith(("http://", "https://")) else None

    def _distance_km(
        self,
        lat1: float,
        lon1: float,
        lat2: Optional[float],
        lon2: Optional[float],
    ) -> Optional[float]:
        if lat2 is None or lon2 is None:
            return None
        lat2 = float(lat2)
        lon2 = float(lon2)
        radius = 6371.0
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        a = (
            math.sin(delta_phi / 2) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
        )
        return round(radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)

    def _data_quality(self, **values) -> int:
        score = 0
        tags = values.get("tags") or {}
        if values.get("latitude") and values.get("longitude"):
            score += 20
        if values.get("adresse") and len(values["adresse"]) > 5:
            score += 15
        if values.get("telephone"):
            score += 20
        if values.get("site_web"):
            score += 15
        if values.get("email"):
            score += 15
        if values.get("categorie"):
            score += 10
        if tags.get("opening_hours"):
            score += 5
        return min(score, 100)

    def _normalize_text(self, value: str) -> str:
        text = unicodedata.normalize("NFKD", str(value or ""))
        text = "".join(char for char in text if not unicodedata.combining(char))
        return re.sub(r"\s+", " ", text.lower()).strip()
