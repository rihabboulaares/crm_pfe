"""
agent.py — Agent CRM avec MCP + LangGraph + Gemini + mémoire Redis.
"""
import asyncio
import logging
import os
import sys
from pathlib import Path
from typing import Annotated, List

from dotenv import load_dotenv
from langchain_core.messages import AnyMessage, HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, StateGraph
from langgraph.prebuilt import ToolNode
from typing import TypedDict
from langgraph.graph.message import add_messages

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from langchain_mcp_adapters.tools import load_mcp_tools

from .memory import (
    clear_history,
    dicts_to_messages,
    load_history,
    messages_to_dicts,
    save_history,
)
from .prompts import SYSTEM_PROMPT

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

logger = logging.getLogger(__name__)
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

# ── Chemin vers server.py et python du venv ───────────────────
_HERE = Path(__file__).resolve().parent
_SERVER_PATH = str(_HERE / "server.py")

# On utilise le même python qui exécute Django
# (celui du venv, pas le python système)
_PYTHON_EXEC = sys.executable
try:
    from django.conf import settings

    CRM_AGENT_DEBUG_TRACE = bool(getattr(settings, "CRM_AGENT_DEBUG_TRACE", False))
except Exception:
    CRM_AGENT_DEBUG_TRACE = False

MCP_SERVER_PARAMS = StdioServerParameters(
    command=_PYTHON_EXEC,   # ← python du venv courant
    args=[_SERVER_PATH],    # ← chemin absolu vers server.py
)


# ── State LangGraph ───────────────────────────────────────────
class CRMState(TypedDict):
    messages: Annotated[List[AnyMessage], add_messages]


# ── Nœud agent ───────────────────────────────────────────────
def make_agent_node(system_prompt: str, tools: list):
    def agent_node(state: CRMState):
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=GOOGLE_API_KEY,
            temperature=0.3,
        ).bind_tools(tools)

        messages = [SystemMessage(content=system_prompt)] + state["messages"]

        if CRM_AGENT_DEBUG_TRACE:
            logger.debug("CRM agent prompt sent to Gemini")
            for msg in messages:
                logger.debug("[%s] %s", type(msg).__name__, str(msg.content)[:300])

        response = llm.invoke(messages)

        if CRM_AGENT_DEBUG_TRACE:
            if isinstance(response.content, list):
                for block in response.content:
                    if isinstance(block, dict):
                        if block.get("type") == "thinking":
                            logger.debug("Gemini reasoning: %s", block.get("thinking", "")[:500])
                        elif block.get("type") == "text":
                            logger.debug("Gemini text: %s", block.get("text", ""))
            else:
                logger.debug("Gemini response: %s", response.content)

            if hasattr(response, "tool_calls") and response.tool_calls:
                for tc in response.tool_calls:
                    logger.debug("Gemini tool call: %s args=%s", tc["name"], tc["args"])
            else:
                logger.debug("Gemini direct response without tool call")

        return {"messages": [response]}

    return agent_node


# ── Condition de routage ──────────────────────────────────────
def should_continue(state: CRMState) -> str:
    last = state["messages"][-1]
    if hasattr(last, "tool_calls") and last.tool_calls:
        return "tools"
    return "end"


# ── Construction du graph ─────────────────────────────────────
def build_crm_agent(system_prompt: str, tools: list):
    graph = StateGraph(CRMState)
    graph.add_node("agent", make_agent_node(system_prompt, tools))
    graph.add_node("tools", ToolNode(tools))
    graph.set_entry_point("agent")
    graph.add_conditional_edges(
        "agent",
        should_continue,
        {"tools": "tools", "end": END},
    )
    graph.add_edge("tools", "agent")
    return graph.compile()


# ── Fonction principale async ─────────────────────────────────
async def chat_with_memory(
    user_id: str,
    user_message: str,
    username: str = "",
    company_id: int = 1,
    current_user_id: int = None,
    current_user_role: str = "",
) -> str:
    system = SYSTEM_PROMPT
    if username:
        system += (
            f"\n\n=== UTILISATEUR CONNECTÉ ===\n"
            f"Nom      : {username}\n"
            f"User ID  : {current_user_id or 'N/A'}\n"
            f"Role     : {current_user_role or 'N/A'}\n"
            f"ID Redis : {user_id}\n"
            f"Company  : {company_id}\n"
            f"Utilise toujours company_id={company_id} dans tous tes appels d'outils.\n"
            f"Si tu crées un prospect, contact, opportunité, tâche ou événement sans assigné explicite, "
            f"utilise assigned_to_id={current_user_id or 'null'} quand l'outil le permet."
        )

    history_dicts = load_history(user_id)
    history = dicts_to_messages(history_dicts)
    history.append(HumanMessage(content=user_message))

    logger.info(
        "CRM agent chat started user_id=%s username=%s company=%s history_messages=%s",
        user_id,
        username,
        company_id,
        len(history) - 1,
    )
    if CRM_AGENT_DEBUG_TRACE:
        logger.debug("CRM agent user message: %s", user_message)
        logger.debug("CRM agent python_exec=%s server_path=%s", _PYTHON_EXEC, _SERVER_PATH)

    async with stdio_client(MCP_SERVER_PARAMS) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await load_mcp_tools(session)

            logger.info("CRM agent MCP connected tools=%s", len(tools))

            agent = build_crm_agent(system_prompt=system, tools=tools)
            result = await agent.ainvoke({"messages": history})

    updated_messages = result["messages"]
    save_history(user_id, messages_to_dicts(updated_messages))

    # Extraction de la réponse finale
    last = updated_messages[-1]

    if isinstance(last.content, list):
        final = next(
            (b["text"] for b in last.content if isinstance(b, dict) and b.get("type") == "text"),
        ""
        )
    elif isinstance(last.content, str):
        final = last.content
    else:
        final = str(last.content)

    return final


# ── Reset mémoire ─────────────────────────────────────────────
def reset_memory(user_id: str) -> str:
    clear_history(user_id)
    return f"🗑️ Historique de {user_id} effacé."
