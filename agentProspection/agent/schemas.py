from typing import Literal

from pydantic import (
    BaseModel,
    Field,
    field_validator,
    model_validator,
)

from agentProspection.agent.tool_registry import (
    ALLOWED_SOURCES,
    normalize_source_name,
)


# ============================================================
# INTENT SCHEMA
# ============================================================

class IntentSchema(BaseModel):
    """
    Intention de prospection produite par Gemini.

    Gemini sert uniquement à comprendre la demande utilisateur.

    Ce schéma ne gère PAS :
    - l'exécution des outils ;
    - les décisions de boucle ;
    - la pagination ;
    - la validation des prospects ;
    - la déduplication ;
    - l'import CRM ;
    - le scoring ;
    - le scraping.

    Le Search Plan est construit ensuite dans brain.py.

    IMPORTANT :
    search_keywords permet de rechercher dans n'importe quel
    secteur sans maintenir une grande liste métier codée en dur.
    """

    objective: Literal["prospection"] = "prospection"

    lead_types: list[
        Literal["person", "company"]
    ] = Field(
        default_factory=list,
    )

    industries: list[str] = Field(
        default_factory=list,
    )

    locations: list[str] = Field(
        default_factory=list,
    )

    target_roles: list[str] = Field(
        default_factory=list,
    )

    sources: list[str] = Field(
        default_factory=list,
    )

    search_keywords: list[str] = Field(
        default_factory=list,
        description=(
            "Maximum 3 mots-clés métier courts et génériques "
            "utilisables par les moteurs de recherche classiques."
        ),
    )

    # Réservé exclusivement à Meta Ads Library.
    # Les autres outils n'utilisent jamais ce champ.
    meta_search_keywords: list[str] = Field(
        default_factory=list,
        description=(
            "Maximum 6 expressions métier strictement équivalentes "
            "optimisées uniquement pour Meta Ads Library."
        ),
    )

    source_forced: bool = False

    max_leads: int = Field(
        default=10,
        ge=1,
        le=50,
    )

    reasoning_summary: str = ""

    # ========================================================
    # NORMALISATION DES LISTES
    # ========================================================

    @field_validator(
        "industries",
        "locations",
        "target_roles",
        "sources",
        "search_keywords",
        "meta_search_keywords",
        mode="before",
    )
    @classmethod
    def normalize_list_fields(
        cls,
        value,
    ):
        if value is None:
            return []

        if isinstance(
            value,
            str,
        ):
            value = [
                value
            ]

        if not isinstance(
            value,
            (
                list,
                tuple,
                set,
            ),
        ):
            return []

        result = []
        seen = set()

        for item in value:
            text = str(
                item or ""
            ).strip()

            if not text:
                continue

            key = (
                text
                .casefold()
            )

            if key in seen:
                continue

            seen.add(
                key
            )

            result.append(
                text
            )

        return result

    # ========================================================
    # LEAD TYPES
    # ========================================================

    @field_validator(
        "lead_types",
        mode="before",
    )
    @classmethod
    def normalize_lead_types(
        cls,
        value,
    ):
        if value is None:
            return []

        if isinstance(
            value,
            str,
        ):
            value = [
                value
            ]

        if not isinstance(
            value,
            (
                list,
                tuple,
                set,
            ),
        ):
            return []

        result = []

        for item in value:
            normalized = (
                str(
                    item or ""
                )
                .strip()
                .lower()
            )

            if (
                normalized
                in {
                    "person",
                    "company",
                }
                and normalized
                not in result
            ):
                result.append(
                    normalized
                )

        return result

    # ========================================================
    # SOURCES
    # ========================================================

    @field_validator(
        "sources",
    )
    @classmethod
    def normalize_sources(
        cls,
        value,
    ):
        result = []

        for item in value or []:
            source = (
                normalize_source_name(
                    item
                )
            )

            if not source:
                continue

            if (
                source
                not in ALLOWED_SOURCES
            ):
                continue

            if (
                source
                not in result
            ):
                result.append(
                    source
                )

        # Maximum :
        # 1 source principale
        # + 1 source complémentaire.
        return result[:2]

    # ========================================================
    # CLEAN BUSINESS TEXT
    # ========================================================

    @field_validator(
        "industries",
        "locations",
        "target_roles",
        "search_keywords",
        "meta_search_keywords",
    )
    @classmethod
    def remove_empty_values(
        cls,
        value,
    ):
        result = []
        seen = set()

        for item in value:
            text = str(
                item or ""
            ).strip()

            if not text:
                continue

            key = (
                text.casefold()
            )

            if key in seen:
                continue

            seen.add(
                key
            )

            result.append(
                text
            )

        return result

    # ========================================================
    # SEARCH KEYWORDS
    # ========================================================

    @field_validator(
        "search_keywords",
    )
    @classmethod
    def limit_search_keywords(
        cls,
        value,
    ):
        # Comportement historique conservé pour Maps, Serper,
        # LinkedIn, Facebook et Instagram.
        return value[:3]

    @field_validator(
        "meta_search_keywords",
    )
    @classmethod
    def limit_meta_search_keywords(
        cls,
        value,
    ):
        return value[:6]

    # ========================================================
    # REASONING SUMMARY
    # ========================================================

    @field_validator(
        "reasoning_summary",
        mode="before",
    )
    @classmethod
    def normalize_summary(
        cls,
        value,
    ):
        return str(
            value or ""
        ).strip()[:500]

    # ========================================================
    # BUSINESS CONSISTENCY
    # ========================================================

    @model_validator(
        mode="after",
    )
    def validate_business_consistency(
        self,
    ):
        if not self.lead_types:

            if self.target_roles:
                self.lead_types = [
                    "person"
                ]

            elif self.industries:
                self.lead_types = [
                    "company"
                ]

            else:
                raise ValueError(
                    "Impossible de déterminer "
                    "le type de prospect demandé."
                )

        if len(
            self.lead_types
        ) > 1:

            if self.target_roles:
                self.lead_types = [
                    "person"
                ]

            elif self.industries:
                self.lead_types = [
                    "company"
                ]

            else:
                raise ValueError(
                    "Gemini a retourné plusieurs "
                    "types de prospects sans cible claire."
                )

        lead_type = (
            self.lead_types[0]
        )

        if (
            lead_type
            == "company"
        ):
            self.target_roles = []

        elif (
            lead_type
            == "person"
        ):
            self.sources = [
                source
                for source
                in self.sources
                if source
                not in {
                    "maps",
                    "meta_ads",
                }
            ]

        self.sources = (
            self.sources[:2]
        )

        self.search_keywords = (
            self.search_keywords[:3]
        )

        if "meta_ads" in self.sources:
            self.meta_search_keywords = (
                self.meta_search_keywords[:6]
            )
        else:
            self.meta_search_keywords = []

        if not self.sources:
            self.source_forced = (
                False
            )

        return self


# ============================================================
# SEMANTIC CANDIDATE VALIDATION
# ============================================================

class CandidateValidation(BaseModel):
    """
    Validation sémantique d'un candidat déjà découvert.

    Gemini ne décide pas si le candidat est CRM-ready.
    Il évalue uniquement la compatibilité sémantique
    à partir des preuves fournies par le backend.

    La décision finale reste déterministe côté Python.
    """

    candidate_id: str = Field(
        min_length=1,
        max_length=120,
    )

    sector_match: bool = False
    role_match: bool = False

    location_status: Literal[
        "confirmed",
        "compatible",
        "unknown",
        "incompatible",
    ] = "unknown"

    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
    )

    reason: str = Field(
        default="",
        max_length=300,
    )

    @field_validator(
        "candidate_id",
        mode="before",
    )
    @classmethod
    def normalize_candidate_id(
        cls,
        value,
    ):
        return str(
            value or ""
        ).strip()[:120]

    @field_validator(
        "location_status",
        mode="before",
    )
    @classmethod
    def normalize_location_status(
        cls,
        value,
    ):
        normalized = str(
            value or "unknown"
        ).strip().lower()

        if normalized in {
            "confirmed",
            "compatible",
            "unknown",
            "incompatible",
        }:
            return normalized

        return "unknown"

    @field_validator(
        "reason",
        mode="before",
    )
    @classmethod
    def normalize_validation_reason(
        cls,
        value,
    ):
        return str(
            value or ""
        ).strip()[:300]


class ValidationBatch(BaseModel):
    """
    Réponse Gemini pour un lot de candidats.

    Le backend peut envoyer plusieurs candidats préfiltrés
    dans un seul appel afin de limiter les coûts et
    les temps de réponse.
    """

    results: list[
        CandidateValidation
    ] = Field(
        default_factory=list,
    )

    @model_validator(
        mode="after",
    )
    def validate_unique_candidate_ids(
        self,
    ):
        unique_results = []
        seen = set()

        for item in self.results:
            candidate_id = item.candidate_id

            if (
                not candidate_id
                or candidate_id in seen
            ):
                continue

            seen.add(candidate_id)
            unique_results.append(item)

        self.results = unique_results
        return self


# ============================================================
# AGENT DECISION
# ============================================================

class AgentDecision(BaseModel):
    """
    Décision stratégique prise par Gemini en cours de run.

    `source` est utilisée uniquement avec `switch_source`.

    IMPORTANT :
    aucune chaîne vide n'est présente dans le Literal.
    Gemini refuse les enums JSON dont une valeur est "".
    Pour toutes les décisions qui ne nécessitent pas de source,
    `source` vaut None / null.
    """

    decision: Literal[
        "continue_same_strategy",
        "switch_source",
        "broaden_criteria",
        "verify_pending_meta_ads",
        "stop",
    ]

    source: Literal[
        "linkedin",
        "facebook",
        "instagram",
        "general",
        "maps",
        "meta_ads",
    ] | None = None

    reason: str = Field(
        default="",
        max_length=200,
    )

    confidence: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
    )

    # ========================================================
    # REASON
    # ========================================================

    @field_validator(
        "reason",
        mode="before",
    )
    @classmethod
    def normalize_reason(
        cls,
        value,
    ):
        return str(
            value or ""
        ).strip()[:200]

    # ========================================================
    # SOURCE
    # ========================================================

    @field_validator(
        "source",
        mode="before",
    )
    @classmethod
    def normalize_decision_source(
        cls,
        value,
    ):
        if value is None:
            return None

        text = str(
            value or ""
        ).strip()

        if not text:
            return None

        normalized = (
            normalize_source_name(
                text
            )
        )

        if (
            normalized
            in ALLOWED_SOURCES
        ):
            return normalized

        return None

    # ========================================================
    # DECISION CONSISTENCY
    # ========================================================

    @model_validator(
        mode="after",
    )
    def validate_decision_consistency(
        self,
    ):
        if (
            self.decision
            == "switch_source"
        ):
            if not self.source:
                raise ValueError(
                    "La décision switch_source "
                    "doit préciser une source."
                )

        else:
            self.source = None

        return self