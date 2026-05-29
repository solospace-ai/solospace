"""
Planner: Semantic pre-router + orchestration schema + plan generation.

Pre-router classifies queries as TRIVIAL/TOOL_USE/COMPLEX using a fast,
cheap model (gemini-2.0-flash-lite) in <300ms to skip heavy planning for
simple requests — the primary driver of 2-5s response times.
"""
import json
from typing import List, Dict, Any, Optional

from providers import call_provider_json

# ─── Semantic Pre-Router ─────────────────────────────────────────────

ROUTER_PROMPT = """Classify this user request into exactly ONE category:

- TRIVIAL: greetings, simple facts, basic explanations, one-sentence answers, translations, math calculations
- TOOL_USE: requires exactly 1 tool (web search OR code execution OR file read) — but NOT multiple agents
- COMPLEX: multi-step reasoning, multi-domain tasks, requires 2+ specialized agents working together

Respond with a JSON object only:
{"category": "TRIVIAL" | "TOOL_USE" | "COMPLEX", "confidence": 0.0-1.0, "reason": "brief explanation"}
"""

ROUTER_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "category": {"type": "STRING", "enum": ["TRIVIAL", "TOOL_USE", "COMPLEX"]},
        "confidence": {"type": "NUMBER"},
        "reason": {"type": "STRING"},
    },
    "required": ["category", "confidence", "reason"],
}


# Fast model per provider for the pre-router (cheapest/fastest tier)
_FAST_ROUTER_MODELS: Dict[str, str] = {
    "gemini": "gemini-2.0-flash-lite",
    "openai": "gpt-4o-mini",
    "claude": "claude-3-5-haiku-20241022",
    "groq": "llama-3.1-8b-instant",
    "deepseek": "deepseek-chat",
    "openrouter": "google/gemini-2.0-flash-lite:free",
    "mistral": "open-mistral-nemo",
    "cerebras": "llama3.1-8b",
}


async def route_request(
    prompt: str,
    provider: str,
    api_key: str,
    api_keys: Optional[Dict[str, str]] = None,
    base_url: Optional[str] = None,
    backup_api_keys: Optional[List[str]] = None,
) -> str:
    """
    Classify the request as TRIVIAL, TOOL_USE, or COMPLEX.
    Uses the fastest available model for the configured provider (<300ms target).
    Falls back to COMPLEX on any failure so we never under-serve.
    """
    fast_model = _FAST_ROUTER_MODELS.get(provider)
    try:
        result = await call_provider_json(
            provider=provider,
            model=fast_model,           # Fast router model for this provider
            api_key=api_key,
            messages=[{"role": "user", "content": prompt}],
            system_prompt=ROUTER_PROMPT,
            temperature=0.1,
            json_schema=ROUTER_SCHEMA,
            timeout=3.0,
            api_keys=api_keys,
            base_url=base_url,
            backup_api_keys=backup_api_keys,
        )
        category = result.get("category", "COMPLEX")
        confidence = result.get("confidence", 0.5)
        # Escalate if unsure
        if confidence < 0.6 and category == "TRIVIAL":
            return "TOOL_USE"
        return category
    except Exception as e:
        print(f"[ROUTER] Classification failed ({e}), defaulting to COMPLEX")
        return "COMPLEX"


# ─── Orchestration Schemas ────────────────────────────────────────────

ORCHESTRATOR_SYSTEM_INSTRUCTION = """
You are Solospace, an elite workflow orchestrator. Your ONLY job is to analyze the user's request and output a JSON list of specialized agents.

CRITICAL RULES:
- For ANY request that involves building, designing, integrating, or researching a non-trivial system, you MUST output at least 2 agents.
- For requests that mention multiple domains (e.g., frontend + backend + database), use 3-6 agents.
- Only output a SINGLE agent ("general") for extremely simple questions like "Hello", "What is AI?", or one-line explanations.
- Classify the complexity field as "complex" if the user asks to build, design, integrate, or analyze a system with 2+ distinct components. If in doubt, prefer "complex" over "simple".

AGENT CREATION:
You can use any senderId, not only the built-in list. Define custom agents freely.
Every agent MUST have:
- senderId: a unique short identifier (e.g., "frontend_ui", "payment_gateway", "data_analyst").
- senderName: a human readable name.
- senderIcon: "code", "science", or "trending_up".
- text: what this agent will contribute.
- objective: specific goal for this agent.
- systemPrompt: detailed instructions for the agent.
- rules: 2-3 specific constraints.
- dependencies: list of other agent ids this agent needs.
- tools: choose from ["Web Search", "Memory", "Code Executor", "Browser", "API Connector"].

DEDUPLICATION:
If existing agents are provided in context, do NOT recreate agents with the same senderId or role.
Only create complementary agents that add genuinely NEW capabilities.
"""

ORCHESTRATION_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "complexity": {
            "type": "STRING",
            "enum": ["simple", "medium", "complex"]
        },
        "capabilities": {"type": "ARRAY", "items": {"type": "STRING"}},
        "thinking_summary": {"type": "STRING"},
        "follow_up_suggestions": {"type": "ARRAY", "items": {"type": "STRING"}},
        "agent_talk": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "senderId": {"type": "STRING"},
                    "senderName": {"type": "STRING"},
                    "senderIcon": {"type": "STRING"},
                    "text": {"type": "STRING"},
                    "objective": {"type": "STRING"},
                    "systemPrompt": {"type": "STRING"},
                    "rules": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "dependencies": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "tools": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "custom_template": {
                        "type": "OBJECT",
                        "properties": {
                            "name": {"type": "STRING"},
                            "icon": {"type": "STRING"},
                            "tag": {"type": "STRING"},
                            "temp": {"type": "NUMBER"},
                            "logic": {"type": "INTEGER"},
                            "col": {"type": "INTEGER"},
                        },
                        "required": ["name", "icon", "tag", "temp", "logic", "col"],
                    },
                },
                "required": [
                    "senderId", "senderName", "senderIcon", "text",
                    "objective", "systemPrompt", "rules", "dependencies", "tools"
                ],
            },
        },
    },
    "required": ["complexity", "capabilities", "thinking_summary", "agent_talk", "follow_up_suggestions"],
}

AGENT_TURN_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "thought": {"type": "STRING"},
        "action": {
            "type": "STRING",
            "enum": [
                "none", "web_search", "execute_code", "api_call",
                "query_memory", "store_memory", "send_message",
                "browse_web", "analyze_image", "read_file"
            ],
        },
        "action_input": {"type": "STRING"},
        "final_answer": {"type": "STRING"},
    },
    "required": ["thought", "action"],
}

RESPONSE_SYSTEM_INSTRUCTION = """
You are Solospace, an elite assistant.
Your job is to produce a clean, direct response to the user's prompt using the provided context.

STRICT RULES — NEVER VIOLATE:
- Do NOT include any preamble, header, or status line such as "[Agent processing...]", "Synthesizing...", "From the agent team:", or similar.
- Do NOT mention agents, sub-tasks, specialists, orchestration, or internal workflow mechanics.
- Begin your response immediately and directly with the answer.
- Use clean, well-structured markdown only when it genuinely helps the user.
- For conversational messages (e.g. greetings), reply naturally and concisely without any structure.
"""

# ─── Default Fallback Plan ────────────────────────────────────────────

DEFAULT_PLAN = {
    "complexity": "simple",
    "capabilities": [],
    "thinking_summary": "System defaulted to general mode.",
    "agent_talk": [
        {
            "senderId": "general",
            "senderName": "General Assistant",
            "senderIcon": "bot",
            "text": "Standing by to process your request.",
            "objective": "Process user requests with precise analysis.",
            "systemPrompt": "You are Solospace core.",
            "rules": ["Be descriptive"],
            "dependencies": [],
            "tools": ["Web Search", "Memory"],
        }
    ],
    "follow_up_suggestions": [
        "Can you elaborate?",
        "Show me a detailed implementation example.",
    ],
}


async def generate_plan(
    messages: List[Dict[str, str]],
    provider: str,
    model: Optional[str],
    api_key: str,
    api_keys: Optional[Dict[str, str]] = None,
    base_url: Optional[str] = None,
    fallback_provider: Optional[str] = None,
    backup_api_keys: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Call the planning LLM to generate an agent plan.
    Returns DEFAULT_PLAN on failure.
    """
    try:
        plan = await call_provider_json(
            provider=provider,
            model=model,
            api_key=api_key,
            messages=messages,
            system_prompt=ORCHESTRATOR_SYSTEM_INSTRUCTION,
            temperature=0.2,
            json_schema=ORCHESTRATION_SCHEMA,
            timeout=20.0,
            fallback_provider=fallback_provider,
            api_keys=api_keys,
            base_url=base_url,
            backup_api_keys=backup_api_keys,
        )
        return plan
    except Exception as e:
        print(f"[PLANNER] Planning failed: {e}")
        return DEFAULT_PLAN.copy()


async def summarize_history(
    history: List[Dict[str, str]],
    provider: str,
    api_key: str,
    api_keys: Optional[Dict[str, str]] = None,
    base_url: Optional[str] = None,
    backup_api_keys: Optional[List[str]] = None,
) -> List[Dict[str, str]]:
    """
    If history is long (greater than 6 turns / 12 messages), summarize the oldest messages
    and replace them with a single system summary context message to save tokens.
    """
    if len(history) <= 12:
        return history

    # Divide history into parts to summarize and parts to keep
    to_summarize = history[:-6]
    to_keep = history[-6:]

    # Prepare summary prompt
    convo_text = ""
    for msg in to_summarize:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        convo_text += f"{role.upper()}: {content}\n"

    summary_prompt = f"Summarize the following chat history conversation concisely in one paragraph, capturing key decisions, user goals, and state of execution:\n\n{convo_text}"
    
    from core.planner import _FAST_ROUTER_MODELS
    from providers import call_provider
    
    fast_model = _FAST_ROUTER_MODELS.get(provider)
    
    try:
        summary_text = await call_provider(
            provider=provider,
            model=fast_model,
            api_key=api_key,
            messages=[{"role": "user", "content": summary_prompt}],
            system_prompt="You are a precise summarization assistant.",
            temperature=0.3,
            timeout=8.0,
            api_keys=api_keys,
            base_url=base_url,
            backup_api_keys=backup_api_keys,
        )
        summary_msg = {
            "role": "user",
            "content": f"[SYSTEM: Summary of previous conversation history: {summary_text}]"
        }
        return [summary_msg] + to_keep
    except Exception as e:
        print(f"[CONTEXT WINDOWING] Summarization failed: {e}. Returning original history.")
        return history

