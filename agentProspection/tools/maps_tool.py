import os
import re

import httpx

from agentProspection.tools.base_tool import BaseTool


PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"


class MapsTool(BaseTool):
    name = "maps"

    FIELD_MASK = ",".join([
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.nationalPhoneNumber",
        "places.internationalPhoneNumber",
        "places.websiteUri",
        "places.primaryType",
        "places.primaryTypeDisplayName",
        "places.businessStatus",
        "places.googleMapsUri",
        "places.rating",
    ])

    async def run(self, query: str) -> list[dict]:
        api_key = os.getenv("GOOGLE_MAPS_API_KEY")

        if not api_key:
            return []

        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": self.FIELD_MASK,
        }

        body = {
            "textQuery": query,
            "languageCode": "fr",
            "regionCode": "TN",
            "maxResultCount": 10,
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    PLACES_TEXT_SEARCH_URL,
                    json=body,
                    headers=headers,
                )
                response.raise_for_status()
                data = response.json()
        except Exception:
            return []

        results = []

        for place in data.get("places", []):
            display_name = place.get("displayName") or {}
            location = place.get("location") or {}
            primary_type_display = place.get("primaryTypeDisplayName") or {}

            phone = (
                place.get("internationalPhoneNumber")
                or place.get("nationalPhoneNumber")
            )

            results.append({
                "lead_type": "company",
                "company_name": display_name.get("text"),
                "phone": self.normalize_phone(phone),
                "email": None,
                "city": self.extract_city(place.get("formattedAddress")),
                "country": "Tunisie",
                "address": place.get("formattedAddress"),
                "website": place.get("websiteUri"),
                "google_place_id": place.get("id"),
                "google_maps_url": place.get("googleMapsUri"),
                "latitude": location.get("latitude"),
                "longitude": location.get("longitude"),
                "industry": (
                    primary_type_display.get("text")
                    or place.get("primaryType")
                ),
                "business_status": place.get("businessStatus"),
                "rating": place.get("rating"),
                "source": "maps",
            })

        return results

    def normalize_phone(self, value: str | None) -> str | None:
        if not value:
            return None

        compact = re.sub(r"[^\d+]", "", str(value))

        if compact.startswith("00216"):
            compact = "+216" + compact[5:]
        elif compact.startswith("216") and len(compact) == 11:
            compact = "+" + compact
        elif len(compact) == 8 and compact[0] in "24579":
            compact = "+216" + compact

        return compact

    def extract_city(self, address: str | None) -> str | None:
        if not address:
            return None

        known = [
            "Tunis", "Ariana", "Ben Arous", "La Marsa", "Sousse",
            "Sfax", "Nabeul", "Bizerte", "Monastir", "Mahdia",
            "Gabes", "Gabès", "Kairouan",
        ]

        address_l = address.lower()

        for city in known:
            if city.lower() in address_l:
                return city

        return None