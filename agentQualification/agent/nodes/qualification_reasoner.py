import logging

from agentEngagement.gemini_client import (
    extract_json,
    generate_with_retry,
    get_gemini_model,
    repair_json_with_gemini,
)
from agentQualification.prompts.qualification_prompt import SCHEMA_HINT, build_qualification_prompt
from agentQualification.schemas import QualificationAIResult

logger = logging.getLogger("agentQualification.reasoner")


class QualificationAIUnavailable(Exception):
    pass


def qualification_reasoner(state):
    prompt = build_qualification_prompt(state)

    try:
        model = get_gemini_model(max_output_tokens=3072, temperature=0.05, top_p=0.7)
        response = generate_with_retry(
            model,
            prompt,
            max_retries=1,
            wait_seconds=1,
            log_prefix="qualification-agent",
        )
        if not response or not getattr(response, "text", None):
            raise ValueError("empty_gemini_response")
        try:
            payload = extract_json(response.text)
            ai = QualificationAIResult(**payload)
        except Exception:
            repaired = repair_json_with_gemini(model, response.text, SCHEMA_HINT, max_retries=1)
            ai = QualificationAIResult(**repaired)
    except Exception as exc:
        logger.exception("Qualification Gemini analysis failed prospect=%s", state.get("prospect_id"))
        state["errors"] = (state.get("errors") or []) + [str(exc)]
        raise QualificationAIUnavailable("qualification_ai_unavailable") from exc

    state["ai_result"] = ai.model_dump() if hasattr(ai, "model_dump") else ai.dict()
    return state
