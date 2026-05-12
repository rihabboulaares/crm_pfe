"""
Mémoire persistante avec Redis.
Chaque user_id a son propre historique de conversation.
Si Redis n'est pas disponible, on tombe sur une mémoire en RAM.
"""
import json
import os
from typing import List

try:
    import redis
    _redis_client = redis.Redis(
        host=os.getenv("REDIS_HOST", "localhost"),
        port=int(os.getenv("REDIS_PORT", 6379)),
        db=0,
        decode_responses=True,
    )
    _redis_client.ping()
    REDIS_AVAILABLE = True
    print("[Memory] Redis connecté ✅")
except Exception:
    REDIS_AVAILABLE = False
    print("[Memory] Redis non disponible — mémoire RAM utilisée ⚠️")

# Fallback en RAM si Redis absent
_ram_store = {}

# TTL : 7 jours en secondes
HISTORY_TTL = 60 * 60 * 24 * 7
# Nombre max de messages conservés par session
MAX_MESSAGES = 40


def _key(user_id: str) -> str:
    return f"crm_agent:history:{user_id}"


def load_history(user_id: str) -> List[dict]:
    """Charge l'historique d'un utilisateur (liste de dicts {role, content})."""
    if REDIS_AVAILABLE:
        raw = _redis_client.get(_key(user_id))
        if raw:
            return json.loads(raw)
        return []
    return _ram_store.get(user_id, [])


def save_history(user_id: str, messages: List[dict]) -> None:
    """Sauvegarde l'historique, en ne gardant que les MAX_MESSAGES derniers."""
    # Tronquer pour éviter les débordements de contexte
    messages = messages[-MAX_MESSAGES:]

    if REDIS_AVAILABLE:
        _redis_client.setex(
            _key(user_id),
            HISTORY_TTL,
            json.dumps(messages, ensure_ascii=False),
        )
    else:
        _ram_store[user_id] = messages


def clear_history(user_id: str) -> None:
    """Efface l'historique d'un utilisateur."""
    if REDIS_AVAILABLE:
        _redis_client.delete(_key(user_id))
    else:
        _ram_store.pop(user_id, None)


def messages_to_dicts(messages) -> List[dict]:
    """Convertit les objets LangChain Message en dicts sérialisables."""
    result = []
    for m in messages:
        role = getattr(m, "type", None) or m.__class__.__name__.replace("Message", "").lower()
        # LangChain : HumanMessage → "human", AIMessage → "ai"
        if role == "human":
            role = "user"
        content = m.content if isinstance(m.content, str) else str(m.content)
        result.append({"role": role, "content": content})
    return result


def dicts_to_messages(dicts: List[dict]):
    """Convertit les dicts sérialisés en objets LangChain Message."""
    from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
    mapping = {
        "user": HumanMessage,
        "human": HumanMessage,
        "ai": AIMessage,
        "assistant": AIMessage,
        "system": SystemMessage,
    }
    messages = []
    for d in dicts:
        cls = mapping.get(d["role"], HumanMessage)
        messages.append(cls(content=d["content"]))
    return messages