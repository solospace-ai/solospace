"""
Solospace AI OS — FastAPI Application
Slim entry point: routes + middleware only.
All business logic lives in core/, tools/, storage/, and security/.
"""
import json
import time
import asyncio
import httpx
from contextlib import asynccontextmanager
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from storage.database import (
    init_db,
    load_sessions,
    load_session,
    delete_session,
    save_session,
    update_tool_approval,
    update_tool_approval_wildcard,
)
from core.planner import route_request, generate_plan, DEFAULT_PLAN
from core.synthesizer import run_agent_execution_loop
from providers import (
    get_available_providers,
    resolve_api_key,
    fetch_models_from_provider,
)
from security.guards import check_jailbreak


# ─── Lifespan: Initialize DB on startup ──────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Solospace AI OS", lifespan=lifespan)

from streaming.websocket import router as ws_router
app.include_router(ws_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "https://*.vercel.app", "https://*.netlify.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Rate Limiting Middleware ─────────────────────────────────────────

_ip_rate_limits: Dict[str, Dict] = {}


@app.middleware("http")
async def ip_rate_limit_middleware(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)
    client_ip = request.client.host if request.client else "unknown"
    info = _ip_rate_limits.setdefault(client_ip, {"count": 0, "window_start": time.time()})
    now = time.time()
    if now - info["window_start"] > 60:
        info["count"] = 0
        info["window_start"] = now
    info["count"] += 1
    if info["count"] > 40:
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Please wait before making more requests."},
        )
    return await call_next(request)


# ─── Request / Response Models ────────────────────────────────────────

class Message(BaseModel):
    sender: str
    text: str


class OrchestrateRequest(BaseModel):
    prompt: str
    history: Optional[List[Message]] = []
    api_key: Optional[str] = None
    session_id: Optional[str] = None
    execute_agents: bool = True
    provider: str = "gemini"
    model: Optional[str] = None
    fallback_provider: Optional[str] = None
    api_keys: Optional[Dict[str, str]] = None
    base_url: Optional[str] = None
    existing_nodes: Optional[List[Dict[str, Any]]] = None
    existing_edges: Optional[List[Dict[str, Any]]] = None
    mode: Optional[str] = "auto"
    backup_api_keys: Optional[List[str]] = None


class ExecuteCustomRequest(BaseModel):
    session_id: str
    api_key: str
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    prompt: str
    history: Optional[List[Message]] = []
    provider: str = "gemini"
    model: Optional[str] = None
    fallback_provider: Optional[str] = None
    api_keys: Optional[Dict[str, str]] = None
    base_url: Optional[str] = None
    backup_api_keys: Optional[List[str]] = None


class ApprovalRequest(BaseModel):
    sessionId: str
    nodeId: str
    toolName: str
    action: str  # "approve" or "deny"
    logId: Optional[str] = None


class SaveSessionRequest(BaseModel):
    session_id: str
    title: str
    prompt: str
    mode: str
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    chat_messages: List[Dict[str, Any]]
    agent_talk_logs: List[Dict[str, Any]]
    execution_state: str
    status_message: str
    follow_up_suggestions: List[str]


class EchoHouseInitRequest(BaseModel):
    problem_text: str
    provider: str = "gemini"
    model: Optional[str] = None
    api_key: Optional[str] = None
    api_keys: Optional[Dict[str, str]] = None
    base_url: Optional[str] = None
    backup_api_keys: Optional[List[str]] = None


class EchoHouseSimulateRequest(BaseModel):
    session_id: str
    problem_text: str
    cast: List[Dict[str, Any]]
    provider: str = "gemini"
    model: Optional[str] = None
    api_key: Optional[str] = None
    api_keys: Optional[Dict[str, str]] = None
    base_url: Optional[str] = None
    rounds: int = 3
    tone: str = "realistic"
    backup_api_keys: Optional[List[str]] = None


class EchoHouseTakeawaysRequest(BaseModel):
    simulation_text: str
    problem_text: str
    provider: str = "gemini"
    model: Optional[str] = None
    api_key: Optional[str] = None
    api_keys: Optional[Dict[str, str]] = None
    base_url: Optional[str] = None
    backup_api_keys: Optional[List[str]] = None


# ─── Health Check ─────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0-ai-os"}


# ─── Providers ────────────────────────────────────────────────────────

@app.get("/providers")
async def get_providers():
    return get_available_providers()


@app.get("/{provider}/models")
async def get_models(
    provider: str,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
):
    try:
        models = await fetch_models_from_provider(provider, api_key or "", base_url or "")
        return {"models": models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Main Orchestration (Smart Auto Mode) ─────────────────────────────

@app.post("/orchestrate")
async def orchestrate(req: OrchestrateRequest):
    """
    Smart orchestration with pre-router:
    - TRIVIAL → direct streaming response (skip planning entirely)
    - TOOL_USE → single agent with tools
    - COMPLEX → full multi-agent DAG planning
    """
    api_key = resolve_api_key(req.provider, req.api_key, req.api_keys)
    from providers import get_provider_config as _get_cfg
    _is_local = _get_cfg(req.provider).get("is_local", False)
    if not api_key and not _is_local:
        raise HTTPException(status_code=400, detail="API key required.")

    # Jailbreak check
    jailbreak_alert = check_jailbreak(req.prompt)
    if jailbreak_alert:
        async def safety_stream():
            yield f"event: text\ndata: {json.dumps('⚠ ' + jailbreak_alert)}\n\n"
            yield "event: done\ndata: {}\n\n"
        return StreamingResponse(safety_stream(), media_type="text/event-stream")

    # ── Semantic Pre-Router ────────────────────────────────────────────
    route = await route_request(
        prompt=req.prompt,
        provider=req.provider,
        api_key=api_key,
        api_keys=req.api_keys,
        base_url=req.base_url,
        backup_api_keys=req.backup_api_keys,
    )

    # Build orchestration plan
    history_msgs = [{"role": "user" if m.sender == "user" else "assistant", "content": m.text}
                    for m in (req.history or [])]

    # Smart context windowing
    from core.planner import summarize_history
    history_msgs = await summarize_history(
        history_msgs, req.provider, api_key, req.api_keys, req.base_url, backup_api_keys=req.backup_api_keys
    )

    existing_agent_ids = [n["data"]["senderId"] for n in (req.existing_nodes or []) if n.get("data")]

    messages_for_plan = history_msgs.copy()
    existing_ctx = f"\n\nExisting agents (do NOT recreate): {existing_agent_ids}" if existing_agent_ids else ""
    messages_for_plan.append({"role": "user", "content": req.prompt + existing_ctx})

    if route == "TRIVIAL":
        # ── Fast path: no planning, no agents, stream directly ─────────
        from providers import stream_provider
        from core.planner import RESPONSE_SYSTEM_INSTRUCTION

        async def trivial_stream():
            empty_meta = {"complexity": "simple", "capabilities": [], "thinking_summary": "", "nodes": [], "edges": [], "agent_talk": [], "follow_up_suggestions": []}
            yield f"event: metadata\ndata: {json.dumps(empty_meta)}\n\n"
            try:
                from core.planner import _FAST_ROUTER_MODELS
                fast_model = _FAST_ROUTER_MODELS.get(req.provider, req.model)
                async for token in stream_provider(
                    provider=req.provider, model=fast_model, api_key=api_key,
                    messages=messages_for_plan, system_prompt=RESPONSE_SYSTEM_INSTRUCTION,
                    temperature=0.7, timeout=20.0, fallback_provider=req.fallback_provider,
                    api_keys=req.api_keys, base_url=req.base_url,
                    backup_api_keys=req.backup_api_keys,
                ):
                    yield f"event: text\ndata: {json.dumps(token)}\n\n"
            except Exception as e:
                yield f"event: text\ndata: {json.dumps(f'Error: {str(e)}')}\n\n"
            yield "event: done\ndata: {}\n\n"

        return StreamingResponse(trivial_stream(), media_type="text/event-stream")

    # ── Full planning ─────────────────────────────────────────────────
    plan = await generate_plan(
        messages=messages_for_plan,
        provider=req.provider,
        model=req.model,
        api_key=api_key,
        api_keys=req.api_keys,
        base_url=req.base_url,
        fallback_provider=req.fallback_provider,
        backup_api_keys=req.backup_api_keys,
    )

    # Merge existing nodes/edges from frontend canvas
    import uuid
    nodes = list(req.existing_nodes or [])
    edges = list(req.existing_edges or [])
    existing_ids = {n["id"] for n in nodes}

    for agent in plan.get("agent_talk", []):
        agent_id = agent["senderId"]
        if agent_id in existing_ids:
            continue  # deduplicate
        custom = agent.get("custom_template", {})
        col_idx = custom.get("col", len(nodes) % 3)
        new_node = {
            "id": agent_id,
            "type": "custom",
            "position": {"x": 100 + col_idx * 400, "y": 80 + (len(nodes) // 3) * 320},
            "data": {
                "name": custom.get("name", agent.get("senderName", agent_id)),
                "icon": custom.get("icon", "science"),
                "tag": custom.get("tag", agent.get("senderIcon", "AGENT").upper()),
                "objective": agent.get("objective", ""),
                "systemPrompt": agent.get("systemPrompt", ""),
                "rules": agent.get("rules", []),
                "dependencies": agent.get("dependencies", []),
                "tools": agent.get("tools", []),
                "toolPermissions": {},
                "temp": custom.get("temp", 0.7),
                "logic": custom.get("logic", 70),
                "empathy": 50,
                "priority": 5,
                "status": "IDLE",
                "enabled": True,
                "toolLogs": [],
                "personality": "",
                "senderId": agent_id,
            },
        }
        nodes.append(new_node)
        existing_ids.add(agent_id)

    # Build edges from dependencies
    for node in nodes:
        for dep in node["data"].get("dependencies", []):
            edge_id = f"e-{dep}-{node['id']}"
            if dep in existing_ids and not any(e["id"] == edge_id for e in edges):
                edges.append({"id": edge_id, "source": dep, "target": node["id"], "type": "custom", "animated": True})

    if not nodes:
        nodes = [{"id": "general", "type": "custom", "position": {"x": 300, "y": 200}, "data": {**DEFAULT_PLAN["agent_talk"][0], "status": "IDLE", "enabled": True, "toolLogs": [], "empathy": 50, "priority": 5, "personality": ""}}]

    session_id = req.session_id or str(uuid.uuid4())

    if not req.execute_agents:
        # Custom mode: return plan without executing
        plan_meta = {
            "complexity": plan.get("complexity", "simple"),
            "capabilities": plan.get("capabilities", []),
            "thinking_summary": plan.get("thinking_summary", ""),
            "nodes": nodes,
            "edges": edges,
            "agent_talk": [{"id": f"plan-{a['senderId']}", "senderId": a["senderId"], "senderName": a["senderName"], "senderIcon": a["senderIcon"], "text": a["text"], "timestamp": ""} for a in plan.get("agent_talk", [])],
            "follow_up_suggestions": plan.get("follow_up_suggestions", []),
        }
        async def plan_stream():
            yield f"event: metadata\ndata: {json.dumps(plan_meta)}\n\n"
            yield "event: done\ndata: {}\n\n"
        return StreamingResponse(plan_stream(), media_type="text/event-stream")

    return StreamingResponse(
        run_agent_execution_loop(
            session_id=session_id,
            prompt=req.prompt,
            history=req.history,
            api_key=api_key,
            nodes=nodes,
            edges=edges,
            complexity=plan.get("complexity", "simple"),
            capabilities=plan.get("capabilities", []),
            thinking_summary=plan.get("thinking_summary", ""),
            follow_up_suggestions=plan.get("follow_up_suggestions", []),
            provider=req.provider,
            model=req.model,
            fallback_provider=req.fallback_provider,
            api_keys=req.api_keys,
            base_url=req.base_url,
            resume_from_checkpoint=False,
            backup_api_keys=req.backup_api_keys,
        ),
        media_type="text/event-stream",
    )


# ─── Custom Execute (Manual Flow Mode) ───────────────────────────────

@app.post("/execute_custom")
async def execute_custom(req: ExecuteCustomRequest):
    """Execute a user-customized node canvas directly."""
    api_key = resolve_api_key(req.provider, req.api_key, req.api_keys)
    from providers import get_provider_config as _get_cfg
    if not api_key and not _get_cfg(req.provider).get("is_local", False):
        raise HTTPException(status_code=400, detail="API key required.")

    return StreamingResponse(
        run_agent_execution_loop(
            session_id=req.session_id,
            prompt=req.prompt,
            history=req.history,
            api_key=api_key,
            nodes=req.nodes,
            edges=req.edges,
            complexity="complex",
            capabilities=[],
            thinking_summary="",
            follow_up_suggestions=[],
            provider=req.provider,
            model=req.model,
            fallback_provider=req.fallback_provider,
            api_keys=req.api_keys,
            base_url=req.base_url,
            resume_from_checkpoint=False,
            backup_api_keys=req.backup_api_keys,
        ),
        media_type="text/event-stream",
    )


# ─── Tool Approval ────────────────────────────────────────────────────

@app.post("/approve_tool")
async def approve_tool(req: ApprovalRequest):
    status = "approved" if req.action == "approve" else "denied"
    if req.logId:
        await update_tool_approval(req.sessionId, req.nodeId, req.toolName, req.logId, status)
    else:
        await update_tool_approval_wildcard(req.sessionId, req.nodeId, req.toolName, status)
    return {"status": "ok", "approval": status}


# ─── Session Management ───────────────────────────────────────────────

@app.get("/sessions")
async def get_sessions():
    sessions = await load_sessions()
    result = []
    for s in sessions:
        result.append({
            "session_id": s["session_id"],
            "title": s["title"],
            "prompt": s["prompt"],
            "mode": s.get("mode", "auto"),
            "execution_state": s.get("execution_state", "setup"),
            "status_message": s.get("status_message", ""),
        })
    return result


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    session = await load_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "id": session["session_id"],
        "title": session["title"],
        "prompt": session["prompt"],
        "mode": session.get("mode", "auto"),
        "nodes": session.get("nodes", []),
        "edges": session.get("edges", []),
        "chatMessages": session.get("chat_messages", []),
        "agentTalkLogs": session.get("agent_talk_logs", []),
        "executionState": session.get("execution_state", "setup"),
        "statusMessage": session.get("status_message", ""),
        "followUpSuggestions": session.get("follow_up_suggestions", []),
    }


@app.delete("/sessions/{session_id}")
async def delete_session_route(session_id: str):
    await delete_session(session_id)
    return {"status": "deleted"}


@app.post("/sessions/save")
async def save_session_route(req: SaveSessionRequest):
    await save_session(
        session_id=req.session_id,
        title=req.title,
        prompt=req.prompt,
        mode=req.mode,
        nodes=req.nodes,
        edges=req.edges,
        chat_messages=req.chat_messages,
        agent_talk_logs=req.agent_talk_logs,
        execution_state=req.execution_state,
        status_message=req.status_message,
        follow_up_suggestions=req.follow_up_suggestions,
    )
    return {"status": "saved"}


class TestAgentRequest(BaseModel):
    node: Dict[str, Any]
    provider: str
    api_key: Optional[str] = None
    api_keys: Optional[Dict[str, str]] = None
    base_url: Optional[str] = None
    backup_api_keys: Optional[List[str]] = None


@app.post("/test_agent")
async def test_agent_route(req: TestAgentRequest):
    """
    Test execution of a single agent node.
    Runs a simple prompt and verifies the LLM connection and system prompt.
    """
    from providers import get_provider_config, call_provider
    provider_config = get_provider_config(req.provider)
    api_key = resolve_api_key(req.provider, req.api_key, req.api_keys)
    if not api_key and not provider_config.get("is_local", False):
        raise HTTPException(status_code=400, detail="API Key required.")

    test_prompt = "Hello! Output a short 3-word test greeting."
    node = req.node
    try:
        response = await call_provider(
            provider=req.provider,
            model=req.node.get("data", {}).get("model") or provider_config.get("default_model", "llama3"),
            api_key=api_key,
            messages=[{"role": "user", "content": test_prompt}],
            system_prompt=node.get("data", {}).get("systemPrompt", "You are a test agent."),
            temperature=0.7,
            timeout=10.0,
            api_keys=req.api_keys,
            base_url=req.base_url,
            backup_api_keys=req.backup_api_keys,
        )
        return {"status": "success", "response": response}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@app.post("/echohouse/init")
async def echohouse_init(req: EchoHouseInitRequest):
    api_key = resolve_api_key(req.provider, req.api_key, req.api_keys)
    from providers import PROVIDERS, call_provider, extract_json_from_text
    is_local = PROVIDERS.get(req.provider.lower(), {}).get("is_local", False)
    if not api_key and not is_local:
        raise HTTPException(status_code=400, detail="API key required for initialization.")
        
    model = req.model or PROVIDERS.get(req.provider.lower(), {}).get("default_model")
    
    system_prompt = (
        "You are a professional relationship counselor and social dynamics simulator.\n"
        "Given the user's life problem, infer 2-4 key people in their life who are likely involved in or affect this situation (e.g., family, friends, colleagues, partners, or their own internal self).\n"
        "Always include one cast member representing the user themselves. For the user themselves, set is_self to true, and role to \"self\".\n\n"
        "Output JSON format ONLY. Do NOT enclose in markdown formatting, just raw JSON list.\n"
        "Each item in the list must have:\n"
        "- inferred_name (string): Name of the person (e.g. \"You (Self)\", \"Sarah\", \"Dad\")\n"
        "- role (string): Their relation/role (e.g. \"self\", \"friend\", \"father\")\n"
        "- inferred_problem (string): What this person likely thinks/feels about the situation (their perspective)\n"
        "- emotional_core (string): One sentence describing the deepest emotional need or fear driving this person's behavior. Example: \"Needs to feel respected and not dismissed.\"\n"
        "- is_self (boolean): True if it represents the user, False otherwise.\n\n"
        "Example JSON output:\n"
        "[\n"
        "  {\"inferred_name\": \"You (Self)\", \"role\": \"self\", \"inferred_problem\": \"I feel stuck and overwhelmed.\", \"emotional_core\": \"Needs to feel heard and understood.\", \"is_self\": true},\n"
        "  {\"inferred_name\": \"Mom\", \"role\": \"mother\", \"inferred_problem\": \"She thinks I'm not trying hard enough.\", \"emotional_core\": \"Fears losing connection with her child.\", \"is_self\": false}\n"
        "]"
    )
    
    user_prompt = f"User's life problem: \"{req.problem_text}\""
    
    try:
        response = await call_provider(
            provider=req.provider,
            model=model,
            api_key=api_key,
            messages=[{"role": "user", "content": user_prompt}],
            system_prompt=system_prompt,
            temperature=0.7,
            timeout=15.0,
            api_keys=req.api_keys,
            base_url=req.base_url,
            backup_api_keys=req.backup_api_keys,
        )
        cast = extract_json_from_text(response)
        if isinstance(cast, list) and len(cast) > 0:
            validated_cast = []
            for item in cast:
                if isinstance(item, dict) and "inferred_name" in item and "role" in item:
                    validated_cast.append({
                        "inferred_name": str(item["inferred_name"]),
                        "role": str(item["role"]),
                        "inferred_problem": str(item.get("inferred_problem", "")),
                        "emotional_core": str(item.get("emotional_core", "")),
                        "is_self": bool(item.get("is_self", False))
                    })
            if validated_cast:
                return validated_cast
    except Exception as e:
        print(f"[EchoHouse Init Error] {e}")
        
    return [
        {
            "inferred_name": "You (Self)",
            "role": "self",
            "inferred_problem": req.problem_text,
            "is_self": True
        },
        {
            "inferred_name": "Friend",
            "role": "friend",
            "inferred_problem": "They are concerned about you but might not know how to help.",
            "is_self": False
        }
    ]


@app.post("/echohouse/simulate")
async def echohouse_simulate(req: EchoHouseSimulateRequest):
    api_key = resolve_api_key(req.provider, req.api_key, req.api_keys)
    from core.echohouse import run_echohouse_simulation
    from providers import PROVIDERS
    is_local = PROVIDERS.get(req.provider.lower(), {}).get("is_local", False)
    if not api_key and not is_local:
        raise HTTPException(status_code=400, detail="API key required for simulation.")
        
    model = req.model or PROVIDERS.get(req.provider.lower(), {}).get("default_model")
    
    return StreamingResponse(
        run_echohouse_simulation(
            session_id=req.session_id,
            problem_text=req.problem_text,
            cast=req.cast,
            provider=req.provider,
            model=model,
            api_key=api_key,
            api_keys=req.api_keys,
            base_url=req.base_url,
            rounds=req.rounds,
            tone=req.tone,
            backup_api_keys=req.backup_api_keys,
        ),
        media_type="text/event-stream"
    )


@app.post("/echohouse/takeaways")
async def echohouse_takeaways(req: EchoHouseTakeawaysRequest):
    api_key = resolve_api_key(req.provider, req.api_key, req.api_keys)
    from providers import PROVIDERS, call_provider, extract_json_from_text
    is_local = PROVIDERS.get(req.provider.lower(), {}).get("is_local", False)
    if not api_key and not is_local:
        raise HTTPException(status_code=400, detail="API key required.")

    model = req.model or PROVIDERS.get(req.provider.lower(), {}).get("default_model")

    system_prompt = (
        "You are a concise therapeutic coach. Given the simulation text and problem below, "
        "output EXACTLY a JSON array of 3 strings. Each string is a specific, actionable step "
        "written in second person (\"You could...\", \"Try...\", \"Next time...\"). "
        "Each string must be under 25 words. Do NOT output generic advice. Be behavioral and specific. "
        "Output raw JSON only, no markdown fences. Example: "
        '["Try stating one boundary out loud before the next family call.", '
        '"Write down one thing you felt but did not say, then say it to a mirror.", '
        '"Ask directly for what you need rather than waiting for others to notice."]'
    )

    user_prompt = (
        f"Problem: {req.problem_text}\n\n"
        f"Simulation transcript:\n{req.simulation_text[:6000]}"
    )

    try:
        response = await call_provider(
            provider=req.provider,
            model=model,
            api_key=api_key,
            messages=[{"role": "user", "content": user_prompt}],
            system_prompt=system_prompt,
            temperature=0.5,
            timeout=15.0,
            api_keys=req.api_keys,
            base_url=req.base_url,
            backup_api_keys=req.backup_api_keys,
        )
        takeaways = extract_json_from_text(response)
        if isinstance(takeaways, list) and len(takeaways) >= 1:
            result = [str(t) for t in takeaways[:3]]
            while len(result) < 3:
                result.append("Reflect on what you truly need from this relationship.")
            return {"takeaways": result}
    except Exception as e:
        print(f"[EchoHouse Takeaways Error] {e}")

    return {"takeaways": [
        "Notice one moment this week where you held back, and speak up instead.",
        "Write down what you wish the other person understood about your perspective.",
        "Before the next difficult interaction, state your need clearly to yourself first."
    ]}


@app.get("/ollama/models")
async def get_ollama_models():
    url = "http://localhost:11434/api/tags"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                raw_models = data.get("models", [])
                models = []
                for m in raw_models:
                    name = m.get("name")
                    if name:
                        models.append({
                            "id": name,
                            "name": name,
                            "tier": "local"
                        })
                return {"models": models, "ollama_available": True}
    except Exception as e:
        print(f"[Ollama Check Failed] {e}")
    return {"models": [], "ollama_available": False}


