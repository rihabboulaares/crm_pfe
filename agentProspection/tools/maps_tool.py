import logging
import os
import re

import httpx

from agentProspection.tools.base_tool import BaseTool


logger = logging.getLogger("agentProspection.maps")


# ============================================================
# CONFIGURATION
# ============================================================

PLACES_TEXT_SEARCH_URL = (
    "https://places.googleapis.com/v1/places:searchText"
)

DEFAULT_COUNTRY = "Tunisie"
DEFAULT_COUNTRY_CODE = "TN"


# ============================================================
# GOOGLE MAPS TOOL
# ============================================================

class MapsTool(BaseTool):
    """
    Recherche des entreprises locales tunisiennes
    avec Google Places Text Search API.

    L'application étant consacrée uniquement à la Tunisie :

    - regionCode est toujours TN ;
    - country est toujours Tunisie ;
    - country_code est toujours TN ;
    - la ville et l'adresse viennent réellement de Google Maps.
    """

    name = "maps"

    FIELD_MASK = ",".join(
        [
            "places.id",
            "places.displayName",
            "places.formattedAddress",
            "places.addressComponents",
            "places.location",
            "places.nationalPhoneNumber",
            "places.internationalPhoneNumber",
            "places.websiteUri",
            "places.primaryType",
            "places.primaryTypeDisplayName",
            "places.businessStatus",
            "places.googleMapsUri",
            "places.rating",
            "places.userRatingCount",
        ]
    )

    def __init__(self):
        super().__init__()

        self.last_status = "idle"
        self.last_error = ""

    # ========================================================
    # RUN
    # ========================================================

    async def run(
        self,
        query: str | dict,
    ) -> list[dict]:

        self.last_status = "running"
        self.last_error = ""

        # ====================================================
        # API KEY
        # ====================================================

        api_key = os.getenv(
            "GOOGLE_MAPS_API_KEY"
        )

        if not api_key:
            self.last_status = "unavailable"
            self.last_error = (
                "GOOGLE_MAPS_API_KEY missing"
            )

            logger.warning(
                "[GOOGLE_MAPS] "
                "GOOGLE_MAPS_API_KEY manquante"
            )

            return []

        # ====================================================
        # QUERY
        # ====================================================

        if isinstance(
            query,
            dict,
        ):
            query_text = str(
                query.get("q")
                or query.get("query")
                or ""
            ).strip()

        else:
            query_text = str(
                query or ""
            ).strip()

        if not query_text:
            self.last_status = "error"
            self.last_error = (
                "Empty Google Maps query"
            )

            return []

        # ====================================================
        # REQUEST
        # ====================================================

        headers = {
            "Content-Type":
                "application/json",

            "X-Goog-Api-Key":
                api_key,

            "X-Goog-FieldMask":
                self.FIELD_MASK,
        }

        body = {
            "textQuery":
                query_text,

            "languageCode":
                "fr",

            # Application exclusivement tunisienne.
            "regionCode":
                DEFAULT_COUNTRY_CODE,

            # 10 candidats suffisent :
            # le classifier sélectionnera ensuite
            # uniquement les prospects pertinents.
            "maxResultCount":
                10,
        }

        logger.info(
            "[GOOGLE_MAPS] "
            "Recherche query=%s region=%s",
            query_text,
            DEFAULT_COUNTRY_CODE,
        )

        # ====================================================
        # HTTP
        # ====================================================

        try:
            timeout = httpx.Timeout(
                20.0,
                connect=8.0,
            )

            async with httpx.AsyncClient(
                timeout=timeout
            ) as client:

                response = await client.post(
                    PLACES_TEXT_SEARCH_URL,
                    json=body,
                    headers=headers,
                )

                response.raise_for_status()

                data = response.json()

        except httpx.HTTPStatusError as exc:
            self.last_status = "error"

            self.last_error = (
                f"Google Maps HTTP "
                f"{exc.response.status_code}"
            )

            logger.warning(
                "[GOOGLE_MAPS] "
                "HTTP error status=%s",
                exc.response.status_code,
            )

            return []

        except httpx.RequestError as exc:
            self.last_status = "unavailable"

            self.last_error = (
                "Google Maps connection error"
            )

            logger.warning(
                "[GOOGLE_MAPS] "
                "Connection error type=%s",
                exc.__class__.__name__,
            )

            return []

        except Exception as exc:
            self.last_status = "error"

            self.last_error = (
                "Google Maps unexpected error: "
                f"{exc.__class__.__name__}"
            )

            logger.exception(
                "[GOOGLE_MAPS] "
                "Erreur inattendue"
            )

            return []

        # ====================================================
        # RAW RESULTS
        # ====================================================

        places = (
            data.get("places")
            or []
        )

        logger.info(
            "[GOOGLE_MAPS] "
            "Resultats recus=%s query=%s",
            len(places),
            query_text,
        )

        # ====================================================
        # NORMALIZATION
        # ====================================================

        results = []
        seen_place_ids = set()

        for place in places[:10]:

            if not isinstance(
                place,
                dict,
            ):
                continue

            # =================================================
            # PLACE ID
            # =================================================

            place_id = str(
                place.get("id")
                or ""
            ).strip()

            if (
                place_id
                and place_id
                in seen_place_ids
            ):
                continue

            # =================================================
            # COMPANY NAME
            # =================================================

            display_name = (
                place.get("displayName")
                or {}
            )

            company_name = str(
                display_name.get("text")
                or ""
            ).strip()

            if not company_name:
                continue

            # =================================================
            # LOCATION
            # =================================================

            location = (
                place.get("location")
                or {}
            )

            latitude = (
                location.get("latitude")
            )

            longitude = (
                location.get("longitude")
            )

            # =================================================
            # ADDRESS
            # =================================================

            formatted_address = (
                place.get(
                    "formattedAddress"
                )
            )

            address_components = (
                place.get(
                    "addressComponents"
                )
                or []
            )

            city = self.extract_city(
                address_components
            )

            # =================================================
            # PHONE
            # =================================================

            phone = (
                place.get(
                    "internationalPhoneNumber"
                )
                or place.get(
                    "nationalPhoneNumber"
                )
            )

            phone = (
                self.normalize_phone(
                    phone
                )
            )

            # =================================================
            # WEBSITE / MAPS
            # =================================================

            website = (
                place.get(
                    "websiteUri"
                )
            )

            google_maps_url = (
                place.get(
                    "googleMapsUri"
                )
            )

            # =================================================
            # INDUSTRY
            # =================================================

            primary_type_display = (
                place.get(
                    "primaryTypeDisplayName"
                )
                or {}
            )

            industry = (
                primary_type_display.get(
                    "text"
                )
                or place.get(
                    "primaryType"
                )
            )

            # =================================================
            # NORMALIZED PROSPECT
            # =================================================

            result = {
                "lead_type":
                    "company",

                "company_name":
                    company_name,

                "phone":
                    phone,

                "email":
                    None,

                # --------------------------------------------
                # Tunisia-only application
                # --------------------------------------------

                "city":
                    city,

                "country":
                    DEFAULT_COUNTRY,

                "country_code":
                    DEFAULT_COUNTRY_CODE,

                # --------------------------------------------
                # Address
                # --------------------------------------------

                "address":
                    formatted_address,

                # --------------------------------------------
                # Website
                # --------------------------------------------

                "website":
                    website,

                # --------------------------------------------
                # Google identity
                # --------------------------------------------

                "google_place_id":
                    place_id
                    or None,

                "google_maps_url":
                    google_maps_url,

                "maps_url":
                    google_maps_url,

                # --------------------------------------------
                # Coordinates
                # --------------------------------------------

                "latitude":
                    latitude,

                "longitude":
                    longitude,

                "map_location": {
                    "lat":
                        latitude,

                    "lng":
                        longitude,

                    "address":
                        formatted_address,

                    "google_maps_url":
                        google_maps_url,
                },

                # --------------------------------------------
                # Business information
                # --------------------------------------------

                "industry":
                    industry,

                "business_status":
                    place.get(
                        "businessStatus"
                    ),

                "rating":
                    place.get(
                        "rating"
                    ),

                "reviews_count":
                    place.get(
                        "userRatingCount"
                    ),

                # --------------------------------------------
                # Discovery source
                # --------------------------------------------

                "source":
                    "google_maps",

                "source_label":
                    "Google Maps",

                "source_url":
                    (
                        google_maps_url
                        or website
                    ),

                # Google Places donne une identité
                # entreprise très fiable.
                "identity_confidence":
                    "high",

                "source_confidence":
                    0.95,
            }

            if place_id:
                seen_place_ids.add(
                    place_id
                )

            results.append(
                result
            )

        self.last_status = "ok"
        self.last_error = ""

        return results

    # ========================================================
    # PHONE NORMALIZATION
    # ========================================================

    @staticmethod
    def normalize_phone(
        value: str | None,
    ) -> str | None:
        """
        Normalisation adaptée à la Tunisie.

        Exemples :

        71 123 456
        -> +21671123456

        +216 71 123 456
        -> +21671123456

        00216 71 123 456
        -> +21671123456
        """

        if not value:
            return None

        raw = str(
            value
        ).strip()

        if not raw:
            return None

        digits = re.sub(
            r"\D",
            "",
            raw,
        )

        if not digits:
            return None

        # ====================================================
        # 00216...
        # ====================================================

        if digits.startswith(
            "00216"
        ):
            digits = (
                "216"
                + digits[5:]
            )

        # ====================================================
        # Tunisian local number
        # ====================================================

        if (
            len(digits) == 8
            and digits[0]
            in "24579"
        ):
            digits = (
                "216"
                + digits
            )

        # ====================================================
        # Tunisia international
        # ====================================================

        if (
            digits.startswith("216")
            and len(digits) == 11
        ):
            return (
                f"+{digits}"
            )

        # Google peut exceptionnellement fournir
        # un numéro différent ou non standard.
        # On ne l'invente pas.
        if (
            8
            <= len(digits)
            <= 15
        ):
            if raw.startswith("+"):
                return (
                    f"+{digits}"
                )

            return digits

        return None

    # ========================================================
    # ADDRESS COMPONENT
    # ========================================================

    @staticmethod
    def component_value(
        components: list,
        component_types: set[str],
        *,
        use_short: bool = False,
    ) -> str | None:

        for component in (
            components
            or []
        ):
            if not isinstance(
                component,
                dict,
            ):
                continue

            types = set(
                component.get("types")
                or []
            )

            if not (
                types
                & component_types
            ):
                continue

            if use_short:
                value = (
                    component.get(
                        "shortText"
                    )
                    or component.get(
                        "longText"
                    )
                )

            else:
                value = (
                    component.get(
                        "longText"
                    )
                    or component.get(
                        "shortText"
                    )
                )

            if value:
                return str(
                    value
                ).strip()

        return None

    # ========================================================
    # CITY
    # ========================================================

    @classmethod
    def extract_city(
        cls,
        components: list,
    ) -> str | None:
        """
        Extrait la ville depuis les données structurées
        de Google Places.

        Cela fonctionne pour Tunis, Sfax, Sousse,
        Ariana, Nabeul, etc. sans liste codée en dur.
        """

        city = cls.component_value(
            components,
            {
                "locality",
                "postal_town",
            },
        )

        if city:
            return city

        # Certains lieux tunisiens utilisent plutôt
        # administrative_area_level_2.
        city = cls.component_value(
            components,
            {
                "administrative_area_level_2",
            },
        )

        if city:
            return city

        # Dernier fallback : gouvernorat.
        return cls.component_value(
            components,
            {
                "administrative_area_level_1",
            },
        )