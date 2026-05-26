import os
import json
import httpx
import datetime
import math
import asyncio
import sys
import subprocess
import hashlib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from bs4 import BeautifulSoup
import db
from agent_messages import post_message, get_messages_for_agent, clear_messages


# Initialize database
db.init_db()

app = FastAPI(title="Solospace Python Orchestrator API")

# Allow Next.js frontend to reach this API (critical on Windows / localhost dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global coordination states
MEMORY_FILE = "memory_store.json"

class Message(BaseModel):
    sender: str
    text: str

class OrchestrateRequest(BaseModel):
    prompt: str
    history: Optional[List[Message]] = []
    api_key: Optional[str] = None
    session_id: Optional[str] = None
    execute_agents: bool = True

class ApprovalRequest(BaseModel):
    sessionId: str
    nodeId: str
    toolName: str
    action: str  # "approve" or "deny"

class ExecuteCustomRequest(BaseModel):
    session_id: str
    api_key: str
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    prompt: str
    history: Optional[List[Message]] = []

# ─── VECTOR DB MEMORY STORE (Gemini Embeddings + Local Cosine Similarity) ───

async def get_gemini_embedding(text: str, api_key: str) -> List[float]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={api_key}"
    payload = {
        "model": "models/text-embedding-004",
        "content": {
            "parts": [{"text": text}]
        }
    }
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(url, json=payload, timeout=15.0)
            if r.status_code == 200:
                return r.json().get("embedding", {}).get("values", [])
        except Exception as e:
            print(f"[MEMORY ERROR] Embedding API failed: {e}")
    return []

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 == 0.0 or norm2 == 0.0:
        return 0.0
    return dot / (norm1 * norm2)

def load_memories() -> List[Dict[str, Any]]:
    if os.path.exists(MEMORY_FILE):
        try:
            with open(MEMORY_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return []

def save_memories(memories: List[Dict[str, Any]]):
    try:
        with open(MEMORY_FILE, "w") as f:
            json.dump(memories, f, indent=2)
    except Exception as e:
        print(f"[MEMORY ERROR] Saving file failed: {e}")

async def store_memory(agent_id: str, text: str, api_key: str, session_id: str = None):
    embedding = await get_gemini_embedding(text, api_key)
    if not embedding:
        return
    memories = load_memories()
    memories.append({
        "agent_id": agent_id,
        "text": text,
        "embedding": embedding,
        "timestamp": datetime.datetime.now().isoformat()
    })
    if session_id:
        memories.append({
            "agent_id": f"session_{session_id}",
            "text": text,
            "embedding": embedding,
            "timestamp": datetime.datetime.now().isoformat()
        })
    save_memories(memories)

async def query_memory(query: str, api_key: str, top_k=2, agent_id: Optional[str] = None) -> List[str]:
    embedding = await get_gemini_embedding(query, api_key)
    if not embedding:
        return []
    memories = load_memories()
    scored = []
    for m in memories:
        if agent_id is not None and m.get("agent_id") != agent_id:
            continue
        sim = cosine_similarity(embedding, m["embedding"])
        scored.append((sim, m["text"]))
    
    scored.sort(key=lambda x: x[0], reverse=True)
    return [text for sim, text in scored[:top_k] if sim > 0.45]


# ─── REAL AGENT TOOLS ───

async def execute_web_search(query: str) -> str:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    url = f"https://html.duckduckgo.com/html/?q={query}"
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(url, headers=headers, timeout=15.0)
            if r.status_code == 200:
                soup = BeautifulSoup(r.text, "html.parser")
                snippets = []
                for div in soup.find_all("a", class_="result__snippet")[:3]:
                    snippets.append(div.get_text().strip())
                if snippets:
                    return "\n".join(snippets)
        except Exception as e:
            return f"Search failed: {str(e)}"
    return f"No search results found for query: '{query}'."

async def execute_python_code(code: str) -> str:
    try:
        p = subprocess.Popen(
            [sys.executable, "-c", code],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = p.communicate(timeout=20.0)
        output = ""
        if stdout:
            output += f"STDOUT:\n{stdout}\n"
        if stderr:
            output += f"STDERR:\n{stderr}\n"
        if not output:
            output = "Code executed successfully with no output."
        return output
    except subprocess.TimeoutExpired:
        p.kill()
        return "Error: Code execution timed out (20.0s limit)."
    except Exception as e:
        return f"Execution error: {str(e)}"

async def execute_api_call(url: str, method: str = "GET", payload_json: Optional[str] = None) -> str:
    async with httpx.AsyncClient() as client:
        try:
            if method.upper() == "POST":
                data = json.loads(payload_json) if payload_json else {}
                r = await client.post(url, json=data, timeout=15.0)
            else:
                r = await client.get(url, timeout=15.0)
            return f"Status: {r.status_code}\nResponse: {r.text[:1500]}"
        except Exception as e:
            return f"API call failed: {str(e)}"

# ─── AGENT COORDINATOR DAG SORT ───

def sort_nodes_topologically(nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    visited = set()
    sorted_nodes = []
    node_dict = {n["id"]: n for n in nodes}

    def visit(node_id):
        if node_id in visited:
            return
        visited.add(node_id)
        node = node_dict.get(node_id)
        if node:
            deps = node["data"].get("dependencies", [])
            for dep in deps:
                if dep in node_dict:
                    visit(dep)
            sorted_nodes.append(node)

    for node in nodes:
        visit(node["id"])
    return sorted_nodes

# ─── ORCHESTRATION SYSTEM INSTRUCTIONS ───

ORCHESTRATOR_SYSTEM_INSTRUCTION = """
You are Solospace, an elite workflow orchestrator. Your ONLY job is to analyze the user's request and output a JSON list of specialized agents.

CRITICAL RULES:
- For ANY request that involves building, designing, integrating, or researching a non‑trivial system, you MUST output at least 2 agents.
- For requests that mention multiple domains (e.g., frontend + backend + database), use 3‑6 agents.
- Only output a SINGLE agent ("general") for extremely simple questions like "Hello", "What is AI?", or one‑line explanations.
- Classify the complexity field in the JSON schema as "complex" if the user asks to build, design, integrate, or analyze a system with 2+ distinct components (frontend, backend, database, payments, auth, research). If in doubt, prefer "complex" over "simple".

AGENT CREATION:
You can use any senderId, not only the built‑in list. Define custom agents freely.
Every agent MUST have:
- senderId: a unique short identifier (e.g., "frontend_ui", "payment_gateway", "data_analyst").
- senderName: a human readable name.
- senderIcon: "code", "science", or "trending_up".
- text: what this agent will contribute.
- objective: specific goal for this agent.
- systemPrompt: detailed instructions for the agent.
- rules: 2‑3 specific constraints.
- dependencies: list of other agent ids this agent needs.
- tools: choose from ["Web Search", "Memory", "Code Executor", "Browser", "API Connector"].

EXAMPLES:
1. User: "Build a full‑stack SaaS with Next.js, Stripe payments, and PostgreSQL"
   → Output agents: frontend_ui, backend_api, database_admin, payment_integrator (4 agents).

2. User: "Explain how JWT works"
   → Output agents: general (1 agent).

3. User: "Research AI trends and write a summary"
   → Output agents: researcher, writer (2 agents).

Respond ONLY with a valid JSON object matching the provided schema.
"""

orchestration_schema = {
    "type": "OBJECT",
    "properties": {
        "complexity": {
            "type": "STRING",
            "enum": ["simple", "medium", "complex"]
        },
        "capabilities": {
            "type": "ARRAY",
            "items": {"type": "STRING"}
        },
        "thinking_summary": {
            "type": "STRING"
        },
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
                    "rules": {
                        "type": "ARRAY",
                        "items": {"type": "STRING"}
                    },
                    "dependencies": {
                        "type": "ARRAY",
                        "items": {"type": "STRING"}
                    },
                    "tools": {
                        "type": "ARRAY",
                        "items": {"type": "STRING"}
                    },
                    "custom_template": {
                        "type": "OBJECT",
                        "properties": {
                            "name": {"type": "STRING"},
                            "icon": {"type": "STRING"},
                            "tag": {"type": "STRING"},
                            "temp": {"type": "NUMBER"},
                            "logic": {"type": "INTEGER"},
                            "col": {"type": "INTEGER"}
                        },
                        "required": ["name", "icon", "tag", "temp", "logic", "col"]
                    }
                },
                "required": ["senderId", "senderName", "senderIcon", "text", "objective", "systemPrompt", "rules", "dependencies", "tools"]
            }
        }
    },
    "required": ["complexity", "capabilities", "thinking_summary", "agent_talk"]
}

# Real-time ReAct loop action schema for agents
agent_turn_schema = {
    "type": "OBJECT",
    "properties": {
        "thought": {"type": "STRING"},
        "action": {
            "type": "STRING",
            "enum": ["none", "web_search", "execute_code", "api_call", "query_memory", "store_memory", "send_message"]
        },
        "action_input": {"type": "STRING"},
        "final_answer": {"type": "STRING"}
    },
    "required": ["thought", "action", "action_input", "final_answer"]
}


RESPONSE_SYSTEM_INSTRUCTION = """
You are Solospace, an elite assistant.
Your job is to produce a clean, direct response to the user's prompt using the provided context.

STRICT RULES — NEVER VIOLATE:
- Do NOT include any preamble, header, or status line such as "[Agent processing...]", "Synthesizing...", "From the agent team:", or similar.
- Do NOT mention agents, sub-tasks, specialists, orchestration, or internal workflow mechanics.
- Do NOT start your response with any markdown header that references processing steps.
- Begin your response immediately and directly with the answer.
- Use clean, well-structured markdown only when it genuinely helps the user.
- For conversational messages (e.g. greetings), reply naturally and concisely without any structure.
"""

GEMINI_SAFETY_SETTINGS = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"}
]

def check_guardrails(prompt: str) -> Optional[str]:
    jailbreak_keywords = [
        "ignore previous instructions", "ignore all instructions", "override system prompt",
        "you are now developer mode", "jailbreak"
    ]
    for keyword in jailbreak_keywords:
        if keyword in prompt.lower():
            return "Safety Alert: Input contains potential prompt injection or system instruction bypass."
    return None

MAX_TOKENS = 100000.0
REFILL_RATE = 100.0

def check_rate_limit(session_id: str, prompt_len: int) -> bool:
    limit_info = db.get_rate_limit(session_id)
    now = datetime.datetime.now()
    
    if not limit_info:
        tokens = MAX_TOKENS
    else:
        try:
            last_updated = datetime.datetime.fromisoformat(limit_info["last_updated"])
            elapsed = (now - last_updated).total_seconds()
            tokens = min(MAX_TOKENS, limit_info["tokens_remaining"] + elapsed * REFILL_RATE)
        except Exception:
            tokens = MAX_TOKENS
    
    estimated_tokens = prompt_len / 3.0
    
    if tokens < estimated_tokens:
        return False
        
    tokens -= estimated_tokens
    db.update_rate_limit(session_id, tokens)
    return True

@app.post("/approve")
async def approve_tool(req: ApprovalRequest):
    status = "approved" if req.action == "approve" else "denied"
    
    # Update SQLite database tool approvals
    db.update_tool_approval(req.sessionId, req.nodeId, req.toolName, "pending", status)
    # Database is the single source of truth; no in-memory fallback needed
    # Perform wildcard updates in database (if specific logId is not provided)
    conn = db.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE tool_approvals SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND node_id = ? AND tool_name = ? AND status = 'pending'",
        (status, req.sessionId, req.nodeId, req.toolName)
    )
    conn.commit()
    conn.close()
    
    return {"status": "success", "state": status}

async def run_cached_flow(cached_data: Dict[str, Any]):
    metadata = cached_data.get("metadata")
    if metadata:
        yield f"event: metadata\ndata: {json.dumps(metadata)}\n\n"
    
    text = cached_data.get("text", "")
    chunk_size = 15
    for i in range(0, len(text), chunk_size):
        chunk = text[i:i+chunk_size]
        yield f"event: text\ndata: {json.dumps(chunk)}\n\n"
        await asyncio.sleep(0.02)
    yield "event: done\ndata: {}\n\n"

@app.post("/orchestrate")
async def orchestrate(req: OrchestrateRequest):
    api_key = req.api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key or api_key == "MY_GEMINI_API_KEY" or api_key == "":
        raise HTTPException(
            status_code=400,
            detail="Gemini API Key is missing. Please configure BYOK in Settings or set the GEMINI_API_KEY environment variable."
        )

    # 1. Guardrails check
    guardrail_err = check_guardrails(req.prompt)
    if guardrail_err:
        async def stream_guardrail_err():
            yield f"event: text\ndata: {json.dumps(guardrail_err)}\n\n"
            yield "event: done\ndata: {}\n\n"
        return StreamingResponse(stream_guardrail_err(), media_type="text/event-stream")

    # In-memory and persistent session id
    session_id = req.session_id or str(int(datetime.datetime.now().timestamp()))

    # 2. Rate limiting check
    if not check_rate_limit(session_id, len(req.prompt)):
        async def stream_rate_limit_err():
            yield f"event: text\ndata: {json.dumps('**Rate Limit Exceeded**: Please wait a minute before making more requests.')}\n\n"
            yield "event: done\ndata: {}\n\n"
        return StreamingResponse(stream_rate_limit_err(), media_type="text/event-stream")

    # 3. Semantic caching
    prompt_hash_overall = hashlib.sha256(req.prompt.encode('utf-8')).hexdigest()
    prompt_embedding = await get_gemini_embedding(req.prompt, api_key)
    if prompt_embedding:
        all_caches = db.load_all_cached_embeddings()
        for cache in all_caches:
            sim = cosine_similarity(prompt_embedding, cache["embedding"])
            if sim > 0.95:
                print(f"[SEMANTIC CACHE] Cache hit for overall response. Similarity: {sim:.4f}")
                return StreamingResponse(run_cached_flow(cache["response"]), media_type="text/event-stream")

    # 4. Map history and call planner
    contents = []
    if req.history:
        for msg in req.history:
            role = "user" if msg.sender == "user" else "model"
            contents.append({
                "role": role,
                "parts": [{"text": msg.text}]
            })
    
    contents.append({
        "role": "user",
        "parts": [{"text": req.prompt}]
    })

    url_orchestrate = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    
    orchestrate_payload = {
        "contents": contents,
        "systemInstruction": {
            "parts": [{"text": ORCHESTRATOR_SYSTEM_INSTRUCTION}]
        },
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": orchestration_schema,
            "temperature": 0.2,
            "thinkingConfig": {"thinkingBudget": 2048}
        },
        "safetySettings": GEMINI_SAFETY_SETTINGS
    }

    plan = {
        "complexity": "simple",
        "capabilities": [],
        "thinking_summary": "System defaulted to general mode.",
        "agent_talk": [{
            "senderId": "general",
            "senderName": "General Assistant",
            "senderIcon": "bot",
            "text": "Standing by to process your request.",
            "objective": "Process user requests with precise analysis.",
            "systemPrompt": "You are Solospace core.",
            "rules": ["Be descriptive"],
            "dependencies": []
        }],
        "follow_up_suggestions": ["Can you elaborate?", "Show me a detailed implementation example."]
    }

    async with httpx.AsyncClient() as client:
        try:
            plan_response = await client.post(url_orchestrate, json=orchestrate_payload, timeout=30.0)
            if plan_response.status_code == 200:
                plan_data = plan_response.json()
                if "candidates" in plan_data and len(plan_data["candidates"]) > 0:
                    raw_text = plan_data["candidates"][0]["content"]["parts"][-1]["text"].strip()
                    plan = json.loads(raw_text)
        except Exception as e:
            print(f"[ORCHESTRATION WARNING] Planning failed: {str(e)}")

    nodes = []
    edges = []
    complexity = plan.get("complexity", "simple")
    
    # Enforce minimum agents for non-simple tasks
    if complexity != "simple" and len(plan.get("agent_talk", [])) < 2:
        print("[WARN] Too few agents for complex/medium task, adding a default assistant agent.")
        plan.setdefault("agent_talk", []).append({
            "senderId": "assistant",
            "senderName": "General Assistant",
            "senderIcon": "code",
            "text": "Supports the primary agents with general assistance.",
            "objective": "Provide supplementary help and context.",
            "systemPrompt": "You are a helpful assistant that supports other agents.",
            "rules": ["Be concise", "Do not duplicate work"],
            "dependencies": [],
            "tools": ["Web Search", "Memory"]
        })

    if complexity == "simple":
        nodes.append({
            "id": "general",
            "type": "custom",
            "position": {"x": 400, "y": 250},
            "data": {
                "name": "General Assistant",
                "tag": "GENERAL_CORE",
                "status": "ACTIVE",
                "metricLabel": "Logic Level",
                "metricVal": "90%",
                "icon": "bot",
                "objective": "Address the user request with natural, accurate, and comprehensive insights.",
                "personality": "Helpful, expert, clear-headed",
                "systemPrompt": "You are Solospace, an elite assistant.",
                "rules": ["Be helpful and concise", "Use rich markdown"],
                "tools": ["Web Search", "Memory"],
                "temp": 0.7,
                "logic": 90,
                "empathy": 80,
                "context": "128k",
                "enabled": True,
                "priority": 5,
                "toolPermissions": {"Web Search": "ALLOWED", "Memory": "ALLOWED"},
                "toolLogs": [],
                "dependencies": []
            }
        })
    else:
        col_mapping = {
            "research": 1,
            "auth": 2,
            "database": 2,
            "frontend": 2,
            "backend": 3,
            "payments": 3
        }

        # Built-in templates: provide defaults but agent can override tools via agent_talk
        AGENT_TEMPLATES = {
            "research": {"name": "Market Researcher", "tag": "RESEARCH_LEAD_01", "icon": "science", "default_tools": ["Web Search"], "temp": 0.3, "logic": 85, "empathy": 40, "priority": 5, "col": 1},
            "auth": {"name": "Security Architect", "tag": "AUTH_AUDIT_02", "icon": "science", "default_tools": ["Memory"], "temp": 0.1, "logic": 99, "empathy": 10, "priority": 8, "col": 2},
            "database": {"name": "Database Admin", "tag": "DB_SCHEMA_03", "icon": "science", "default_tools": ["Memory"], "temp": 0.2, "logic": 95, "empathy": 20, "priority": 7, "col": 2},
            "frontend": {"name": "UI Specialist", "tag": "UI_DESIGN_04", "icon": "code", "default_tools": ["Browser"], "temp": 0.7, "logic": 75, "empathy": 75, "priority": 6, "col": 2},
            "backend": {"name": "API Architect", "tag": "API_ENGINE_05", "icon": "code", "default_tools": ["Code Executor"], "temp": 0.2, "logic": 92, "empathy": 25, "priority": 8, "col": 3},
            "payments": {"name": "Stripe Integrator", "tag": "STRIPE_BILL_06", "icon": "trending_up", "default_tools": ["API Connector"], "temp": 0.4, "logic": 90, "empathy": 40, "priority": 7, "col": 3}
        }

        active_agents = []
        seen_ids = set()
        for agent in plan.get("agent_talk", []):
            cap = agent.get("senderId", "")
            # Deduplicate by senderId — if Gemini sends duplicate, suffix with index
            unique_id = cap
            if unique_id in seen_ids:
                unique_id = f"{cap}_{len(seen_ids)}"
            seen_ids.add(unique_id)
            if cap in AGENT_TEMPLATES:
                active_agents.append((unique_id, agent, AGENT_TEMPLATES[cap]))
            elif cap == "other" or cap not in AGENT_TEMPLATES:
                # Dynamic / custom agent
                ct = agent.get("custom_template", {})
                dynamic_tpl = {
                    "name": ct.get("name", agent.get("senderName", "Custom Agent")),
                    "tag": ct.get("tag", f"CUSTOM_{unique_id.upper()[:8]}"),
                    "icon": ct.get("icon", agent.get("senderIcon", "science")),
                    "default_tools": ["Web Search", "Memory"],
                    "temp": ct.get("temp", 0.5),
                    "logic": ct.get("logic", 80),
                    "empathy": 50,
                    "priority": 5,
                    "col": ct.get("col", 2)
                }
                active_agents.append((unique_id, agent, dynamic_tpl))

        col_counts = {1: 0, 2: 0, 3: 0}
        for uid, agent, tpl in active_agents:
            col = tpl.get("col", 2)
            col_counts[col] += 1

        col_indices = {1: 0, 2: 0, 3: 0}
        for uid, agent, tpl in active_agents:
            col = tpl.get("col", 2)
            index = col_indices[col]
            col_indices[col] += 1

            x = 100 if col == 1 else (400 if col == 2 else 700)
            total_in_col = col_counts[col]
            y_start = 250 - (total_in_col - 1) * 120
            y = y_start + index * 240

            # Agent-defined tools override template defaults
            agent_tools = agent.get("tools", [])
            resolved_tools = agent_tools if agent_tools else tpl["default_tools"]
            # Filter to known tool names for safety
            valid_tools = {"Web Search", "Memory", "Code Executor", "Browser", "API Connector", "Vision", "Voice", "File Upload"}
            resolved_tools = [t for t in resolved_tools if t in valid_tools] or tpl["default_tools"]

            default_metrics = {
                "research": ("Sources Scanned", "24 Pages"),
                "auth": ("Audit Score", "99%"),
                "database": ("Schema Status", "Normalized"),
                "frontend": ("UI Score", "95%"),
                "backend": ("Execution Rate", "98%"),
                "payments": ("Stripe API Status", "Online")
            }.get(agent.get("senderId", ""), ("Logic Level", "90%"))

            nodes.append({
                "id": uid,
                "type": "custom",
                "position": {"x": x, "y": y},
                "data": {
                    "name": agent.get("senderName", tpl["name"]),
                    "tag": tpl["tag"],
                    "status": "IDLE",
                    "metricLabel": default_metrics[0],
                    "metricVal": default_metrics[1],
                    "icon": agent.get("senderIcon", tpl["icon"]),
                    "objective": agent.get("objective", ""),
                    "personality": "Collaborative Specialist",
                    "systemPrompt": agent.get("systemPrompt", ""),
                    "rules": agent.get("rules", []),
                    "tools": resolved_tools,
                    "temp": tpl["temp"],
                    "logic": tpl["logic"],
                    "empathy": tpl["empathy"],
                    "context": "128k",
                    "enabled": True,
                    "priority": tpl["priority"],
                    "toolPermissions": {t: "ASK" if t in ["Code Executor", "API Connector"] else "ALLOWED" for t in resolved_tools},
                    "toolLogs": [],
                    "dependencies": agent.get("dependencies", [])
                }
            })

        for node in nodes:
            for dep in node["data"].get("dependencies", []):
                edges.append({
                    "id": f"e-{dep}-{node['id']}",
                    "source": dep,
                    "target": node["id"],
                    "animated": True,
                    "type": "custom",
                    "style": {"stroke": "#60a5fa", "strokeWidth": 2}
                })

    # Decide whether to run full agent flow
    if not req.execute_agents:
        # Only planning mode: save session in DB with paused state and return planning metadata
        db.save_session(
            session_id=session_id,
            title=req.prompt[:40] + "..." if len(req.prompt) > 40 else req.prompt,
            prompt=req.prompt,
            mode=complexity,
            nodes=nodes,
            edges=edges,
            chat_messages=[
                {"id": "user-prompt", "sender": "user", "text": req.prompt, "timestamp": datetime.datetime.now().strftime("%I:%M:%S %p")}
            ],
            agent_talk_logs=[],
            execution_state="paused",
            status_message="Agent team generated. Customize and proceed.",
            follow_up_suggestions=plan.get("follow_up_suggestions", [])
        )
        
        async def planning_only_flow():
            setup_metadata = {
                "complexity": complexity,
                "capabilities": plan.get("capabilities", []),
                "thinking_summary": plan.get("thinking_summary", ""),
                "nodes": nodes,
                "edges": edges,
                "agent_talk": [],
                "follow_up_suggestions": plan.get("follow_up_suggestions", [])
            }
            yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
            yield f"event: text\ndata: {json.dumps('✅ Agent team generated. Go to the **Flow** tab to customize agents and click **Proceed** to run them.')}\n\n"
            yield "event: done\ndata: {}\n\n"
            
        return StreamingResponse(planning_only_flow(), media_type="text/event-stream")
    else:
        # Existing full execution flow
        return StreamingResponse(
            run_agent_execution_loop(
                session_id=session_id,
                prompt=req.prompt,
                history=req.history or [],
                api_key=api_key,
                nodes=nodes,
                edges=edges,
                complexity=complexity,
                capabilities=plan.get("capabilities", []),
                thinking_summary=plan.get("thinking_summary", ""),
                follow_up_suggestions=plan.get("follow_up_suggestions", [])
            ),
            media_type="text/event-stream"
        )

# Session persistence APIs
@app.get("/sessions")
async def get_sessions():
    return db.load_sessions()

@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    session = db.load_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    db.delete_session(session_id)
    return {"status": "success"}

async def run_agent_execution_loop(
    session_id: str,
    prompt: str,
    history: List[Message],
    api_key: str,
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
    complexity: str,
    capabilities: List[str],
    thinking_summary: str,
    follow_up_suggestions: List[str]
):
    now_str = lambda: datetime.datetime.now().strftime("%I:%M:%S %p")
    agent_results: Dict[str, str] = {}
    setup_metadata = {
        "complexity": complexity,
        "capabilities": capabilities,
        "thinking_summary": thinking_summary,
        "nodes": nodes,
        "edges": edges,
        "agent_talk": [],
        "follow_up_suggestions": follow_up_suggestions
    }
    
    # Save initial session in DB
    db.save_session(
        session_id=session_id,
        title=prompt[:40] + "..." if len(prompt) > 40 else prompt,
        prompt=prompt,
        mode=complexity,
        nodes=nodes,
        edges=edges,
        chat_messages=[],
        agent_talk_logs=[],
        execution_state="running",
        status_message="Running orchestration loop",
        follow_up_suggestions=follow_up_suggestions
    )
    
    yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"

    execution_order = sort_nodes_topologically(nodes)
    
    for agent_node in execution_order:
        node_id = agent_node["id"]
        agent_data = agent_node["data"]
        agent_name = agent_data["name"]
        
        # Checkpoint loading
        checkpoint_state = db.load_checkpoint(session_id, node_id)
        if checkpoint_state:
            agent_results[node_id] = checkpoint_state.get("final_answer", "Completed.")
            setup_metadata["agent_talk"].append({
                "id": f"agent-log-{node_id}-{now_str()}",
                "senderId": node_id,
                "senderName": agent_name,
                "senderIcon": agent_data["icon"],
                "text": checkpoint_state.get("final_answer", "Completed.")[:180],
                "timestamp": now_str()
            })
            continue

        for n in nodes:
            if n["id"] == node_id:
                n["data"]["status"] = "ACTIVE"
        yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
        
        yield f"event: status\ndata: {json.dumps(f'[{agent_name}] processing...')}\n\n"
        await asyncio.sleep(0.5)

        dep_outputs = ""
        for dep_id in agent_data.get("dependencies", []):
            if dep_id in agent_results:
                dep_outputs += f"### Input from {dep_id.upper()}:\n{agent_results[dep_id]}\n"

        memories_context = ""
        try:
            matched_memories = await query_memory(agent_data["objective"], api_key)
            if matched_memories:
                memories_context = "### Relevant Historical Memories:\n" + "\n".join(f"- {m}" for m in matched_memories)
        except Exception:
            pass

        # Get messages addressed to this agent
        incoming_msgs = get_messages_for_agent(session_id, node_id)
        msg_block = ""
        if incoming_msgs:
            msg_block = "### Messages from other agents:\n"
            for msg in incoming_msgs:
                msg_block += f"- From {msg['from']}: {msg['content']}\n"
            # Clear after reading
            clear_messages(session_id, node_id)

        agent_history = [{
            "role": "user",
            "parts": [{"text": f"User Request: {prompt}\n\n{dep_outputs}\n{memories_context}\n{msg_block}\n\nYour specific objective: {agent_data['objective']}\nRules: {agent_data['rules']}"}]
        }]

        agent_final_answer = "Sub-task completed."
        url_gemini = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"

        action_execution_history = []

        for turn in range(3):
            agent_payload = {
                "contents": agent_history,
                "systemInstruction": {"parts": [{"text": agent_data["systemPrompt"]}]},
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "responseSchema": agent_turn_schema,
                    "temperature": 0.2
                },
                "safetySettings": GEMINI_SAFETY_SETTINGS
            }

            action = "none"
            observation = ""
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.post(url_gemini, json=agent_payload, timeout=30.0)
                    if resp.status_code == 200:
                        turn_text = resp.json()["candidates"][0]["content"]["parts"][-1]["text"].strip()
                        turn_data = json.loads(turn_text)
                        
                        thought = turn_data.get("thought", "")
                        action = turn_data.get("action", "none")
                        action_input = turn_data.get("action_input", "")
                        agent_final_answer = turn_data.get("final_answer", "")
                        
                        if thought:
                            yield f"event: thinking\ndata: {json.dumps(f'[{agent_name}]: {thought}\\n')}\n\n"
                    else:
                        break
            except Exception as e:
                print(f"ReAct Turn fail: {e}")
                break

            if action == "none" or agent_final_answer:
                break

            # Circuit Breaker Check
            action_execution_history.append((action, action_input))
            if action_execution_history.count((action, action_input)) >= 3:
                observation = "Circuit Breaker: Tool executed repeatedly with identical input. Halting loop to prevent infinite spend."
                yield f"event: status\ndata: {json.dumps(f'[{agent_name}] circuit breaker halted')}\n\n"
                agent_history.append({
                    "role": "model",
                    "parts": [{"text": json.dumps(turn_data)}]
                })
                agent_history.append({
                    "role": "user",
                    "parts": [{"text": f"Observation: {observation}"}]
                })
                continue

            t_log_id = f"t-log-{int(datetime.datetime.now().timestamp())}"
            t_timestamp = now_str()
            
            permission = agent_data.get("toolPermissions", {}).get(action, "ALLOWED")
            
            if permission == "ASK":
                new_log = {
                    "id": t_log_id,
                    "timestamp": t_timestamp,
                    "tool": action,
                    "action": "Execution Request",
                    "status": "PENDING",
                    "detail": f"Waiting for user to approve execution of '{action_input[:50]}...'"
                }
                for n in nodes:
                    if n["id"] == node_id:
                        n["data"]["toolLogs"] = [new_log] + n["data"].get("toolLogs", [])
                yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
                
                db.create_tool_approval(session_id, node_id, action, action_input, t_log_id)
                
                yield f"event: tool_approval\ndata: {json.dumps({'sessionId': session_id, 'nodeId': node_id, 'toolName': action, 'action': 'Execution Approval Required', 'detail': action_input[:100], 'logId': t_log_id})}\n\n"
                yield f"event: status\ndata: {json.dumps(f'[{agent_name}] waiting for approval to run [{action}]')}\n\n"

                # Poll database for verdict
                while True:
                    approval_status = db.get_tool_approval(session_id, node_id, action, t_log_id)
                    if approval_status in ["approved", "denied"]:
                        permission = "ALLOWED" if approval_status == "approved" else "DENIED"
                        break
                    await asyncio.sleep(0.5)
                
                if permission == "ALLOWED":
                    for n in nodes:
                        if n["id"] == node_id:
                            n["data"]["toolLogs"] = [{**new_log, "status": "SUCCESS", "detail": f"Approved: {action_input[:50]}"}] + n["data"].get("toolLogs", [])[1:]
                else:
                    for n in nodes:
                        if n["id"] == node_id:
                            n["data"]["toolLogs"] = [{**new_log, "status": "BLOCKED", "detail": "Blocked by user."}] + n["data"].get("toolLogs", [])[1:]

            if permission == "ALLOWED":
                yield f"event: status\ndata: {json.dumps(f'[{agent_name}] executing [{action}]')}\n\n"
                
                if action == "web_search":
                    observation = await execute_web_search(action_input)
                elif action == "execute_code":
                    observation = await execute_python_code(action_input)
                elif action == "api_call":
                    observation = await execute_api_call(action_input)
                elif action == "query_memory":
                    mem_res = await query_memory(action_input, api_key)
                    observation = "\n".join(mem_res) if mem_res else "No matches found."
                elif action == "store_memory":
                    await store_memory(node_id, action_input, api_key, session_id)
                    observation = "Saved successfully."
                elif action == "send_message":
                    parts = action_input.split("|", 1)
                    if len(parts) == 2:
                        target_agent, content = parts
                        post_message(session_id, node_id, target_agent, content)
                        observation = f"Message sent to {target_agent}."
                    else:
                        observation = "Invalid send_message format. Use 'target|content'."
                else:
                    observation = "Mock tool result."
                
                success_log = {
                    "id": t_log_id,
                    "timestamp": now_str(),
                    "tool": action,
                    "action": "Call",
                    "status": "SUCCESS",
                    "detail": f"Ran tool with inputs: '{action_input[:50]}' -> Output: {observation[:100]}..."
                }
                for n in nodes:
                    if n["id"] == node_id:
                        logs_filtered = [l for l in n["data"].get("toolLogs", []) if l["id"] != t_log_id]
                        n["data"]["toolLogs"] = [success_log] + logs_filtered
            else:
                observation = "Execution Blocked: Permission Denied."
            
            yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
            
            agent_history.append({
                "role": "model",
                "parts": [{"text": json.dumps(turn_data)}]
            })
            agent_history.append({
                "role": "user",
                "parts": [{"text": f"Observation: {observation}"}]
            })

        agent_results[node_id] = agent_final_answer
        
        # Save state checkpoint
        db.save_checkpoint(session_id, node_id, {"final_answer": agent_final_answer})
        
        for n in nodes:
            if n["id"] == node_id:
                n["data"]["status"] = "IDLE"
        
        setup_metadata["agent_talk"].append({
            "id": f"agent-log-{node_id}-{now_str()}",
            "senderId": node_id,
            "senderName": agent_name,
            "senderIcon": agent_data["icon"],
            "text": agent_final_answer[:180] + "..." if len(agent_final_answer) > 180 else agent_final_answer,
            "timestamp": now_str()
        })
        yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
        
        try:
            await store_memory(node_id, f"Goal: {agent_data['objective']}. Final Solution: {agent_final_answer}", api_key, session_id)
        except Exception:
            pass

    if complexity == "simple" and not agent_results:
        agent_results["general"] = "Processed the request, but no specific output was generated."

    yield f"event: status\ndata: {json.dumps('Synthesizing final response...')}\n\n"

    # Build aggregator prompt — inject relevant memory + agent results
    aggregator_prompt = ""
    try:
        memory_hits = await query_memory(prompt, api_key, top_k=3, agent_id=None)
        if memory_hits:
            aggregator_prompt += "### Relevant context from past conversation:\n" + "\n".join(f"- {m}" for m in memory_hits) + "\n\n"
    except Exception:
        pass

    if agent_results:
        aggregator_prompt += "### Analysis context:\n"
        for _nid, result in agent_results.items():
            aggregator_prompt += f"{result}\n\n"

    aggregator_prompt += f"\nUser's current message: {prompt}"

    # Fallback if aggregator prompt is empty
    if not aggregator_prompt.strip():
        aggregator_prompt = f"Answer the following user request concisely and helpfully:\n\n{prompt}"

    # Build full conversation history for aggregator so it has cross-turn context
    aggregator_contents = []
    if history:
        for msg in history:
            role = "user" if msg.sender == "user" else "model"
            aggregator_contents.append({"role": role, "parts": [{"text": msg.text}]})
    aggregator_contents.append({"role": "user", "parts": [{"text": aggregator_prompt}]})

    url_stream = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key={api_key}"
    stream_payload = {
        "contents": aggregator_contents,
        "systemInstruction": {
            "parts": [{"text": RESPONSE_SYSTEM_INSTRUCTION}]
        },
        "generationConfig": {
            "temperature": 0.7
        },
        "safetySettings": GEMINI_SAFETY_SETTINGS
    }
    
    line_buf = ""
    final_synthesis_text = ""
    async with httpx.AsyncClient() as client:
        try:
            async with client.stream("POST", url_stream, json=stream_payload, timeout=90.0) as r:
                if r.status_code == 200:
                    async for chunk in r.aiter_text():
                        line_buf += chunk
                        while "\n" in line_buf:
                            line, line_buf = line_buf.split("\n", 1)
                            line = line.strip()
                            if not line:
                                continue
                            if line.startswith("data:"):
                                json_str = line[5:].strip()
                                if not json_str:
                                    continue
                                try:
                                    obj = json.loads(json_str)
                                    for cand in obj.get("candidates", []):
                                        for part in cand.get("content", {}).get("parts", []):
                                            if "text" in part:
                                                token = part["text"]
                                                final_synthesis_text += token
                                                yield f"event: text\ndata: {json.dumps(token)}\n\n"
                                except Exception:
                                    pass
                    # Process trailing buffer content
                    if line_buf.strip():
                        line = line_buf.strip()
                        if line.startswith("data:"):
                            json_str = line[5:].strip()
                            if json_str:
                                try:
                                    obj = json.loads(json_str)
                                    for cand in obj.get("candidates", []):
                                        for part in cand.get("content", {}).get("parts", []):
                                            if "text" in part:
                                                token = part["text"]
                                                final_synthesis_text += token
                                                yield f"event: text\ndata: {json.dumps(token)}\n\n"
                                except Exception:
                                    pass
                else:
                    err_bytes = await r.aread()
                    err_msg = f"**Synthesis error ({r.status_code})**: {err_bytes.decode()}"
                    yield f"event: text\ndata: {json.dumps(err_msg)}\n\n"
                    final_synthesis_text = err_msg
        except Exception as exc:
            err_msg = f"\n\n*Stream Synthesis Error: {str(exc)}*\n\n"
            yield f"event: text\ndata: {json.dumps(err_msg)}\n\n"
            final_synthesis_text = err_msg

    print(f"[DEBUG] final_synthesis_text length: {len(final_synthesis_text)}")
    if not final_synthesis_text:
        print("[ERROR] Aggregator produced empty response")

    # Save complete session data
    final_chat_messages = []
    if history:
        for msg in history:
            final_chat_messages.append({"id": f"msg-{id(msg)}", "sender": msg.sender, "text": msg.text, "timestamp": ""})
    final_chat_messages.append({"id": "user-prompt", "sender": "user", "text": prompt, "timestamp": now_str()})
    final_chat_messages.append({"id": "ai-response", "sender": "ai", "text": final_synthesis_text, "timestamp": now_str()})

    db.save_session(
        session_id=session_id,
        title=prompt[:40] + "..." if len(prompt) > 40 else prompt,
        prompt=prompt,
        mode=complexity,
        nodes=nodes,
        edges=edges,
        chat_messages=final_chat_messages,
        agent_talk_logs=setup_metadata["agent_talk"],
        execution_state="setup",
        status_message="Execution completed",
        follow_up_suggestions=follow_up_suggestions
    )

    # Cache final response
    cached_val = {
        "metadata": {
            "complexity": complexity,
            "capabilities": capabilities,
            "thinking_summary": thinking_summary,
            "nodes": nodes,
            "edges": edges,
            "agent_talk": setup_metadata["agent_talk"],
            "follow_up_suggestions": follow_up_suggestions
        },
        "text": final_synthesis_text
    }
    
    # Compute embeddings inside
    try:
        prompt_embedding = await get_gemini_embedding(prompt, api_key)
        if prompt_embedding:
            prompt_hash_overall = hashlib.sha256(prompt.encode('utf-8')).hexdigest()
            db.save_cached_response(prompt_hash_overall, prompt, prompt_embedding, cached_val)
    except Exception:
        pass

    # Auto-store this full conversation turn in vector memory for cross-turn recall
    if final_synthesis_text:
        try:
            convo_memory = f"User: {prompt}\nAssistant: {final_synthesis_text[:800]}"
            await store_memory(f"session_{session_id}", convo_memory, api_key, session_id)
        except Exception:
            pass

    yield "event: done\ndata: {}\n\n"

@app.post("/execute_custom")
async def execute_custom(req: ExecuteCustomRequest):
    api_key = req.api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key or api_key == "MY_GEMINI_API_KEY" or api_key == "":
        raise HTTPException(
            status_code=400,
            detail="Gemini API Key is missing. Please configure BYOK in Settings."
        )

    complexity = "simple" if len(req.nodes) == 1 and req.nodes[0]["id"] == "general" else "custom"
    capabilities = [n["data"].get("tag", "CUSTOM") for n in req.nodes]
    
    return StreamingResponse(
        run_agent_execution_loop(
            session_id=req.session_id,
            prompt=req.prompt,
            history=req.history or [],
            api_key=api_key,
            nodes=req.nodes,
            edges=req.edges,
            complexity=complexity,
            capabilities=capabilities,
            thinking_summary="Running customized agent workflow",
            follow_up_suggestions=["Can you explain the agent collaboration?"]
        ),
        media_type="text/event-stream"
    )

