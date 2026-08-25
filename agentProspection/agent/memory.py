from dataclasses import dataclass, field
from typing import Any


@dataclass
class AgentMemory:
    query: str
    company_id: int
    user_id: int

    intent: dict[str, Any] | None = None
    plan: dict[str, Any] | None = None
    decision: dict[str, Any] | None = None

    brain_mode: str = "gemini"

    current_state: str = "init"
    current_phase: str = "init"

    iterations: int = 0
    stop_reason: str | None = None

    # ========================================================
    # HARD LIMITS
    # ========================================================

    max_iterations: int = 12
    max_leads: int = 10
    max_urls: int = 20
    max_pages_per_domain: int = 4

    # ========================================================
    # AGENTIC DECISION BUDGET
    # ========================================================

    # Nombre maximum d'appels Gemini utilisés uniquement
    # pour les décisions stratégiques après l'intent.
    #
    # L'appel Gemini d'extraction d'intent n'est PAS inclus.
    max_decision_calls: int = 2

    # Nombre d'appels de décision réellement consommés.
    decision_calls_used: int = 0

    # ========================================================
    # DECISIONS
    # ========================================================

    gemini_decisions: list[dict[str, Any]] = field(
        default_factory=list
    )

    # ========================================================
    # TOOL HISTORY
    # ========================================================

    tool_history: list[dict[str, Any]] = field(
        default_factory=list
    )

    raw_results: list[dict[str, Any]] = field(
        default_factory=list
    )

    # ========================================================
    # PROSPECTS
    # ========================================================

    companies: list[dict[str, Any]] = field(
        default_factory=list
    )

    persons: list[dict[str, Any]] = field(
        default_factory=list
    )

    prospects: list[dict[str, Any]] = field(
        default_factory=list
    )

    # ========================================================
    # META ADS
    # ========================================================

    pending_verification: list[dict[str, Any]] = field(
        default_factory=list
    )

    verification_history: list[dict[str, Any]] = field(
        default_factory=list
    )

    # ========================================================
    # DIAGNOSTICS
    # ========================================================

    rejected_results: list[dict[str, Any]] = field(
        default_factory=list
    )

    errors: list[dict[str, str]] = field(
        default_factory=list
    )

    logs: list[dict[str, Any]] = field(
        default_factory=list
    )

    # ========================================================
    # PHASE
    # ========================================================

    def set_phase(
        self,
        phase: str,
    ):
        self.current_phase = phase
        self.current_state = phase

        self.add_log(
            "phase",
            phase,
        )

    # ========================================================
    # LOG
    # ========================================================

    def add_log(
        self,
        step: str,
        message: str,
        **extra,
    ):
        self.logs.append(
            {
                "step": step,
                "message": str(message),
                **extra,
            }
        )

    # ========================================================
    # ERROR
    # ========================================================

    def add_error(
        self,
        step: str,
        message: str,
    ):
        self.errors.append(
            {
                "step": step,
                "message": str(message),
            }
        )

        self.add_log(
            "error",
            f"{step}: {message}",
        )

    # ========================================================
    # TOOL HISTORY
    # ========================================================

    def add_tool_call(
        self,
        tool: str,
        query: str | dict,
        decision: dict[str, Any] | None = None,
    ):
        page = 1

        if isinstance(
            query,
            dict,
        ):
            page = int(
                query.get("page")
                or 1
            )

            query_value = str(
                query.get("q")
                or query.get("query")
                or ""
            )

        else:
            query_value = str(
                query
            )

        self.tool_history.append(
            {
                "tool": tool,
                "query": query_value,
                "page": page,
                "decision": (
                    decision or {}
                ).get(
                    "decision"
                ),
                "reason": (
                    decision or {}
                ).get(
                    "reason"
                ),
                "decision_source": (
                    decision or {}
                ).get(
                    "source"
                ),
                "decision_origin": (
                    decision or {}
                ).get(
                    "origin"
                ),
            }
        )

    # ========================================================
    # TOOL DUPLICATE
    # ========================================================

    def already_used(
        self,
        tool: str,
        query: str | dict,
    ) -> bool:
        page = 1

        if isinstance(
            query,
            dict,
        ):
            page = int(
                query.get("page")
                or 1
            )

            query_value = str(
                query.get("q")
                or query.get("query")
                or ""
            )

        else:
            query_value = str(
                query
            )

        return any(
            item.get("tool") == tool
            and item.get("query") == query_value
            and int(
                item.get("page")
                or 1
            )
            == page
            for item in self.tool_history
        )

    # ========================================================
    # DECISION
    # ========================================================

    def add_decision(
        self,
        decision: dict[str, Any],
    ):
        """
        Enregistre la décision stratégique prise pendant le run.

        La décision peut venir :
        - de Gemini ;
        - d'un fallback déterministe ;
        - d'un garde-fou de budget.
        """

        self.decision = dict(
            decision or {}
        )

        self.gemini_decisions.append(
            self.decision
        )

        self.add_log(
            "decision",
            (
                self.decision.get("reason")
                or self.decision.get("decision")
                or ""
            ),
            decision=
                self.decision.get(
                    "decision"
                ),
            source=
                self.decision.get(
                    "source"
                ),
            confidence=
                self.decision.get(
                    "confidence"
                ),
            origin=
                self.decision.get(
                    "origin"
                ),
        )

    # ========================================================
    # DECISION BUDGET
    # ========================================================

    def decision_budget_available(
        self,
    ) -> bool:
        """
        True s'il reste du budget pour un appel Gemini
        de décision stratégique.

        L'extraction initiale de l'intent est indépendante
        de ce compteur.
        """

        return (
            self.decision_calls_used
            < self.max_decision_calls
        )

    def register_decision_call(
        self,
    ):
        """
        Consomme exactement une unité du budget de décision.

        Cette méthode doit être appelée uniquement lorsqu'un
        vrai appel Gemini de décision va être effectué.
        """

        if not self.decision_budget_available():
            raise RuntimeError(
                "Budget Gemini de décision dépassé."
            )

        self.decision_calls_used += 1

        self.add_log(
            "decision_budget",
            (
                "Appel Gemini de décision consommé : "
                f"{self.decision_calls_used}/"
                f"{self.max_decision_calls}"
            ),
        )

    # ========================================================
    # DECISION CONTEXT
    # ========================================================

    def decision_context(
        self,
    ) -> str:
        """
        Résumé court de l'état réel du run envoyé à Gemini.

        On ne transmet pas :
        - les résultats bruts complets ;
        - les données CRM ;
        - les logs complets ;
        - les secrets ;
        - les tokens.

        Gemini reçoit uniquement les informations utiles
        pour choisir la prochaine stratégie.
        """

        companies, persons = (
            self.crm_ready_entities()
        )

        valid_count = (
            len(companies)
            + len(persons)
        )

        target = int(
            self.max_leads
            or 0
        )

        # ----------------------------------------------------
        # RAW RESULTS COUNT
        # ----------------------------------------------------

        raw_count = 0

        for item in self.raw_results:
            if not isinstance(
                item,
                dict,
            ):
                continue

            results = (
                item.get("results")
                or []
            )

            if isinstance(
                results,
                list,
            ):
                raw_count += len(
                    results
                )

        # ----------------------------------------------------
        # SOURCES / TOOLS USED
        # ----------------------------------------------------

        tools_tried = []

        for item in self.tool_history:
            tool = str(
                item.get("tool")
                or ""
            ).strip()

            if (
                tool
                and tool not in tools_tried
            ):
                tools_tried.append(
                    tool
                )

        # ----------------------------------------------------
        # REJECTION REASONS
        # ----------------------------------------------------

        rejection_reasons: dict[
            str,
            int,
        ] = {}

        for item in (
            self.rejected_results[-30:]
        ):
            if not isinstance(
                item,
                dict,
            ):
                continue

            reason = str(
                item.get(
                    "rejection_reason"
                )
                or item.get(
                    "rejected_reason"
                )
                or item.get(
                    "reason"
                )
                or "raison inconnue"
            ).strip()

            if not reason:
                reason = (
                    "raison inconnue"
                )

            rejection_reasons[
                reason
            ] = (
                rejection_reasons.get(
                    reason,
                    0,
                )
                + 1
            )

        top_rejections = sorted(
            rejection_reasons.items(),
            key=lambda pair: pair[1],
            reverse=True,
        )[:3]

        rejections_text = (
            ", ".join(
                (
                    f"{reason} "
                    f"({count})"
                )
                for reason, count
                in top_rejections
            )
            or "aucun rejet notable"
        )

        # ----------------------------------------------------
        # INTENT
        # ----------------------------------------------------

        intent = (
            self.intent
            or {}
        )

        lead_types = (
            intent.get(
                "lead_types"
            )
            or []
        )

        industries = (
            intent.get(
                "industries"
            )
            or []
        )

        locations = (
            intent.get(
                "locations"
            )
            or []
        )

        roles = (
            intent.get(
                "target_roles"
            )
            or []
        )

        search_keywords = (
            intent.get(
                "search_keywords"
            )
            or []
        )

        # ----------------------------------------------------
        # PLAN
        # ----------------------------------------------------

        planned_sources = []

        for item in (
            (self.plan or {})
            .get(
                "searches",
                [],
            )
        ):
            if not isinstance(
                item,
                dict,
            ):
                continue

            source = str(
                item.get(
                    "source"
                )
                or ""
            ).strip()

            if (
                source
                and source
                not in planned_sources
            ):
                planned_sources.append(
                    source
                )

        # ----------------------------------------------------
        # PENDING META
        # ----------------------------------------------------

        pending_meta = len(
            self.pending_verification
        )

        # ----------------------------------------------------
        # FINAL SHORT CONTEXT
        # ----------------------------------------------------

        lines = [
            (
                f"Objectif : {target} "
                "prospects valides demandés."
            ),

            (
                f"Actuellement : {valid_count} "
                "prospects valides trouvés."
            ),

            (
                f"Résultats bruts observés : "
                f"{raw_count}."
            ),

            (
                "Type recherché : "
                f"{', '.join(lead_types) or 'non précisé'}."
            ),

            (
                "Secteur : "
                f"{', '.join(industries) or 'non précisé'}."
            ),

            (
                "Rôle ciblé : "
                f"{', '.join(roles) or 'aucun'}."
            ),

            (
                "Localisation : "
                f"{', '.join(locations) or 'Tunisie'}."
            ),

            (
                "Mots-clés métier : "
                f"{', '.join(search_keywords) or 'aucun'}."
            ),

            (
                "Sources prévues : "
                f"{', '.join(planned_sources) or 'aucune'}."
            ),

            (
                "Outils déjà utilisés : "
                f"{', '.join(tools_tried) or 'aucun'}."
            ),

            (
                "Principaux motifs de rejet : "
                f"{rejections_text}."
            ),

            (
                "Candidats Meta Ads en attente "
                f"de vérification : {pending_meta}."
            ),

            (
                "Décisions Gemini déjà consommées : "
                f"{self.decision_calls_used}/"
                f"{self.max_decision_calls}."
            ),
        ]

        return "\n".join(
            lines
        )

    # ========================================================
    # PROSPECTS
    # ========================================================

    def refresh_prospects(
        self,
    ):
        self.prospects = (
            self.companies
            + self.persons
        )

    def add_lead(
        self,
        lead: dict[str, Any],
    ):
        if (
            lead.get("lead_type")
            == "person"
        ):
            self.persons.append(
                lead
            )

        else:
            self.companies.append(
                lead
            )

        self.refresh_prospects()

    # ========================================================
    # VALID ENTITIES
    # ========================================================

    def valid_companies(
        self,
    ) -> list[dict[str, Any]]:
        return [
            item
            for item in self.companies
            if (
                item.get("crm_ready")
                or item.get("is_valid")
                is True
            )
        ]

    def valid_persons(
        self,
    ) -> list[dict[str, Any]]:
        return [
            item
            for item in self.persons
            if (
                item.get("crm_ready")
                or item.get("is_valid")
                is True
            )
        ]

    def crm_ready_entities(
        self,
    ) -> tuple[
        list[dict[str, Any]],
        list[dict[str, Any]],
    ]:
        companies = [
            item
            for item in self.companies
            if item.get("crm_ready")
        ]

        persons = [
            item
            for item in self.persons
            if item.get("crm_ready")
        ]

        return (
            companies,
            persons,
        )

    # ========================================================
    # META ADS PENDING
    # ========================================================

    def add_pending_verification(
        self,
        lead: dict[str, Any],
    ):
        self.pending_verification.append(
            lead
        )

        self.add_log(
            "verification_pending",
            (
                "Candidat en attente de vérification : "
                f"{lead.get('company_name') or 'inconnu'}"
            ),
        )

    # ========================================================
    # SUMMARY
    # ========================================================

    def to_summary(
        self,
    ) -> dict[str, Any]:
        return {
            "query":
                self.query,

            "company_id":
                self.company_id,

            "user_id":
                self.user_id,

            "intent":
                self.intent,

            "plan":
                self.plan,

            "brain_mode":
                self.brain_mode,

            "current_state":
                self.current_state,

            "current_phase":
                self.current_phase,

            "iterations":
                self.iterations,

            # =================================================
            # AGENTIC DECISIONS
            # =================================================

            "decision_calls_used":
                self.decision_calls_used,

            "max_decision_calls":
                self.max_decision_calls,

            "decision_budget_available":
                self.decision_budget_available(),

            "decision_trace":
                self.gemini_decisions,

            # =================================================
            # TOOLS
            # =================================================

            "tools_used":
                self.tool_history[-12:],

            "all_tools_used":
                self.tool_history,

            "tool_call_counts": {
                tool: sum(
                    1
                    for item in self.tool_history
                    if item.get("tool")
                    == tool
                )
                for tool in {
                    item.get("tool")
                    for item in self.tool_history
                    if item.get("tool")
                }
            },

            "query_variants_used":
                list(
                    dict.fromkeys(
                        item.get("query")
                        for item
                        in self.tool_history
                        if item.get("query")
                    )
                ),

            # =================================================
            # LEADS
            # =================================================

            "companies_count":
                len(
                    self.companies
                ),

            "persons_count":
                len(
                    self.persons
                ),

            "valid_leads_count":
                (
                    len(
                        self.valid_companies()
                    )
                    +
                    len(
                        self.valid_persons()
                    )
                ),

            "pending_verification_count":
                len(
                    self.pending_verification
                ),

            # =================================================
            # LIMITS
            # =================================================

            "limits": {
                "max_iterations":
                    self.max_iterations,

                "max_leads":
                    self.max_leads,

                "max_urls":
                    self.max_urls,

                "max_pages_per_domain":
                    self.max_pages_per_domain,

                "max_decision_calls":
                    self.max_decision_calls,
            },

            "companies_sample":
                self.companies[-8:],

            "persons_sample":
                self.persons[-8:],

            "rejected_results_count":
                len(
                    self.rejected_results
                ),

            "errors":
                self.errors[-8:],
        }

    # ========================================================
    # DICT
    # ========================================================

    def to_dict(
        self,
    ):
        return {
            "query":
                self.query,

            "company_id":
                self.company_id,

            "user_id":
                self.user_id,

            "intent":
                self.intent,

            "plan":
                self.plan,

            "decision":
                self.decision,

            "brain_mode":
                self.brain_mode,

            # =================================================
            # AGENTIC DECISIONS
            # =================================================

            "gemini_decisions":
                self.gemini_decisions,

            "decision_calls_used":
                self.decision_calls_used,

            "max_decision_calls":
                self.max_decision_calls,

            "decision_budget_available":
                self.decision_budget_available(),

            # =================================================
            # STATE
            # =================================================

            "current_state":
                self.current_state,

            "current_phase":
                self.current_phase,

            "iterations":
                self.iterations,

            # =================================================
            # TOOLS / RESULTS
            # =================================================

            "tool_history":
                self.tool_history,

            "raw_results":
                self.raw_results[-20:],

            # =================================================
            # LEADS
            # =================================================

            "companies":
                self.companies,

            "persons":
                self.persons,

            "prospects":
                self.prospects,

            # =================================================
            # META ADS
            # =================================================

            "pending_verification":
                self.pending_verification,

            "verification_history":
                self.verification_history,

            # =================================================
            # DIAGNOSTICS
            # =================================================

            "rejected_results":
                self.rejected_results[-20:],

            "errors":
                self.errors,

            "logs":
                self.logs,
        }