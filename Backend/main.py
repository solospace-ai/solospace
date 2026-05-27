"""
Solospace AI OS — FastAPI Application
Slim entry point: routes + middleware only.
All business logic lives in core/, tools/, storage/, and security/.
"""
import json
import time
import asyncio
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
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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
    if not api_key:
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
    )

    # Build orchestration plan
    history_msgs = [{"role": "user" if m.sender == "user" else "assistant", "content": m.text}
                    for m in (req.history or [])]

    # Smart context windowing
    from core.planner import summarize_history
    history_msgs = await summarize_history(
        history_msgs, req.provider, api_key, req.api_keys, req.base_url
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
            "position": {"x": 180 + col_idx * 260, "y": 100 + (len(nodes) // 3) * 200},
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
        ),
        media_type="text/event-stream",
    )


# ─── Custom Execute (Manual Flow Mode) ───────────────────────────────

@app.post("/execute_custom")
async def execute_custom(req: ExecuteCustomRequest):
    """Execute a user-customized node canvas directly."""
    api_key = resolve_api_key(req.provider, req.api_key, req.api_keys)
    if not api_key:
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
            model=req.node.get("data", {}).get("model") or "gemini-2.5-flash",
            api_key=api_key,
            messages=[{"role": "user", "content": test_prompt}],
            system_prompt=node.get("data", {}).get("systemPrompt", "You are a test agent."),
            temperature=0.7,
            timeout=10.0,
            api_keys=req.api_keys,
            base_url=req.base_url,
        )
        return {"status": "success", "response": response}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

