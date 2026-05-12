import os
from typing import Any

import requests


class GooglePlacesTool:
    """
    Connecteur optionnel Google Maps / Places API.

    Il s'active seulement si GOOGLE_MAPS_API_KEY est configuree.
    Pour un PFE avec budget limite, garde OSM comme source principale.
    """

    endpoint = "https://places.googleapis.com/v1/places:searchText"

    def __init__(self):
        self.api_key = os.getenv("GOOGLE_MAPS_API_KEY", "")

    def disponible(self) -> bool:
        return bool(self.api_key)

    def rechercher(self, secteur: str, ville: str, max_resultats: int = 10) -> list[dict[str, Any]]:
        if not self.disponible():
            return []

        payload = {
            "textQuery": f"{secteur} a {ville} Tunisie",
            "languageCode": "fr",
            "regionCode": "TN",
            "pageSize": max(1, min(max_resultats, 20)),
        }
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": (
                "places.id,places.displayName,places.formattedAddress,"
                "places.location,places.nationalPhoneNumber,places.websiteUri,"
                "places.googleMapsUri,places.primaryTypeDisplayName"
            ),
        }

        try:
            response = requests.post(self.endpoint, json=payload, headers=headers, timeout=25)
            response.raise_for_status()
            places = response.json().get("places", [])
            return [self._normalize(place, ville, secteur) for place in places]
        except Exception as exc:
            print(f"[GooglePlaces] Indisponible: {exc}")
            return []

    def _normalize(self, place: dict[str, Any], ville: str, secteur: str) -> dict[str, Any]:
        display_name = place.get("displayName") or {}
        location = place.get("location") or {}
        primary_type = place.get("primaryTypeDisplayName") or {}

        return {
            "place_id": f"google_{place.get('id', '')}",
            "nom": display_name.get("text") or "",
            "secteur": secteur,
            "adresse": place.get("formattedAddress") or ville,
            "ville": ville,
            "country": "Tunisie",
            "latitude": location.get("latitude"),
            "longitude": location.get("longitude"),
            "telephone": place.get("nationalPhoneNumber") or "",
            "site_web": place.get("websiteUri") or "",
            "categorie": primary_type.get("text") or "",
            "source": "google_places",
            "source_url": place.get("googleMapsUri") or "",
        }
