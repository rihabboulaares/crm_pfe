from django.db import transaction

from agentEngagement.models import ProspectEngagementMemory


def _model_dump(value):
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if hasattr(value, "dict"):
        return value.dict()
    return dict(value or {})


def _clean_text(value):
    text = str(value or "").strip()
    return text or None


def _merge_unique(existing, values):
    merged = []
    seen = set()

    for value in list(existing or []) + list(values or []):
        text = str(value or "").strip()
        if not text:
            continue

        key = text.casefold()
        if key in seen:
            continue

        seen.add(key)
        merged.append(text)

    return merged


def _merge_fact(existing_facts, fact):
    facts = list(existing_facts or [])

    key = str(
        fact.get("key")
        or ""
    ).strip()

    value = str(
        fact.get("value")
        or ""
    ).strip()

    source = str(
        fact.get("source")
        or ""
    ).strip()

    if not key or not value:
        return facts

    fact_key = (
        key.casefold(),
        value.casefold(),
        source.casefold(),
        fact.get("source_interaction_id"),
    )

    for existing in facts:
        existing_key = (
            str(
                existing.get("key")
                or ""
            ).casefold(),
            str(
                existing.get("value")
                or ""
            ).casefold(),
            str(
                existing.get("source")
                or ""
            ).casefold(),
            existing.get("source_interaction_id"),
        )

        if existing_key == fact_key:
            return facts

    facts.append(fact)
    return facts


def serialize_memory(memory):
    if not memory:
        return None

    return {
        "relationship_summary":
            memory.relationship_summary,

        "interest_level":
            memory.interest_level,

        "current_solution":
            memory.current_solution,

        "known_needs":
            memory.known_needs,

        "known_pain_points":
            memory.known_pain_points,

        "known_objections":
            memory.known_objections,

        "known_requests":
            memory.known_requests,

        "buying_signals":
            memory.buying_signals,

        "confirmed_facts":
            memory.confirmed_facts,

        "inferred_signals":
            memory.inferred_signals,

        "timing":
            memory.timing,

        "decision_role":
            memory.decision_role,

        "preferred_channel":
            memory.preferred_channel,

        "last_interaction_channel":
            memory.last_interaction_channel,

        "last_interaction_outcome":
            memory.last_interaction_outcome,

        "last_strategy":
            memory.last_strategy,

        "last_objective":
            memory.last_objective,

        "next_direction":
            memory.next_direction,

        "last_analysis_confidence":
            memory.last_analysis_confidence,

        "updated_at":
            (
                memory.updated_at.isoformat()
                if memory.updated_at
                else None
            ),
    }


class EngagementMemoryManager:
    """
    Maintient une mémoire synthétique par prospect.

    L'historique chronologique brut reste dans ProspectActivity,
    EngagementLog et HistoryLog.
    """

    def get_or_create_for_prospect(
        self,
        prospect,
    ):
        """
        Lecture/création simple hors mise à jour concurrente.

        Les méthodes d'écriture utilisent _get_locked_memory()
        dans une transaction atomique.
        """
        memory, _ = (
            ProspectEngagementMemory.objects
            .get_or_create(
                prospect=prospect
            )
        )
        return memory

    def _get_locked_memory(
        self,
        prospect,
    ):
        """
        Retourne la mémoire du prospect verrouillée pour la transaction courante.

        Important :
        select_for_update() ne peut verrouiller qu'une ligne existante.
        Pour le premier accès, on crée donc la ligne si nécessaire, puis on la
        relit avec select_for_update().

        Cette méthode doit toujours être appelée à l'intérieur de
        transaction.atomic().
        """
        prospect_id = getattr(
            prospect,
            "pk",
            prospect,
        )

        memory = (
            ProspectEngagementMemory.objects
            .select_for_update()
            .filter(
                prospect_id=prospect_id
            )
            .first()
        )

        if memory is not None:
            return memory

        # Premier accès à la mémoire. La contrainte OneToOne garantit
        # qu'une seule mémoire peut exister par prospect.
        try:
            ProspectEngagementMemory.objects.create(
                prospect_id=prospect_id
            )
        except Exception:
            # Une requête concurrente peut avoir créé la ligne entre-temps.
            # On la relit ensuite sous verrou.
            pass

        return (
            ProspectEngagementMemory.objects
            .select_for_update()
            .get(
                prospect_id=prospect_id
            )
        )

    def update_from_analysis(
        self,
        prospect,
        interaction,
        analysis,
    ):
        interaction = interaction or {}

        analysis_data = _model_dump(
            analysis
        )

        source_interaction_id = (
            interaction.get("id")
        )

        with transaction.atomic():
            memory = (
                self._get_locked_memory(
                    prospect
                )
            )

            memory.interest_level = (
                analysis_data.get(
                    "interest_level"
                )
                or memory.interest_level
                or "UNKNOWN"
            )

            memory.known_pain_points = (
                _merge_unique(
                    memory.known_pain_points,
                    analysis_data.get(
                        "pain_points"
                    )
                    or [],
                )
            )

            memory.known_objections = (
                _merge_unique(
                    memory.known_objections,
                    [
                        item.get("type")
                        for item
                        in (
                            analysis_data.get(
                                "objections"
                            )
                            or []
                        )
                        if isinstance(
                            item,
                            dict,
                        )
                    ],
                )
            )

            memory.known_requests = (
                _merge_unique(
                    memory.known_requests,
                    analysis_data.get(
                        "requests"
                    )
                    or [],
                )
            )

            memory.buying_signals = (
                _merge_unique(
                    memory.buying_signals,
                    analysis_data.get(
                        "buying_signals"
                    )
                    or [],
                )
            )

            memory.inferred_signals = (
                _merge_unique(
                    memory.inferred_signals,
                    analysis_data.get(
                        "inferred_signals"
                    )
                    or [],
                )
            )

            current_solution = _clean_text(
                analysis_data.get(
                    "current_solution"
                )
            )

            if current_solution:
                memory.current_solution = (
                    current_solution
                )

            timing = _clean_text(
                analysis_data.get(
                    "timing"
                )
            )

            if timing:
                memory.timing = timing

            decision_role = _clean_text(
                analysis_data.get(
                    "decision_role_signal"
                )
            )

            if decision_role:
                memory.decision_role = (
                    decision_role
                )

            for fact in (
                analysis_data.get(
                    "explicit_facts"
                )
                or []
            ):
                if not isinstance(
                    fact,
                    dict,
                ):
                    continue

                confirmed_fact = {
                    "key":
                        fact.get("key"),

                    "value":
                        fact.get("value"),

                    "source_interaction_id":
                        source_interaction_id,

                    "source":
                        fact.get("source"),

                    "confidence":
                        fact.get("confidence"),
                }

                memory.confirmed_facts = (
                    _merge_fact(
                        memory.confirmed_facts,
                        confirmed_fact,
                    )
                )

                if (
                    str(
                        fact.get("key")
                        or ""
                    )
                    .strip()
                    .casefold()
                    == "current_solution"
                    and _clean_text(
                        fact.get("value")
                    )
                ):
                    memory.current_solution = (
                        _clean_text(
                            fact.get("value")
                        )
                    )

            memory.last_interaction_channel = (
                _clean_text(
                    interaction.get(
                        "channel"
                    )
                )
                or memory.last_interaction_channel
            )

            memory.last_interaction_outcome = (
                _clean_text(
                    interaction.get(
                        "outcome"
                    )
                )
                or memory.last_interaction_outcome
            )

            memory.next_direction = (
                _clean_text(
                    analysis_data.get(
                        "recommended_direction"
                    )
                )
                or memory.next_direction
            )

            memory.last_analysis_confidence = (
                analysis_data.get(
                    "confidence"
                )
            )

            strategy_reference = (
                interaction.get(
                    "strategy_reference"
                )
                or {}
            )

            if isinstance(
                strategy_reference,
                dict,
            ):
                memory.last_strategy = (
                    _clean_text(
                        strategy_reference.get(
                            "strategy"
                        )
                    )
                    or memory.last_strategy
                )

                memory.last_objective = (
                    _clean_text(
                        strategy_reference.get(
                            "objective"
                        )
                    )
                    or memory.last_objective
                )

            summary = _clean_text(
                analysis_data.get(
                    "summary"
                )
            )

            if summary:
                memory.relationship_summary = (
                    summary
                )

            memory.save()

            return memory

    def update_from_plan(
        self,
        prospect,
        plan,
    ):
        plan_data = _model_dump(
            plan
        )

        with transaction.atomic():
            memory = (
                self._get_locked_memory(
                    prospect
                )
            )

            memory.last_strategy = (
                _clean_text(
                    plan_data.get(
                        "strategy"
                    )
                )
                or memory.last_strategy
            )

            memory.last_objective = (
                _clean_text(
                    plan_data.get(
                        "objective"
                    )
                )
                or memory.last_objective
            )

            memory.save(
                update_fields=[
                    "last_strategy",
                    "last_objective",
                    "updated_at",
                ]
            )

            return memory