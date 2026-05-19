import math
import re
from typing import Optional

import requests
from pydantic import BaseModel


PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"

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
    google_maps_url: Optional[str] = None
    opening_hours: Optional[str] = None
    distance_km: Optional[float] = None
    data_quality: int = 0
    source: str = "google_maps"


class GoogleMapsTool:
    """
    Recherche d'entreprises via Google Places Text Search.

    L'outil utilise uniquement Google Places. Si aucune cle
    GOOGLE_MAPS_API_KEY / GOOGLE_PLACES_API_KEY n'est configuree, aucune
    recherche geographique n'est executee.
    """

    FIELD_MASK = ",".join(
        [
            "places.id",
            "places.displayName",
            "places.formattedAddress",
            "places.location",
            "places.nationalPhoneNumber",
            "places.internationalPhoneNumber",
            "places.websiteUri",
            "places.primaryType",
            "places.primaryTypeDisplayName",
            "places.types",
            "places.businessStatus",
            "places.googleMapsUri",
        ]
    )

    def __init__(self, api_key: str = ""):
        self.api_key = api_key

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    def rechercher(
        self,
        secteur: str,
        ville: str,
        rayon_km: int = 5,
        max_resultats: int = 20,
    ) -> list[Entreprise]:
        if not self.api_key:
            return []

        coords = self._get_coords(ville)
        text_query = f"{secteur} a {ville}, Tunisie"
        body: dict = {
            "textQuery": text_query,
            "languageCode": "fr",
            "regionCode": "TN",
            "maxResultCount": max(1, min(max_resultats, 20)),
        }
        if coords:
            lat, lng = coords
            body["locationBias"] = {
                "circle": {
                    "center": {"latitude": lat, "longitude": lng},
                    "radius": max(1000, min(int(rayon_km * 1000), 50000)),
                }
            }

        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": self.FIELD_MASK,
        }

        try:
            print(f"\n[GoogleMaps] Recherche : {text_query}")
            response = requests.post(
                PLACES_TEXT_SEARCH_URL,
                json=body,
                headers=headers,
                timeout=20,
            )
            response.raise_for_status()
        except Exception as exc:
            print(f"[GoogleMaps] Indisponible: {exc}")
            return []

        places = response.json().get("places", [])
        companies = []
        for place in places:
            company = self._build_company(place, ville, secteur, coords)
            if company:
                companies.append(company)
        return companies[:max_resultats]

    def _build_company(
        self,
        place: dict,
        ville: str,
        secteur: str,
        search_coords: Optional[tuple[float, float]],
    ) -> Optional[Entreprise]:
        display_name = place.get("displayName") or {}
        name = (display_name.get("text") or "").strip()
        if not name:
            return None

        location = place.get("location") or {}
        latitude = location.get("latitude")
        longitude = location.get("longitude")
        distance_km = None
        if search_coords and latitude is not None and longitude is not None:
            distance_km = self._distance_km(search_coords[0], search_coords[1], latitude, longitude)

        phone = place.get("internationalPhoneNumber") or place.get("nationalPhoneNumber")
        primary_type_display = place.get("primaryTypeDisplayName") or {}
        category = primary_type_display.get("text") or place.get("primaryType") or ", ".join(place.get("types") or [])
        maps_url = place.get("googleMapsUri") or ""
        website = place.get("websiteUri") or None

        return Entreprise(
            place_id=f"google_maps_{place.get('id', '')}",
            nom=name,
            adresse=place.get("formattedAddress") or ville,
            ville=ville,
            latitude=latitude,
            longitude=longitude,
            telephone=self._normalize_phone(phone),
            site_web=website,
            email=None,
            categorie=category,
            source_url=maps_url,
            google_maps_url=maps_url,
            distance_km=distance_km,
            data_quality=self._data_quality(
                latitude=latitude,
                longitude=longitude,
                adresse=place.get("formattedAddress"),
                telephone=phone,
                site_web=website,
                categorie=category,
                google_maps_url=maps_url,
            ),
            source="google_maps",
        )

    def _get_coords(self, ville: str) -> Optional[tuple[float, float]]:
        return VILLES_TUNISIE.get(self._normalize_text(ville))

    def _normalize_phone(self, value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        raw = str(value).strip()
        compact = re.sub(r"[^\d+]", "", raw)
        if compact.startswith("00216"):
            compact = "+216" + compact[5:]
        elif compact.startswith("216") and len(compact) == 11:
            compact = "+" + compact
        elif len(compact) == 8 and compact[0] in "24579":
            compact = "+216" + compact
        return compact or raw

    def _distance_km(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        radius = 6371.0
        phi1, phi2 = math.radians(float(lat1)), math.radians(float(lat2))
        delta_phi = math.radians(float(lat2) - float(lat1))
        delta_lambda = math.radians(float(lon2) - float(lon1))
        a = (
            math.sin(delta_phi / 2) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
        )
        return round(radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)

    def _data_quality(self, **values) -> int:
        score = 25
        if values.get("latitude") and values.get("longitude"):
            score += 20
        if values.get("adresse"):
            score += 15
        if values.get("telephone"):
            score += 15
        if values.get("site_web"):
            score += 15
        if values.get("categorie"):
            score += 5
        if values.get("google_maps_url"):
            score += 5
        return min(score, 100)

    def _normalize_text(self, value: str) -> str:
        return re.sub(r"\s+", " ", str(value or "").strip().lower())
