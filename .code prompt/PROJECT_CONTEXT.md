# Full Project Context

> Generated: 2026-05-26T13:49:43.392Z
> Mode: Full Project
> Files: 32
> Total Lines: 7,103
> Total Size: 274.1 KB
> Directories: 15

---

## 📁 Folder Structure

```
SoloSpace/
├── Backend/
│   ├── agent_messages.py
│   ├── db.py
│   ├── main.py
│   ├── memory_store.json
│   ├── providers.py
│   ├── requirements.txt
│   └── run.bat
├── Frontend/
│   ├── app/
│   │   ├── api/
│   │   │   └── gemini/
│   │   │       ├── approve/
│   │   │       │   └── route.ts
│   │   │       ├── execute_custom/
│   │   │       │   └── route.ts
│   │   │       ├── orchestrate/
│   │   │       │   └── route.ts
│   │   │       ├── providers/
│   │   │       │   └── route.ts
│   │   │       └── sessions/
│   │   │           └── route.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── edges/
│   │   │   └── CustomEdge.tsx
│   │   ├── nodes/
│   │   │   ├── CustomNode.tsx
│   │   │   └── GroupNode.tsx
│   │   ├── ContextMenu.tsx
│   │   ├── FlowArena.tsx
│   │   └── MarkdownRenderer.tsx
│   ├── store/
│   │   └── workflowStore.ts
│   ├── .eslintrc.json
│   ├── .gitignore
│   ├── metadata.json
│   ├── next-env.d.ts
│   ├── next.config.ts
│   ├── package.json
│   ├── README.md
│   └── tsconfig.json
├── .gitignore
└── README.md
```

---

## 📄 Source Files

### File: `Backend/agent_messages.py`

> 29 lines | 1.1 KB

```python
 1 | from typing import Dict, List, Any
 2 | import datetime
 3 | 
 4 | # In-memory message bus (for a single session; extend to DB for persistence)
 5 | session_messages: Dict[str, List[Dict[str, Any]]] = {}
 6 | 
 7 | def post_message(session_id: str, from_agent: str, to_agent: str, content: str, msg_type: str = "text"):
 8 |     """Store a message from one agent to another."""
 9 |     if session_id not in session_messages:
10 |         session_messages[session_id] = []
11 |     session_messages[session_id].append({
12 |         "from": from_agent,
13 |         "to": to_agent,
14 |         "content": content,
15 |         "type": msg_type,
16 |         "timestamp": datetime.datetime.now().isoformat()
17 |     })
18 | 
19 | def get_messages_for_agent(session_id: str, agent_id: str) -> List[Dict[str, Any]]:
20 |     """Retrieve all messages addressed to this agent."""
21 |     if session_id not in session_messages:
22 |         return []
23 |     return [m for m in session_messages[session_id] if m["to"] == agent_id]
24 | 
25 | def clear_messages(session_id: str, agent_id: str):
26 |     """Clear messages after agent reads them."""
27 |     if session_id in session_messages:
28 |         session_messages[session_id] = [m for m in session_messages[session_id] if m["to"] != agent_id]
29 |
```

### File: `Backend/db.py`

> 304 lines | 10.0 KB

```python
  1 | import sqlite3
  2 | import json
  3 | import datetime
  4 | from typing import Dict, Any, List, Optional
  5 | 
  6 | DB_FILE = "solospace.db"
  7 | 
  8 | def get_db_connection():
  9 |     conn = sqlite3.connect(DB_FILE)
 10 |     conn.row_factory = sqlite3.Row
 11 |     return conn
 12 | 
 13 | def init_db():
 14 |     conn = get_db_connection()
 15 |     cursor = conn.cursor()
 16 |     
 17 |     # Session Persistence Table
 18 |     cursor.execute("""
 19 |         CREATE TABLE IF NOT EXISTS sessions (
 20 |             session_id TEXT PRIMARY KEY,
 21 |             title TEXT,
 22 |             prompt TEXT,
 23 |             mode TEXT,
 24 |             nodes TEXT,
 25 |             edges TEXT,
 26 |             chat_messages TEXT,
 27 |             agent_talk_logs TEXT,
 28 |             execution_state TEXT,
 29 |             status_message TEXT,
 30 |             follow_up_suggestions TEXT,
 31 |             updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 32 |         )
 33 |     """)
 34 |     
 35 |     # State Checkpointing Table (for cycle/pause graph execution)
 36 |     cursor.execute("""
 37 |         CREATE TABLE IF NOT EXISTS checkpoints (
 38 |             session_id TEXT,
 39 |             node_id TEXT,
 40 |             state_data TEXT,
 41 |             timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 42 |             PRIMARY KEY (session_id, node_id)
 43 |         )
 44 |     """)
 45 |     
 46 |     # Tool approvals table
 47 |     cursor.execute("""
 48 |         CREATE TABLE IF NOT EXISTS tool_approvals (
 49 |             session_id TEXT,
 50 |             node_id TEXT,
 51 |             tool_name TEXT,
 52 |             action_input TEXT,
 53 |             status TEXT DEFAULT 'pending',
 54 |             log_id TEXT,
 55 |             updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 56 |             PRIMARY KEY (session_id, node_id, tool_name, log_id)
 57 |         )
 58 |     """)
 59 |     
 60 |     # Semantic cache table
 61 |     cursor.execute("""
 62 |         CREATE TABLE IF NOT EXISTS semantic_cache (
 63 |             prompt_hash TEXT PRIMARY KEY,
 64 |             prompt TEXT,
 65 |             embedding TEXT,
 66 |             response TEXT,
 67 |             created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 68 |         )
 69 |     """)
 70 |     
 71 |     # Rate limits table
 72 |     cursor.execute("""
 73 |         CREATE TABLE IF NOT EXISTS rate_limits (
 74 |             user_id TEXT PRIMARY KEY,
 75 |             tokens_remaining REAL,
 76 |             last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 77 |         )
 78 |     """)
 79 |     
 80 |     conn.commit()
 81 |     conn.close()
 82 | 
 83 | # Session CRUD operations
 84 | def save_session(
 85 |     session_id: str,
 86 |     title: str,
 87 |     prompt: str,
 88 |     mode: str,
 89 |     nodes: List[Dict[str, Any]],
 90 |     edges: List[Dict[str, Any]],
 91 |     chat_messages: List[Dict[str, Any]],
 92 |     agent_talk_logs: List[Dict[str, Any]],
 93 |     execution_state: str,
 94 |     status_message: str,
 95 |     follow_up_suggestions: List[str]
 96 | ):
 97 |     conn = get_db_connection()
 98 |     cursor = conn.cursor()
 99 |     cursor.execute(
100 |         """
101 |         INSERT INTO sessions (
102 |             session_id, title, prompt, mode, nodes, edges, chat_messages, 
103 |             agent_talk_logs, execution_state, status_message, follow_up_suggestions, updated_at
104 |         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
105 |         ON CONFLICT(session_id) DO UPDATE SET
106 |             title=excluded.title,
107 |             prompt=excluded.prompt,
108 |             mode=excluded.mode,
109 |             nodes=excluded.nodes,
110 |             edges=excluded.edges,
111 |             chat_messages=excluded.chat_messages,
112 |             agent_talk_logs=excluded.agent_talk_logs,
113 |             execution_state=excluded.execution_state,
114 |             status_message=excluded.status_message,
115 |             follow_up_suggestions=excluded.follow_up_suggestions,
116 |             updated_at=CURRENT_TIMESTAMP
117 |         """,
118 |         (
119 |             session_id,
120 |             title,
121 |             prompt,
122 |             mode,
123 |             json.dumps(nodes),
124 |             json.dumps(edges),
125 |             json.dumps(chat_messages),
126 |             json.dumps(agent_talk_logs),
127 |             execution_state,
128 |             status_message,
129 |             json.dumps(follow_up_suggestions)
130 |         )
131 |     )
132 |     conn.commit()
133 |     conn.close()
134 | 
135 | def load_sessions() -> List[Dict[str, Any]]:
136 |     conn = get_db_connection()
137 |     cursor = conn.cursor()
138 |     cursor.execute("SELECT session_id, title, prompt, mode, execution_state, status_message, updated_at FROM sessions ORDER BY updated_at DESC")
139 |     rows = cursor.fetchall()
140 |     conn.close()
141 |     return [dict(row) for row in rows]
142 | 
143 | def load_session(session_id: str) -> Optional[Dict[str, Any]]:
144 |     conn = get_db_connection()
145 |     cursor = conn.cursor()
146 |     cursor.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,))
147 |     row = cursor.fetchone()
148 |     conn.close()
149 |     if not row:
150 |         return None
151 |     res = dict(row)
152 |     # Parse JSON fields
153 |     res["nodes"] = json.loads(res["nodes"]) if res["nodes"] else []
154 |     res["edges"] = json.loads(res["edges"]) if res["edges"] else []
155 |     res["chat_messages"] = json.loads(res["chat_messages"]) if res["chat_messages"] else []
156 |     res["agent_talk_logs"] = json.loads(res["agent_talk_logs"]) if res["agent_talk_logs"] else []
157 |     res["follow_up_suggestions"] = json.loads(res["follow_up_suggestions"]) if res["follow_up_suggestions"] else []
158 |     return res
159 | 
160 | def delete_session(session_id: str):
161 |     conn = get_db_connection()
162 |     cursor = conn.cursor()
163 |     cursor.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
164 |     cursor.execute("DELETE FROM checkpoints WHERE session_id = ?", (session_id,))
165 |     cursor.execute("DELETE FROM tool_approvals WHERE session_id = ?", (session_id,))
166 |     conn.commit()
167 |     conn.close()
168 | 
169 | # State Checkpoint operations
170 | def save_checkpoint(session_id: str, node_id: str, state_data: Dict[str, Any]):
171 |     conn = get_db_connection()
172 |     cursor = conn.cursor()
173 |     cursor.execute(
174 |         """
175 |         INSERT INTO checkpoints (session_id, node_id, state_data, timestamp)
176 |         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
177 |         ON CONFLICT(session_id, node_id) DO UPDATE SET
178 |             state_data=excluded.state_data,
179 |             timestamp=CURRENT_TIMESTAMP
180 |         """,
181 |         (session_id, node_id, json.dumps(state_data))
182 |     )
183 |     conn.commit()
184 |     conn.close()
185 | 
186 | def load_checkpoint(session_id: str, node_id: str) -> Optional[Dict[str, Any]]:
187 |     conn = get_db_connection()
188 |     cursor = conn.cursor()
189 |     cursor.execute("SELECT state_data FROM checkpoints WHERE session_id = ? AND node_id = ?", (session_id, node_id))
190 |     row = cursor.fetchone()
191 |     conn.close()
192 |     if row:
193 |         return json.loads(row["state_data"])
194 |     return None
195 | 
196 | # Tool Approval operations
197 | def create_tool_approval(session_id: str, node_id: str, tool_name: str, action_input: str, log_id: str):
198 |     conn = get_db_connection()
199 |     cursor = conn.cursor()
200 |     cursor.execute(
201 |         """
202 |         INSERT INTO tool_approvals (session_id, node_id, tool_name, action_input, log_id, status, updated_at)
203 |         VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
204 |         ON CONFLICT(session_id, node_id, tool_name, log_id) DO UPDATE SET
205 |             action_input=excluded.action_input,
206 |             status='pending',
207 |             updated_at=CURRENT_TIMESTAMP
208 |         """,
209 |         (session_id, node_id, tool_name, action_input, log_id)
210 |     )
211 |     conn.commit()
212 |     conn.close()
213 | 
214 | def update_tool_approval(session_id: str, node_id: str, tool_name: str, log_id: str, status: str):
215 |     conn = get_db_connection()
216 |     cursor = conn.cursor()
217 |     cursor.execute(
218 |         "UPDATE tool_approvals SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND node_id = ? AND tool_name = ? AND log_id = ?",
219 |         (status, session_id, node_id, tool_name, log_id)
220 |     )
221 |     conn.commit()
222 |     conn.close()
223 | 
224 | def get_tool_approval(session_id: str, node_id: str, tool_name: str, log_id: str) -> Optional[str]:
225 |     conn = get_db_connection()
226 |     cursor = conn.cursor()
227 |     cursor.execute(
228 |         "SELECT status FROM tool_approvals WHERE session_id = ? AND node_id = ? AND tool_name = ? AND log_id = ?",
229 |         (session_id, node_id, tool_name, log_id)
230 |     )
231 |     row = cursor.fetchone()
232 |     conn.close()
233 |     return row["status"] if row else None
234 | 
235 | # Semantic Cache operations
236 | def get_cached_response(prompt_hash: str) -> Optional[Dict[str, Any]]:
237 |     conn = get_db_connection()
238 |     cursor = conn.cursor()
239 |     cursor.execute("SELECT response FROM semantic_cache WHERE prompt_hash = ?", (prompt_hash,))
240 |     row = cursor.fetchone()
241 |     conn.close()
242 |     if row:
243 |         return json.loads(row["response"])
244 |     return None
245 | 
246 | def save_cached_response(prompt_hash: str, prompt: str, embedding: List[float], response: Dict[str, Any]):
247 |     conn = get_db_connection()
248 |     cursor = conn.cursor()
249 |     cursor.execute(
250 |         """
251 |         INSERT INTO semantic_cache (prompt_hash, prompt, embedding, response, created_at)
252 |         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
253 |         ON CONFLICT(prompt_hash) DO UPDATE SET
254 |             response=excluded.response,
255 |             created_at=CURRENT_TIMESTAMP
256 |         """,
257 |         (prompt_hash, prompt, json.dumps(embedding), json.dumps(response))
258 |     )
259 |     conn.commit()
260 |     conn.close()
261 | 
262 | def load_all_cached_embeddings() -> List[Dict[str, Any]]:
263 |     conn = get_db_connection()
264 |     cursor = conn.cursor()
265 |     cursor.execute("SELECT prompt_hash, prompt, embedding, response FROM semantic_cache")
266 |     rows = cursor.fetchall()
267 |     conn.close()
268 |     res = []
269 |     for row in rows:
270 |         res.append({
271 |             "prompt_hash": row["prompt_hash"],
272 |             "prompt": row["prompt"],
273 |             "embedding": json.loads(row["embedding"]),
274 |             "response": json.loads(row["response"])
275 |         })
276 |     return res
277 | 
278 | # Rate Limits operations
279 | def get_rate_limit(user_id: str) -> Optional[Dict[str, Any]]:
280 |     conn = get_db_connection()
281 |     cursor = conn.cursor()
282 |     cursor.execute("SELECT tokens_remaining, last_updated FROM rate_limits WHERE user_id = ?", (user_id,))
283 |     row = cursor.fetchone()
284 |     conn.close()
285 |     if row:
286 |         return {"tokens_remaining": row["tokens_remaining"], "last_updated": row["last_updated"]}
287 |     return None
288 | 
289 | def update_rate_limit(user_id: str, tokens_remaining: float):
290 |     conn = get_db_connection()
291 |     cursor = conn.cursor()
292 |     cursor.execute(
293 |         """
294 |         INSERT INTO rate_limits (user_id, tokens_remaining, last_updated)
295 |         VALUES (?, ?, CURRENT_TIMESTAMP)
296 |         ON CONFLICT(user_id) DO UPDATE SET
297 |             tokens_remaining=excluded.tokens_remaining,
298 |             last_updated=CURRENT_TIMESTAMP
299 |         """,
300 |         (user_id, tokens_remaining)
301 |     )
302 |     conn.commit()
303 |     conn.close()
304 |
```

### File: `Backend/main.py`

> 1456 lines | 58.8 KB

```python
   1 | import os
   2 | import json
   3 | import httpx
   4 | import datetime
   5 | import math
   6 | import asyncio
   7 | import sys
   8 | import subprocess
   9 | import hashlib
  10 | import time
  11 | import threading
  12 | import ipaddress
  13 | from fastapi import FastAPI, HTTPException, Request
  14 | from fastapi.middleware.cors import CORSMiddleware
  15 | from fastapi.responses import StreamingResponse, JSONResponse
  16 | from pydantic import BaseModel
  17 | from typing import Optional, List, Dict, Any
  18 | from bs4 import BeautifulSoup
  19 | import db
  20 | from agent_messages import post_message, get_messages_for_agent, clear_messages
  21 | from providers import (
  22 |     call_provider,
  23 |     stream_provider,
  24 |     call_provider_json,
  25 |     get_embedding,
  26 |     get_available_providers,
  27 |     resolve_api_key,
  28 | )
  29 | 
  30 | 
  31 | # Initialize database
  32 | db.init_db()
  33 | 
  34 | app = FastAPI(title="Solospace Python Orchestrator API")
  35 | 
  36 | # Allow Next.js frontend to reach this API (critical on Windows / localhost dev)
  37 | app.add_middleware(
  38 |     CORSMiddleware,
  39 |     allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
  40 |     allow_credentials=True,
  41 |     allow_methods=["*"],
  42 |     allow_headers=["*"],
  43 | )
  44 | 
  45 | # Track by IP for Rate Limiting
  46 | ip_rate_limits = {}
  47 | 
  48 | @app.middleware("http")
  49 | async def ip_rate_limit_middleware(request: Request, call_next):
  50 |     if request.method == "OPTIONS":
  51 |         return await call_next(request)
  52 |         
  53 |     client_ip = request.client.host if request.client else "unknown"
  54 |     
  55 |     if client_ip not in ip_rate_limits:
  56 |         ip_rate_limits[client_ip] = {"count": 0, "window_start": time.time()}
  57 |     
  58 |     info = ip_rate_limits[client_ip]
  59 |     now = time.time()
  60 |     
  61 |     # Reset window every 60 seconds
  62 |     if now - info["window_start"] > 60:
  63 |         info["count"] = 0
  64 |         info["window_start"] = now
  65 |     
  66 |     info["count"] += 1
  67 |     
  68 |     # Max 40 requests per minute per IP
  69 |     if info["count"] > 40:
  70 |         return JSONResponse(
  71 |             status_code=429,
  72 |             content={"detail": "Rate limit exceeded. Please wait before making more requests."}
  73 |         )
  74 |     
  75 |     return await call_next(request)
  76 | 
  77 | # Global coordination states
  78 | MEMORY_FILE = "memory_store.json"
  79 | 
  80 | class Message(BaseModel):
  81 |     sender: str
  82 |     text: str
  83 | 
  84 | class OrchestrateRequest(BaseModel):
  85 |     prompt: str
  86 |     history: Optional[List[Message]] = []
  87 |     api_key: Optional[str] = None
  88 |     session_id: Optional[str] = None
  89 |     execute_agents: bool = True
  90 |     provider: str = "gemini"
  91 |     model: Optional[str] = None
  92 | 
  93 | class ApprovalRequest(BaseModel):
  94 |     sessionId: str
  95 |     nodeId: str
  96 |     toolName: str
  97 |     action: str  # "approve" or "deny"
  98 | 
  99 | class ExecuteCustomRequest(BaseModel):
 100 |     session_id: str
 101 |     api_key: str
 102 |     nodes: List[Dict[str, Any]]
 103 |     edges: List[Dict[str, Any]]
 104 |     prompt: str
 105 |     history: Optional[List[Message]] = []
 106 |     provider: str = "gemini"
 107 |     model: Optional[str] = None
 108 | 
 109 | # ─── VECTOR DB MEMORY STORE (Multi-Provider Embeddings + Local Cosine Similarity) ───
 110 | 
 111 | async def get_gemini_embedding(text: str, api_key: str) -> List[float]:
 112 |     return await get_embedding("gemini", api_key, text)
 113 | 
 114 | def cosine_similarity(v1: List[float], v2: List[float]) -> float:
 115 |     if not v1 or not v2 or len(v1) != len(v2):
 116 |         return 0.0
 117 |     dot = sum(a * b for a, b in zip(v1, v2))
 118 |     norm1 = math.sqrt(sum(a * a for a in v1))
 119 |     norm2 = math.sqrt(sum(b * b for b in v2))
 120 |     if norm1 == 0.0 or norm2 == 0.0:
 121 |         return 0.0
 122 |     return dot / (norm1 * norm2)
 123 | 
 124 | # Bug 7: Thread-safe memory I/O lock
 125 | memory_lock = threading.Lock()
 126 | 
 127 | def load_memories() -> List[Dict[str, Any]]:
 128 |     with memory_lock:
 129 |         if os.path.exists(MEMORY_FILE):
 130 |             try:
 131 |                 with open(MEMORY_FILE, "r") as f:
 132 |                     return json.load(f)
 133 |             except Exception:
 134 |                 pass
 135 |     return []
 136 | 
 137 | def save_memories(memories: List[Dict[str, Any]]):
 138 |     with memory_lock:
 139 |         try:
 140 |             with open(MEMORY_FILE, "w") as f:
 141 |                 json.dump(memories, f, indent=2)
 142 |         except Exception as e:
 143 |             print(f"[MEMORY ERROR] Saving file failed: {e}")
 144 | 
 145 | MAX_MEMORIES = 200  # Bug 8: Cap total entries to prevent unbounded growth
 146 | 
 147 | async def store_memory(agent_id: str, text: str, api_key: str, session_id: str = None, provider: str = "gemini"):
 148 |     embedding = await get_embedding(provider, api_key, text)
 149 |     if not embedding:
 150 |         return
 151 |     memories = load_memories()
 152 |     entry = {
 153 |         "agent_id": agent_id,
 154 |         "text": text,
 155 |         "embedding": embedding,
 156 |         "timestamp": datetime.datetime.now().isoformat()
 157 |     }
 158 |     if session_id:
 159 |         entry["session_id"] = session_id
 160 |     memories.append(entry)
 161 | 
 162 |     # Bug 8: Evict oldest entries if over limit
 163 |     if len(memories) > MAX_MEMORIES:
 164 |         memories = memories[-MAX_MEMORIES:]
 165 | 
 166 |     save_memories(memories)
 167 | 
 168 | async def query_memory(query: str, api_key: str, top_k=2, agent_id: Optional[str] = None, session_id: Optional[str] = None, provider: str = "gemini") -> List[str]:
 169 |     embedding = await get_embedding(provider, api_key, query)
 170 |     if not embedding:
 171 |         return []
 172 |     memories = load_memories()
 173 |     scored = []
 174 |     for m in memories:
 175 |         if agent_id is not None:
 176 |             # Match directly or by session prefix
 177 |             if m.get("agent_id") != agent_id and not (agent_id.startswith("session_") and m.get("session_id") == agent_id[8:]):
 178 |                 continue
 179 |         if session_id is not None and m.get("session_id") != session_id:
 180 |             continue
 181 |         sim = cosine_similarity(embedding, m["embedding"])
 182 |         scored.append((sim, m["text"]))
 183 |     
 184 |     scored.sort(key=lambda x: x[0], reverse=True)
 185 |     return [text for sim, text in scored[:top_k] if sim > 0.45]
 186 | 
 187 | 
 188 | # ─── REAL AGENT TOOLS ───
 189 | 
 190 | async def execute_web_search(query: str) -> str:
 191 |     headers = {
 192 |         "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
 193 |     }
 194 |     url = f"https://html.duckduckgo.com/html/?q={query}"
 195 |     async with httpx.AsyncClient() as client:
 196 |         try:
 197 |             r = await client.get(url, headers=headers, timeout=15.0)
 198 |             if r.status_code == 200:
 199 |                 soup = BeautifulSoup(r.text, "html.parser")
 200 |                 snippets = []
 201 |                 for div in soup.find_all("a", class_="result__snippet")[:3]:
 202 |                     snippets.append(div.get_text().strip())
 203 |                 if snippets:
 204 |                     return "\n".join(snippets)
 205 |         except Exception as e:
 206 |             return f"Search failed: {str(e)}"
 207 |     return f"No search results found for query: '{query}'."
 208 | 
 209 | async def execute_web_browse(url: str) -> str:
 210 |     """Fetch and extract text content from a URL."""
 211 |     headers = {
 212 |         "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
 213 |     }
 214 |     from urllib.parse import urlparse
 215 |     import socket
 216 |     BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254"}
 217 |     ALLOWED_SCHEMES = {"http", "https"}
 218 |     try:
 219 |         parsed = urlparse(url)
 220 |         if parsed.scheme not in ALLOWED_SCHEMES:
 221 |             return f"Error: Scheme '{parsed.scheme}' not allowed. Use http/https."
 222 |         hostname = parsed.hostname
 223 |         if not hostname:
 224 |             return "Error: Invalid URL provided."
 225 |         if hostname.lower() in BLOCKED_HOSTS:
 226 |             return "Error: Access to internal/local addresses is blocked."
 227 |         try:
 228 |             ip_str = socket.gethostbyname(hostname)
 229 |             # Bug 12: Use ipaddress module for complete private IP detection
 230 |             ip_obj = ipaddress.ip_address(ip_str)
 231 |             if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
 232 |                 return "Error: Access to internal/local addresses is blocked."
 233 |         except ValueError:
 234 |             pass  # Not a valid IP string after DNS resolve, allow
 235 |         except Exception:
 236 |             pass
 237 |     except Exception as e:
 238 |         return f"Error: Invalid URL - {str(e)}"
 239 | 
 240 |     async with httpx.AsyncClient() as client:
 241 |         try:
 242 |             r = await client.get(url, headers=headers, timeout=15.0, follow_redirects=True)
 243 |             if r.status_code == 200:
 244 |                 soup = BeautifulSoup(r.text, "html.parser")
 245 |                 for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
 246 |                     tag.decompose()
 247 |                 text = soup.get_text(separator="\n", strip=True)
 248 |                 return text[:3000]
 249 |             return f"Browse failed with status {r.status_code}"
 250 |         except Exception as e:
 251 |             return f"Browse error: {str(e)}"
 252 | 
 253 | async def execute_python_code(code: str) -> str:
 254 |     import tempfile
 255 |     
 256 |     SANDBOX_HEADER = """
 257 | import sys
 258 | import os
 259 | import tempfile
 260 | 
 261 | # Block network access
 262 | import socket
 263 | socket.socket = lambda *a, **k: None
 264 | 
 265 | # Restrict file access to temp dir only
 266 | _original_open = open
 267 | def _restricted_open(name, *args, **kwargs):
 268 |     temp_dir = os.path.abspath(tempfile.gettempdir())
 269 |     resolved_path = os.path.abspath(str(name))
 270 |     if not resolved_path.startswith(temp_dir):
 271 |         raise PermissionError(f"Access denied: {name}")
 272 |     return _original_open(name, *args, **kwargs)
 273 | 
 274 | # Keep restricted open and delete original dangerous builtins
 275 | __builtins__.open = _restricted_open
 276 | if 'eval' in __builtins__.__dict__:
 277 |     del __builtins__.__dict__['eval']
 278 | if 'exec' in __builtins__.__dict__:
 279 |     del __builtins__.__dict__['exec']
 280 | if 'compile' in __builtins__.__dict__:
 281 |     del __builtins__.__dict__['compile']
 282 | if '__import__' in __builtins__.__dict__:
 283 |     del __builtins__.__dict__['__import__']
 284 | """
 285 | 
 286 |     sandboxed_code = SANDBOX_HEADER + "\n" + code
 287 | 
 288 |     # Create a temp file to execute the code safely
 289 |     with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
 290 |         f.write(sandboxed_code)
 291 |         temp_path = f.name
 292 | 
 293 |     try:
 294 |         env = os.environ.copy()
 295 |         env.pop('GEMINI_API_KEY', None)  # Never expose API key
 296 |         env.pop('DATABASE_URL', None)
 297 | 
 298 |         p = subprocess.Popen(
 299 |             [sys.executable, temp_path],
 300 |             stdout=subprocess.PIPE,
 301 |             stderr=subprocess.PIPE,
 302 |             text=True,
 303 |             cwd=tempfile.gettempdir(),
 304 |             env=env
 305 |         )
 306 | 
 307 |         try:
 308 |             stdout, stderr = p.communicate(timeout=15.0)  # Reduced timeout
 309 |         except subprocess.TimeoutExpired:
 310 |             p.kill()
 311 |             return "Error: Code execution timed out (15s limit)."
 312 | 
 313 |         output = ""
 314 |         if stdout:
 315 |             output += f"STDOUT:\n{stdout[:2000]}\n"  # Limit output size
 316 |         if stderr:
 317 |             output += f"STDERR:\n{stderr[:1000]}\n"
 318 |         if not output:
 319 |             output = "Code executed successfully with no output."
 320 |         return output
 321 |     except Exception as e:
 322 |         return f"Execution error: {str(e)}"
 323 |     finally:
 324 |         try:
 325 |             os.unlink(temp_path)
 326 |         except Exception:
 327 |             pass
 328 | 
 329 | async def execute_api_call(url: str, method: str = "GET", payload_json: Optional[str] = None) -> str:
 330 |     from urllib.parse import urlparse
 331 |     import socket
 332 |     
 333 |     BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254"}
 334 |     ALLOWED_SCHEMES = {"http", "https"}
 335 |     
 336 |     try:
 337 |         parsed = urlparse(url)
 338 |         if parsed.scheme not in ALLOWED_SCHEMES:
 339 |             return f"Error: Scheme '{parsed.scheme}' not allowed. Use http/https."
 340 |         hostname = parsed.hostname
 341 |         if not hostname:
 342 |             return "Error: Invalid URL provided."
 343 |         
 344 |         # Prevent SSRF
 345 |         if hostname.lower() in BLOCKED_HOSTS:
 346 |             return "Error: Access to internal/local addresses is blocked."
 347 |             
 348 |         try:
 349 |             ip_str = socket.gethostbyname(hostname)
 350 |             # Bug 12: Use ipaddress module for complete private IP detection
 351 |             ip_obj = ipaddress.ip_address(ip_str)
 352 |             if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
 353 |                 return "Error: Access to internal/local addresses is blocked."
 354 |         except ValueError:
 355 |             pass  # Not a valid IP string, allow
 356 |         except Exception:
 357 |             pass
 358 |     except Exception as e:
 359 |         return f"Error: Invalid URL - {str(e)}"
 360 | 
 361 |     async with httpx.AsyncClient() as client:
 362 |         try:
 363 |             if method.upper() == "POST":
 364 |                 data = json.loads(payload_json) if payload_json else {}
 365 |                 r = await client.post(url, json=data, timeout=15.0)
 366 |             else:
 367 |                 r = await client.get(url, timeout=15.0)
 368 |             return f"Status: {r.status_code}\nResponse: {r.text[:1500]}"
 369 |         except Exception as e:
 370 |             return f"API call failed: {str(e)}"
 371 | 
 372 | # ─── AGENT COORDINATOR DAG SORT ───
 373 | 
 374 | def sort_nodes_topologically(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
 375 |     """Sort nodes using both explicit dependencies AND visual edges."""
 376 |     visited = set()
 377 |     sorted_nodes = []
 378 |     node_dict = {n["id"]: n for n in nodes}
 379 |     
 380 |     # Build dependency graph from both sources
 381 |     dep_graph = {n["id"]: set(n["data"].get("dependencies", [])) for n in nodes}
 382 |     
 383 |     # Also add edges as dependencies
 384 |     if edges:
 385 |         for edge in edges:
 386 |             target = edge.get("target")
 387 |             source = edge.get("source")
 388 |             if target in dep_graph and source in node_dict:
 389 |                 dep_graph[target].add(source)
 390 | 
 391 |     def visit(node_id):
 392 |         if node_id in visited:
 393 |             return
 394 |         visited.add(node_id)
 395 |         for dep in dep_graph.get(node_id, set()):
 396 |             if dep in node_dict:
 397 |                 visit(dep)
 398 |         if node_id in node_dict:
 399 |             sorted_nodes.append(node_dict[node_id])
 400 | 
 401 |     for node in nodes:
 402 |         visit(node["id"])
 403 |     return sorted_nodes
 404 | 
 405 | # ─── ORCHESTRATION SYSTEM INSTRUCTIONS ───
 406 | 
 407 | ORCHESTRATOR_SYSTEM_INSTRUCTION = """
 408 | You are Solospace, an elite workflow orchestrator. Your ONLY job is to analyze the user's request and output a JSON list of specialized agents.
 409 | 
 410 | CRITICAL RULES:
 411 | - For ANY request that involves building, designing, integrating, or researching a non‑trivial system, you MUST output at least 2 agents.
 412 | - For requests that mention multiple domains (e.g., frontend + backend + database), use 3‑6 agents.
 413 | - Only output a SINGLE agent ("general") for extremely simple questions like "Hello", "What is AI?", or one‑line explanations.
 414 | - Classify the complexity field in the JSON schema as "complex" if the user asks to build, design, integrate, or analyze a system with 2+ distinct components (frontend, backend, database, payments, auth, research). If in doubt, prefer "complex" over "simple".
 415 | 
 416 | AGENT CREATION:
 417 | You can use any senderId, not only the built‑in list. Define custom agents freely.
 418 | Every agent MUST have:
 419 | - senderId: a unique short identifier (e.g., "frontend_ui", "payment_gateway", "data_analyst").
 420 | - senderName: a human readable name.
 421 | - senderIcon: "code", "science", or "trending_up".
 422 | - text: what this agent will contribute.
 423 | - objective: specific goal for this agent.
 424 | - systemPrompt: detailed instructions for the agent.
 425 | - rules: 2‑3 specific constraints.
 426 | - dependencies: list of other agent ids this agent needs.
 427 | - tools: choose from ["Web Search", "Memory", "Code Executor", "Browser", "API Connector"].
 428 | 
 429 | EXAMPLES:
 430 | 1. User: "Build a full‑stack SaaS with Next.js, Stripe payments, and PostgreSQL"
 431 |    → Output agents: frontend_ui, backend_api, database_admin, payment_integrator (4 agents).
 432 | 
 433 | 2. User: "Explain how JWT works"
 434 |    → Output agents: general (1 agent).
 435 | 
 436 | 3. User: "Research AI trends and write a summary"
 437 |    → Output agents: researcher, writer (2 agents).
 438 | 
 439 | Respond ONLY with a valid JSON object matching the provided schema.
 440 | """
 441 | 
 442 | orchestration_schema = {
 443 |     "type": "OBJECT",
 444 |     "properties": {
 445 |         "complexity": {
 446 |             "type": "STRING",
 447 |             "enum": ["simple", "medium", "complex"]
 448 |         },
 449 |         "capabilities": {
 450 |             "type": "ARRAY",
 451 |             "items": {"type": "STRING"}
 452 |         },
 453 |         "thinking_summary": {
 454 |             "type": "STRING"
 455 |         },
 456 |         "follow_up_suggestions": {
 457 |             "type": "ARRAY",
 458 |             "items": {"type": "STRING"}
 459 |         },
 460 |         "agent_talk": {
 461 |             "type": "ARRAY",
 462 |             "items": {
 463 |                 "type": "OBJECT",
 464 |                 "properties": {
 465 |                     "senderId": {"type": "STRING"},
 466 |                     "senderName": {"type": "STRING"},
 467 |                     "senderIcon": {"type": "STRING"},
 468 |                     "text": {"type": "STRING"},
 469 |                     "objective": {"type": "STRING"},
 470 |                     "systemPrompt": {"type": "STRING"},
 471 |                     "rules": {
 472 |                         "type": "ARRAY",
 473 |                         "items": {"type": "STRING"}
 474 |                     },
 475 |                     "dependencies": {
 476 |                         "type": "ARRAY",
 477 |                         "items": {"type": "STRING"}
 478 |                     },
 479 |                     "tools": {
 480 |                         "type": "ARRAY",
 481 |                         "items": {"type": "STRING"}
 482 |                     },
 483 |                     "custom_template": {
 484 |                         "type": "OBJECT",
 485 |                         "properties": {
 486 |                             "name": {"type": "STRING"},
 487 |                             "icon": {"type": "STRING"},
 488 |                             "tag": {"type": "STRING"},
 489 |                             "temp": {"type": "NUMBER"},
 490 |                             "logic": {"type": "INTEGER"},
 491 |                             "col": {"type": "INTEGER"}
 492 |                         },
 493 |                         "required": ["name", "icon", "tag", "temp", "logic", "col"]
 494 |                     }
 495 |                 },
 496 |                 "required": ["senderId", "senderName", "senderIcon", "text", "objective", "systemPrompt", "rules", "dependencies", "tools"]
 497 |             }
 498 |         }
 499 |     },
 500 |     "required": ["complexity", "capabilities", "thinking_summary", "agent_talk", "follow_up_suggestions"]
 501 | }
 502 | 
 503 | # Real-time ReAct loop action schema for agents
 504 | agent_turn_schema = {
 505 |     "type": "OBJECT",
 506 |     "properties": {
 507 |         "thought": {"type": "STRING"},
 508 |         "action": {
 509 |             "type": "STRING",
 510 |             "enum": ["none", "web_search", "execute_code", "api_call", "query_memory", "store_memory", "send_message", "browse_web", "analyze_image", "read_file"]
 511 |         },
 512 |         "action_input": {"type": "STRING"},
 513 |         "final_answer": {"type": "STRING"}
 514 |     },
 515 |     "required": ["thought", "action"]
 516 | }
 517 | 
 518 | 
 519 | RESPONSE_SYSTEM_INSTRUCTION = """
 520 | You are Solospace, an elite assistant.
 521 | Your job is to produce a clean, direct response to the user's prompt using the provided context.
 522 | 
 523 | STRICT RULES — NEVER VIOLATE:
 524 | - Do NOT include any preamble, header, or status line such as "[Agent processing...]", "Synthesizing...", "From the agent team:", or similar.
 525 | - Do NOT mention agents, sub-tasks, specialists, orchestration, or internal workflow mechanics.
 526 | - Do NOT start your response with any markdown header that references processing steps.
 527 | - Begin your response immediately and directly with the answer.
 528 | - Use clean, well-structured markdown only when it genuinely helps the user.
 529 | - For conversational messages (e.g. greetings), reply naturally and concisely without any structure.
 530 | """
 531 | 
 532 | GEMINI_SAFETY_SETTINGS = [
 533 |     {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
 534 |     {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
 535 |     {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
 536 |     {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"}
 537 | ]
 538 | 
 539 | def check_guardrails(prompt: str) -> Optional[str]:
 540 |     jailbreak_keywords = [
 541 |         "ignore previous instructions", "ignore all instructions", "override system prompt",
 542 |         "you are now developer mode", "jailbreak"
 543 |     ]
 544 |     for keyword in jailbreak_keywords:
 545 |         if keyword in prompt.lower():
 546 |             return "Safety Alert: Input contains potential prompt injection or system instruction bypass."
 547 |     return None
 548 | 
 549 | MAX_TOKENS = 100000.0
 550 | REFILL_RATE = 100.0
 551 | 
 552 | def check_rate_limit(session_id: str, prompt_len: int) -> bool:
 553 |     limit_info = db.get_rate_limit(session_id)
 554 |     now = datetime.datetime.now()
 555 |     
 556 |     if not limit_info:
 557 |         tokens = MAX_TOKENS
 558 |     else:
 559 |         try:
 560 |             last_updated = datetime.datetime.fromisoformat(limit_info["last_updated"])
 561 |             elapsed = (now - last_updated).total_seconds()
 562 |             tokens = min(MAX_TOKENS, limit_info["tokens_remaining"] + elapsed * REFILL_RATE)
 563 |         except Exception:
 564 |             tokens = MAX_TOKENS
 565 |     
 566 |     estimated_tokens = prompt_len / 3.0
 567 |     
 568 |     if tokens < estimated_tokens:
 569 |         return False
 570 |         
 571 |     tokens -= estimated_tokens
 572 |     db.update_rate_limit(session_id, tokens)
 573 |     return True
 574 | 
 575 | @app.post("/approve")
 576 | async def approve_tool(req: ApprovalRequest):
 577 |     status = "approved" if req.action == "approve" else "denied"
 578 |     
 579 |     # Update SQLite database tool approvals
 580 |     db.update_tool_approval(req.sessionId, req.nodeId, req.toolName, "pending", status)
 581 |     # Database is the single source of truth; no in-memory fallback needed
 582 |     # Perform wildcard updates in database (if specific logId is not provided)
 583 |     conn = db.get_db_connection()
 584 |     cursor = conn.cursor()
 585 |     cursor.execute(
 586 |         "UPDATE tool_approvals SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND node_id = ? AND tool_name = ? AND status = 'pending'",
 587 |         (status, req.sessionId, req.nodeId, req.toolName)
 588 |     )
 589 |     conn.commit()
 590 |     conn.close()
 591 |     
 592 |     return {"status": "success", "state": status}
 593 | 
 594 | async def run_cached_flow(cached_data: Dict[str, Any]):
 595 |     metadata = cached_data.get("metadata")
 596 |     if metadata:
 597 |         yield f"event: metadata\ndata: {json.dumps(metadata)}\n\n"
 598 |     
 599 |     text = cached_data.get("text", "")
 600 |     chunk_size = 15
 601 |     for i in range(0, len(text), chunk_size):
 602 |         chunk = text[i:i+chunk_size]
 603 |         yield f"event: text\ndata: {json.dumps(chunk)}\n\n"
 604 |         await asyncio.sleep(0.02)
 605 |     yield "event: done\ndata: {}\n\n"
 606 | 
 607 | def compute_agent_layout(active_agents):
 608 |     """Compute non-overlapping positions for agent nodes using a proper grid layout."""
 609 |     col_groups = {1: [], 2: [], 3: []}
 610 |     for uid, agent, tpl in active_agents:
 611 |         col = tpl.get("col", 2)
 612 |         col_groups[col].append((uid, agent, tpl))
 613 | 
 614 |     COL_X = {1: 80, 2: 380, 3: 680}
 615 |     NODE_HEIGHT = 220
 616 |     VERTICAL_GAP = 40
 617 |     START_Y = 50
 618 | 
 619 |     positions = {}
 620 |     for col, agents_in_col in col_groups.items():
 621 |         x = COL_X[col]
 622 |         for idx, (uid, agent, tpl) in enumerate(agents_in_col):
 623 |             y = START_Y + idx * (NODE_HEIGHT + VERTICAL_GAP)
 624 |             positions[uid] = {"x": x, "y": y}
 625 | 
 626 |     return positions
 627 | 
 628 | @app.post("/orchestrate")
 629 | async def orchestrate(req: OrchestrateRequest):
 630 |     api_key = resolve_api_key(req.provider, req.api_key)
 631 |     if not api_key:
 632 |         raise HTTPException(
 633 |             status_code=400,
 634 |             detail=f"API Key for provider '{req.provider}' is missing. Please configure BYOK in Settings or set the appropriate environment variable."
 635 |         )
 636 | 
 637 |     # 1. Guardrails check
 638 |     guardrail_err = check_guardrails(req.prompt)
 639 |     if guardrail_err:
 640 |         async def stream_guardrail_err():
 641 |             yield f"event: text\ndata: {json.dumps(guardrail_err)}\n\n"
 642 |             yield "event: done\ndata: {}\n\n"
 643 |         return StreamingResponse(stream_guardrail_err(), media_type="text/event-stream")
 644 | 
 645 |     # In-memory and persistent session id
 646 |     session_id = req.session_id or str(int(datetime.datetime.now().timestamp()))
 647 | 
 648 |     # 2. Rate limiting check
 649 |     if not check_rate_limit(session_id, len(req.prompt)):
 650 |         async def stream_rate_limit_err():
 651 |             yield f"event: text\ndata: {json.dumps('**Rate Limit Exceeded**: Please wait a minute before making more requests.')}\n\n"
 652 |             yield "event: done\ndata: {}\n\n"
 653 |         return StreamingResponse(stream_rate_limit_err(), media_type="text/event-stream")
 654 | 
 655 |     # 3. Semantic caching
 656 |     prompt_hash_overall = hashlib.sha256(req.prompt.encode('utf-8')).hexdigest()
 657 |     prompt_embedding = await get_embedding(req.provider, api_key, req.prompt)
 658 |     if prompt_embedding:
 659 |         all_caches = db.load_all_cached_embeddings()
 660 |         for cache in all_caches:
 661 |             sim = cosine_similarity(prompt_embedding, cache["embedding"])
 662 |             if sim > 0.95:
 663 |                 print(f"[SEMANTIC CACHE] Cache hit for overall response. Similarity: {sim:.4f}")
 664 |                 return StreamingResponse(run_cached_flow(cache["response"]), media_type="text/event-stream")
 665 | 
 666 |     # 4. Map history and call planner
 667 |     contents = []
 668 |     if req.history:
 669 |         for msg in req.history:
 670 |             role = "user" if msg.sender == "user" else "assistant"
 671 |             contents.append({
 672 |                 "role": role,
 673 |                 "content": msg.text
 674 |             })
 675 |     
 676 |     contents.append({
 677 |         "role": "user",
 678 |         "content": req.prompt
 679 |     })
 680 | 
 681 |     plan = {
 682 |         "complexity": "simple",
 683 |         "capabilities": [],
 684 |         "thinking_summary": "System defaulted to general mode.",
 685 |         "agent_talk": [{
 686 |             "senderId": "general",
 687 |             "senderName": "General Assistant",
 688 |             "senderIcon": "bot",
 689 |             "text": "Standing by to process your request.",
 690 |             "objective": "Process user requests with precise analysis.",
 691 |             "systemPrompt": "You are Solospace core.",
 692 |             "rules": ["Be descriptive"],
 693 |             "dependencies": []
 694 |         }],
 695 |         "follow_up_suggestions": ["Can you elaborate?", "Show me a detailed implementation example."]
 696 |     }
 697 | 
 698 |     try:
 699 |         plan = await call_provider_json(
 700 |             provider=req.provider,
 701 |             model=req.model,
 702 |             api_key=api_key,
 703 |             messages=contents,
 704 |             system_prompt=ORCHESTRATOR_SYSTEM_INSTRUCTION,
 705 |             temperature=0.2,
 706 |             json_schema=orchestration_schema,
 707 |             timeout=30.0
 708 |         )
 709 |     except Exception as e:
 710 |         print(f"[ORCHESTRATION WARNING] Planning failed: {str(e)}")
 711 | 
 712 |     nodes = []
 713 |     edges = []
 714 |     complexity = plan.get("complexity", "simple")
 715 |     
 716 |     # Enforce minimum agents for non-simple tasks
 717 |     if complexity != "simple" and len(plan.get("agent_talk", [])) < 2:
 718 |         print("[WARN] Too few agents for complex/medium task, adding a default assistant agent.")
 719 |         plan.setdefault("agent_talk", []).append({
 720 |             "senderId": "assistant",
 721 |             "senderName": "General Assistant",
 722 |             "senderIcon": "code",
 723 |             "text": "Supports the primary agents with general assistance.",
 724 |             "objective": "Provide supplementary help and context.",
 725 |             "systemPrompt": "You are a helpful assistant that supports other agents.",
 726 |             "rules": ["Be concise", "Do not duplicate work"],
 727 |             "dependencies": [],
 728 |             "tools": ["Web Search", "Memory"]
 729 |         })
 730 | 
 731 |     if complexity == "simple":
 732 |         nodes.append({
 733 |             "id": "general",
 734 |             "type": "custom",
 735 |             "position": {"x": 0, "y": 0},  # Bug 3: dagre handles layout, backend sends zeros
 736 |             "data": {
 737 |                 "name": "General Assistant",
 738 |                 "tag": "GENERAL_CORE",
 739 |                 "status": "ACTIVE",
 740 |                 "metricLabel": "Logic Level",
 741 |                 "metricVal": "90%",
 742 |                 "icon": "bot",
 743 |                 "objective": "Address the user request with natural, accurate, and comprehensive insights.",
 744 |                 "personality": "Helpful, expert, clear-headed",
 745 |                 "systemPrompt": "You are Solospace, an elite assistant.",
 746 |                 "rules": ["Be helpful and concise", "Use rich markdown"],
 747 |                 "tools": ["Web Search", "Memory"],
 748 |                 "temp": 0.7,
 749 |                 "logic": 90,
 750 |                 "empathy": 80,
 751 |                 "context": "128k",
 752 |                 "enabled": True,
 753 |                 "priority": 5,
 754 |                 "toolPermissions": {"Web Search": "ALLOWED", "Memory": "ALLOWED"},
 755 |                 "toolLogs": [],
 756 |                 "dependencies": []
 757 |             }
 758 |         })
 759 |     else:
 760 |         col_mapping = {
 761 |             "research": 1,
 762 |             "auth": 2,
 763 |             "database": 2,
 764 |             "frontend": 2,
 765 |             "backend": 3,
 766 |             "payments": 3
 767 |         }
 768 | 
 769 |         # Built-in templates: provide defaults but agent can override tools via agent_talk
 770 |         AGENT_TEMPLATES = {
 771 |             "research": {"name": "Market Researcher", "tag": "RESEARCH_LEAD_01", "icon": "science", "default_tools": ["Web Search"], "temp": 0.3, "logic": 85, "empathy": 40, "priority": 5, "col": 1},
 772 |             "auth": {"name": "Security Architect", "tag": "AUTH_AUDIT_02", "icon": "science", "default_tools": ["Memory"], "temp": 0.1, "logic": 99, "empathy": 10, "priority": 8, "col": 2},
 773 |             "database": {"name": "Database Admin", "tag": "DB_SCHEMA_03", "icon": "science", "default_tools": ["Memory"], "temp": 0.2, "logic": 95, "empathy": 20, "priority": 7, "col": 2},
 774 |             "frontend": {"name": "UI Specialist", "tag": "UI_DESIGN_04", "icon": "code", "default_tools": ["Browser"], "temp": 0.7, "logic": 75, "empathy": 75, "priority": 6, "col": 2},
 775 |             "backend": {"name": "API Architect", "tag": "API_ENGINE_05", "icon": "code", "default_tools": ["Code Executor"], "temp": 0.2, "logic": 92, "empathy": 25, "priority": 8, "col": 3},
 776 |             "payments": {"name": "Stripe Integrator", "tag": "STRIPE_BILL_06", "icon": "trending_up", "default_tools": ["API Connector"], "temp": 0.4, "logic": 90, "empathy": 40, "priority": 7, "col": 3}
 777 |         }
 778 | 
 779 |         active_agents = []
 780 |         seen_ids = set()
 781 |         for agent in plan.get("agent_talk", []):
 782 |             cap = agent.get("senderId", "")
 783 |             # Deduplicate by senderId — if Gemini sends duplicate, suffix with index
 784 |             unique_id = cap
 785 |             if unique_id in seen_ids:
 786 |                 unique_id = f"{cap}_{len(seen_ids)}"
 787 |             seen_ids.add(unique_id)
 788 |             if cap in AGENT_TEMPLATES:
 789 |                 active_agents.append((unique_id, agent, AGENT_TEMPLATES[cap]))
 790 |             elif cap == "other" or cap not in AGENT_TEMPLATES:
 791 |                 # Dynamic / custom agent
 792 |                 ct = agent.get("custom_template", {})
 793 |                 dynamic_tpl = {
 794 |                     "name": ct.get("name", agent.get("senderName", "Custom Agent")),
 795 |                     "tag": ct.get("tag", f"CUSTOM_{unique_id.upper()[:8]}"),
 796 |                     "icon": ct.get("icon", agent.get("senderIcon", "science")),
 797 |                     "default_tools": ["Web Search", "Memory"],
 798 |                     "temp": ct.get("temp", 0.5),
 799 |                     "logic": ct.get("logic", 80),
 800 |                     "empathy": 50,
 801 |                     "priority": 5,
 802 |                     "col": ct.get("col", 2)
 803 |                 }
 804 |                 active_agents.append((unique_id, agent, dynamic_tpl))
 805 | 
 806 |         positions = compute_agent_layout(active_agents)
 807 |         for uid, agent, tpl in active_agents:
 808 |             pos = positions[uid]
 809 |             x = pos["x"]
 810 |             y = pos["y"]
 811 | 
 812 |             # Agent-defined tools override template defaults
 813 |             agent_tools = agent.get("tools", [])
 814 |             resolved_tools = agent_tools if agent_tools else tpl["default_tools"]
 815 |             # Filter to known tool names for safety
 816 |             valid_tools = {"Web Search", "Memory", "Code Executor", "Browser", "API Connector", "Vision", "Voice", "File Upload"}
 817 |             resolved_tools = [t for t in resolved_tools if t in valid_tools] or tpl["default_tools"]
 818 | 
 819 |             default_metrics = {
 820 |                 "research": ("Sources Scanned", "24 Pages"),
 821 |                 "auth": ("Audit Score", "99%"),
 822 |                 "database": ("Schema Status", "Normalized"),
 823 |                 "frontend": ("UI Score", "95%"),
 824 |                 "backend": ("Execution Rate", "98%"),
 825 |                 "payments": ("Stripe API Status", "Online")
 826 |             }.get(agent.get("senderId", ""), ("Logic Level", "90%"))
 827 | 
 828 |             nodes.append({
 829 |                 "id": uid,
 830 |                 "type": "custom",
 831 |                 "position": {"x": 0, "y": 0},  # Bug 3: dagre handles layout, backend sends zeros
 832 |                 "data": {
 833 |                     "name": agent.get("senderName", tpl["name"]),
 834 |                     "tag": tpl["tag"],
 835 |                     "status": "IDLE",
 836 |                     "metricLabel": default_metrics[0],
 837 |                     "metricVal": default_metrics[1],
 838 |                     "icon": agent.get("senderIcon", tpl["icon"]),
 839 |                     "objective": agent.get("objective", ""),
 840 |                     "personality": "Collaborative Specialist",
 841 |                     "systemPrompt": agent.get("systemPrompt", ""),
 842 |                     "rules": agent.get("rules", []),
 843 |                     "tools": resolved_tools,
 844 |                     "temp": tpl["temp"],
 845 |                     "logic": tpl["logic"],
 846 |                     "empathy": tpl["empathy"],
 847 |                     "context": "128k",
 848 |                     "enabled": True,
 849 |                     "priority": tpl["priority"],
 850 |                     "toolPermissions": {t: "ASK" if t in ["Code Executor", "API Connector"] else "ALLOWED" for t in resolved_tools},
 851 |                     "toolLogs": [],
 852 |                     "dependencies": agent.get("dependencies", [])
 853 |                 }
 854 |             })
 855 | 
 856 |         for node in nodes:
 857 |             for dep in node["data"].get("dependencies", []):
 858 |                 edges.append({
 859 |                     "id": f"e-{dep}-{node['id']}",
 860 |                     "source": dep,
 861 |                     "target": node["id"],
 862 |                     "animated": True,
 863 |                     "type": "custom",
 864 |                     "style": {"stroke": "#60a5fa", "strokeWidth": 2}
 865 |                 })
 866 | 
 867 |     # Decide whether to run full agent flow
 868 |     if not req.execute_agents:
 869 |         # Only planning mode: save session in DB with paused state and return planning metadata
 870 |         db.save_session(
 871 |             session_id=session_id,
 872 |             title=req.prompt[:40] + "..." if len(req.prompt) > 40 else req.prompt,
 873 |             prompt=req.prompt,
 874 |             mode=complexity,
 875 |             nodes=nodes,
 876 |             edges=edges,
 877 |             chat_messages=[
 878 |                 {"id": "user-prompt", "sender": "user", "text": req.prompt, "timestamp": datetime.datetime.now().strftime("%I:%M:%S %p")}
 879 |             ],
 880 |             agent_talk_logs=[],
 881 |             execution_state="paused",
 882 |             status_message="Agent team generated. Customize and proceed.",
 883 |             follow_up_suggestions=plan.get("follow_up_suggestions", [])
 884 |         )
 885 |         
 886 |         async def planning_only_flow():
 887 |             setup_metadata = {
 888 |                 "complexity": complexity,
 889 |                 "capabilities": plan.get("capabilities", []),
 890 |                 "thinking_summary": plan.get("thinking_summary", ""),
 891 |                 "nodes": nodes,
 892 |                 "edges": edges,
 893 |                 "agent_talk": [],
 894 |                 "follow_up_suggestions": plan.get("follow_up_suggestions", [])
 895 |             }
 896 |             yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
 897 |             yield f"event: text\ndata: {json.dumps('✅ Agent team generated. Go to the **Flow** tab to customize agents and click **Proceed** to run them.')}\n\n"
 898 |             yield "event: done\ndata: {}\n\n"
 899 |             
 900 |         return StreamingResponse(planning_only_flow(), media_type="text/event-stream")
 901 |     else:
 902 |         # Existing full execution flow
 903 |         return StreamingResponse(
 904 |             run_agent_execution_loop(
 905 |                 session_id=session_id,
 906 |                 prompt=req.prompt,
 907 |                 history=req.history or [],
 908 |                 api_key=api_key,
 909 |                 nodes=nodes,
 910 |                 edges=edges,
 911 |                 complexity=complexity,
 912 |                 capabilities=plan.get("capabilities", []),
 913 |                 thinking_summary=plan.get("thinking_summary", ""),
 914 |                 follow_up_suggestions=plan.get("follow_up_suggestions", [])
 915 |             ),
 916 |             media_type="text/event-stream"
 917 |         )
 918 | 
 919 | @app.get("/providers")
 920 | async def get_providers():
 921 |     return get_available_providers()
 922 | 
 923 | # Session persistence APIs
 924 | @app.get("/sessions")
 925 | async def get_sessions():
 926 |     return db.load_sessions()
 927 | 
 928 | @app.get("/sessions/{session_id}")
 929 | async def get_session(session_id: str):
 930 |     session = db.load_session(session_id)
 931 |     if not session:
 932 |         raise HTTPException(status_code=404, detail="Session not found")
 933 |     return session
 934 | 
 935 | @app.delete("/sessions/{session_id}")
 936 | async def delete_session(session_id: str):
 937 |     db.delete_session(session_id)
 938 |     return {"status": "success"}
 939 | 
 940 | def convert_gemini_history_to_standard(history: List[Dict[str, Any]]) -> List[Dict[str, str]]:
 941 |     res = []
 942 |     for msg in history:
 943 |         parts = msg.get("parts", [])
 944 |         text = ""
 945 |         if parts:
 946 |             text = parts[0].get("text", "")
 947 |         role = "assistant" if msg.get("role") in ["model", "assistant"] else "user"
 948 |         res.append({"role": role, "content": text})
 949 |     return res
 950 | 
 951 | async def run_agent_execution_loop(
 952 |     session_id: str,
 953 |     prompt: str,
 954 |     history: List[Message],
 955 |     api_key: str,
 956 |     nodes: List[Dict[str, Any]],
 957 |     edges: List[Dict[str, Any]],
 958 |     complexity: str,
 959 |     capabilities: List[str],
 960 |     thinking_summary: str,
 961 |     follow_up_suggestions: List[str],
 962 |     provider: str = "gemini",
 963 |     model: Optional[str] = None
 964 | ):
 965 |     now_str = lambda: datetime.datetime.now().strftime("%I:%M:%S %p")
 966 |     agent_results: Dict[str, str] = {}
 967 |     setup_metadata = {
 968 |         "complexity": complexity,
 969 |         "capabilities": capabilities,
 970 |         "thinking_summary": thinking_summary,
 971 |         "nodes": nodes,
 972 |         "edges": edges,
 973 |         "agent_talk": [],
 974 |         "follow_up_suggestions": follow_up_suggestions
 975 |     }
 976 |     
 977 |     # 1. Dependency Existence Check
 978 |     all_ids = {n["id"] for n in nodes}
 979 |     for node in nodes:
 980 |         if not node.get("data", {}).get("enabled", True):
 981 |             continue
 982 |         for dep in node.get("data", {}).get("dependencies", []):
 983 |             if dep not in all_ids:
 984 |                 error_msg = f"Agent {node['id']} depends on missing agent {dep}"
 985 |                 yield f"event: text\ndata: {json.dumps('**Validation Error**: ' + error_msg)}\n\n"
 986 |                 yield "event: done\ndata: {}\n\n"
 987 |                 return
 988 | 
 989 |     # 2. Cycle Detection Check
 990 |     def has_cycle(graph, current_node, visited, rec_stack):
 991 |         visited[current_node] = True
 992 |         rec_stack[current_node] = True
 993 |         for neighbor in graph.get(current_node, []):
 994 |             if not visited.get(neighbor, False):
 995 |                 if has_cycle(graph, neighbor, visited, rec_stack):
 996 |                     return True
 997 |             elif rec_stack.get(neighbor, False):
 998 |                 return True
 999 |         rec_stack[current_node] = False
1000 |         return False
1001 | 
1002 |     graph = {node["id"]: [d for d in node.get("data", {}).get("dependencies", []) if d in all_ids] for node in nodes}
1003 |     if edges:
1004 |         for edge in edges:
1005 |             target = edge.get("target")
1006 |             source = edge.get("source")
1007 |             if target in graph and source in all_ids:
1008 |                 graph[target].append(source)
1009 | 
1010 |     visited_nodes = {node["id"]: False for node in nodes}
1011 |     for node_id in graph:
1012 |         if not visited_nodes[node_id]:
1013 |             if has_cycle(graph, node_id, visited_nodes, {}):
1014 |                 error_msg = "Circular dependency detected in agent workflow."
1015 |                 yield f"event: text\ndata: {json.dumps('**Validation Error**: ' + error_msg)}\n\n"
1016 |                 yield "event: done\ndata: {}\n\n"
1017 |                 return
1018 | 
1019 |     # Save initial session in DB
1020 |     db.save_session(
1021 |         session_id=session_id,
1022 |         title=prompt[:40] + "..." if len(prompt) > 40 else prompt,
1023 |         prompt=prompt,
1024 |         mode=complexity,
1025 |         nodes=nodes,
1026 |         edges=edges,
1027 |         chat_messages=[],
1028 |         agent_talk_logs=[],
1029 |         execution_state="running",
1030 |         status_message="Running orchestration loop",
1031 |         follow_up_suggestions=follow_up_suggestions
1032 |     )
1033 |     
1034 |     yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1035 | 
1036 |     execution_order = sort_nodes_topologically(nodes, edges)
1037 |     
1038 |     for agent_node in execution_order:
1039 |         node_id = agent_node["id"]
1040 |         agent_data = agent_node["data"]
1041 |         agent_name = agent_data["name"]
1042 |         
1043 |         if not agent_data.get("enabled", True):
1044 |             continue
1045 | 
1046 |         try:
1047 |             # Checkpoint loading
1048 |             checkpoint_state = db.load_checkpoint(session_id, node_id)
1049 |             if checkpoint_state:
1050 |                 agent_results[node_id] = checkpoint_state.get("final_answer", "Completed.")
1051 |                 setup_metadata["agent_talk"].append({
1052 |                     "id": f"agent-log-{node_id}-{now_str()}",
1053 |                     "senderId": node_id,
1054 |                     "senderName": agent_name,
1055 |                     "senderIcon": agent_data["icon"],
1056 |                     "text": checkpoint_state.get("final_answer", "Completed.")[:180],
1057 |                     "timestamp": now_str()
1058 |                 })
1059 |                 continue
1060 | 
1061 |             for n in nodes:
1062 |                 if n["id"] == node_id:
1063 |                     n["data"]["status"] = "ACTIVE"
1064 |             yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1065 |             
1066 |             yield f"event: status\ndata: {json.dumps(f'[{agent_name}] processing...')}\n\n"
1067 |             await asyncio.sleep(0.5)
1068 | 
1069 |             dep_outputs = ""
1070 |             for dep_id in agent_data.get("dependencies", []):
1071 |                 if dep_id in agent_results:
1072 |                     dep_outputs += f"### Input from {dep_id.upper()}:\n{agent_results[dep_id]}\n"
1073 | 
1074 |             memories_context = ""
1075 |             try:
1076 |                 matched_memories = await query_memory(agent_data["objective"], api_key, session_id=session_id, provider=provider)
1077 |                 if matched_memories:
1078 |                     memories_context = "### Relevant Historical Memories:\n" + "\n".join(f"- {m}" for m in matched_memories)
1079 |             except Exception:
1080 |                 pass
1081 | 
1082 |             # Get messages addressed to this agent
1083 |             incoming_msgs = get_messages_for_agent(session_id, node_id)
1084 |             msg_block = ""
1085 |             if incoming_msgs:
1086 |                 msg_block = "### Messages from other agents:\n"
1087 |                 for msg in incoming_msgs:
1088 |                     msg_block += f"- From {msg['from']}: {msg['content']}\n"
1089 |                 # Clear after reading
1090 |                 clear_messages(session_id, node_id)
1091 | 
1092 |             resolved_tools_str = ", ".join(agent_data.get("tools", []))
1093 |             tools_instruction = f"Available tools: {resolved_tools_str}. To use a tool, specify the tool name in 'action' and input in 'action_input'. If you have enough information, set 'action' to 'none' and provide 'final_answer'."
1094 | 
1095 |             agent_history = [{
1096 |                 "role": "user",
1097 |                 "parts": [{"text": f"{tools_instruction}\n\nUser Request: {prompt}\n\n{dep_outputs}\n{memories_context}\n{msg_block}\n\nYour specific objective: {agent_data['objective']}\nPersonality: {agent_data.get('personality', 'Collaborative Specialist')}\nRules: {agent_data['rules']}"}]
1098 |             }]
1099 | 
1100 |             agent_final_answer = "Sub-task completed."
1101 |             action_execution_history = []
1102 |             max_turns = 6 if complexity != "simple" else 3
1103 | 
1104 |             for turn in range(max_turns):
1105 |                 turn_data = {}
1106 |                 action = "none"
1107 |                 observation = ""
1108 |                 try:
1109 |                     standard_history = convert_gemini_history_to_standard(agent_history)
1110 |                     turn_data = await call_provider_json(
1111 |                         provider=provider,
1112 |                         model=model,
1113 |                         api_key=api_key,
1114 |                         messages=standard_history,
1115 |                         system_prompt=agent_data["systemPrompt"],
1116 |                         temperature=0.2,
1117 |                         json_schema=agent_turn_schema,
1118 |                         timeout=30.0
1119 |                     )
1120 |                     
1121 |                     thought = turn_data.get("thought", "")
1122 |                     action = turn_data.get("action", "none")
1123 |                     action_input = turn_data.get("action_input", "")
1124 |                     agent_final_answer = turn_data.get("final_answer", "")
1125 |                     
1126 |                     if thought:
1127 |                         yield f"event: thinking\ndata: {json.dumps(f'[{agent_name}]: {thought}\\n')}\n\n"
1128 |                 except Exception as e:
1129 |                     print(f"ReAct Turn fail: {e}")
1130 |                     break
1131 | 
1132 |                 if action == "none" or agent_final_answer:
1133 |                     break
1134 | 
1135 |                 # Circuit Breaker Check
1136 |                 action_execution_history.append((action, action_input))
1137 |                 if action_execution_history.count((action, action_input)) >= 3:
1138 |                     observation = "Circuit Breaker: Tool executed repeatedly with identical input. Halting loop to prevent infinite spend."
1139 |                     yield f"event: status\ndata: {json.dumps(f'[{agent_name}] circuit breaker halted')}\n\n"
1140 |                     agent_history.append({
1141 |                         "role": "model",
1142 |                         "parts": [{"text": json.dumps(turn_data)}]
1143 |                     })
1144 |                     agent_history.append({
1145 |                         "role": "user",
1146 |                         "parts": [{"text": f"Observation: {observation}"}]
1147 |                     })
1148 |                     continue
1149 | 
1150 |                 t_log_id = f"t-log-{int(datetime.datetime.now().timestamp())}"
1151 |                 t_timestamp = now_str()
1152 |                 
1153 |                 permission = agent_data.get("toolPermissions", {}).get(action, "ALLOWED")
1154 |                 
1155 |                 if permission == "ASK":
1156 |                     new_log = {
1157 |                         "id": t_log_id,
1158 |                         "timestamp": t_timestamp,
1159 |                         "tool": action,
1160 |                         "action": "Execution Request",
1161 |                         "status": "PENDING",
1162 |                         "detail": f"Waiting for user to approve execution of '{action_input[:50]}...'"
1163 |                     }
1164 |                     for n in nodes:
1165 |                         if n["id"] == node_id:
1166 |                             n["data"]["toolLogs"] = [new_log] + n["data"].get("toolLogs", [])
1167 |                     yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1168 |                     
1169 |                     db.create_tool_approval(session_id, node_id, action, action_input, t_log_id)
1170 |                     
1171 |                     yield f"event: tool_approval\ndata: {json.dumps({'sessionId': session_id, 'nodeId': node_id, 'toolName': action, 'action': 'Execution Approval Required', 'detail': action_input[:100], 'logId': t_log_id})}\n\n"
1172 |                     yield f"event: status\ndata: {json.dumps(f'[{agent_name}] waiting for approval to run [{action}]')}\n\n"
1173 | 
1174 |                     # Poll database for verdict (with 120s timeout)
1175 |                     approval_start = time.time()
1176 |                     APPROVAL_TIMEOUT = 120
1177 |                     while True:
1178 |                         approval_status = db.get_tool_approval(session_id, node_id, action, t_log_id)
1179 |                         if approval_status in ["approved", "denied"]:
1180 |                             permission = "ALLOWED" if approval_status == "approved" else "DENIED"
1181 |                             break
1182 |                         if time.time() - approval_start > APPROVAL_TIMEOUT:
1183 |                             permission = "DENIED"
1184 |                             db.update_tool_approval(session_id, node_id, action, t_log_id, "denied")
1185 |                             yield f"event: status\ndata: {json.dumps(f'[{agent_name}] approval timed out, auto-denied')}\n\n"
1186 |                             break
1187 |                         await asyncio.sleep(0.5)
1188 |                     
1189 |                     if permission == "ALLOWED":
1190 |                         for n in nodes:
1191 |                             if n["id"] == node_id:
1192 |                                 n["data"]["toolLogs"] = [{**new_log, "status": "SUCCESS", "detail": f"Approved: {action_input[:50]}"}] + n["data"].get("toolLogs", [])[1:]
1193 |                     else:
1194 |                         for n in nodes:
1195 |                             if n["id"] == node_id:
1196 |                                 n["data"]["toolLogs"] = [{**new_log, "status": "BLOCKED", "detail": "Blocked by user."}] + n["data"].get("toolLogs", [])[1:]
1197 | 
1198 |                 if permission == "ALLOWED":
1199 |                     yield f"event: status\ndata: {json.dumps(f'[{agent_name}] executing [{action}]')}\n\n"
1200 |                     
1201 |                     if action == "web_search":
1202 |                         observation = await execute_web_search(action_input)
1203 |                     elif action == "browse_web":
1204 |                         observation = await execute_web_browse(action_input)
1205 |                     elif action == "execute_code":
1206 |                         observation = await execute_python_code(action_input)
1207 |                     elif action == "api_call":
1208 |                         observation = await execute_api_call(action_input)
1209 |                     elif action == "query_memory":
1210 |                         mem_res = await query_memory(action_input, api_key, session_id=session_id, provider=provider)
1211 |                         observation = "\n".join(mem_res) if mem_res else "No matches found."
1212 |                     elif action == "store_memory":
1213 |                         await store_memory(node_id, action_input, api_key, session_id, provider=provider)
1214 |                         observation = "Saved successfully."
1215 |                     elif action == "send_message":
1216 |                         parts = action_input.split("|", 1)
1217 |                         if len(parts) == 2:
1218 |                             target_agent, content = parts
1219 |                             post_message(session_id, node_id, target_agent, content)
1220 |                             observation = f"Message sent to {target_agent}."
1221 |                         else:
1222 |                             observation = "Invalid send_message format. Use 'target|content'."
1223 |                     elif action in ["analyze_image", "read_file"]:
1224 |                         observation = f"{action} is not yet available in this deployment."
1225 |                     else:
1226 |                         observation = "Mock tool result."
1227 |                     
1228 |                     success_log = {
1229 |                         "id": t_log_id,
1230 |                         "timestamp": now_str(),
1231 |                         "tool": action,
1232 |                         "action": "Call",
1233 |                         "status": "SUCCESS",
1234 |                         "detail": f"Ran tool with inputs: '{action_input[:50]}' -> Output: {observation[:100]}..."
1235 |                     }
1236 |                     for n in nodes:
1237 |                         if n["id"] == node_id:
1238 |                             logs_filtered = [l for l in n["data"].get("toolLogs", []) if l["id"] != t_log_id]
1239 |                             n["data"]["toolLogs"] = [success_log] + logs_filtered
1240 |                 else:
1241 |                     observation = "Execution Blocked: Permission Denied."
1242 |                 
1243 |                 yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1244 |                 
1245 |                 agent_history.append({
1246 |                     "role": "model",
1247 |                     "parts": [{"text": json.dumps(turn_data)}]
1248 |                 })
1249 |                 agent_history.append({
1250 |                     "role": "user",
1251 |                     "parts": [{"text": f"Observation: {observation}"}]
1252 |                 })
1253 | 
1254 |             # Check if agent outcome is default / empty
1255 |             if not agent_final_answer or agent_final_answer.strip() in ["Sub-task completed.", ""]:
1256 |                 synthesis_prompt = f"Based on your objective '{agent_data['objective']}' and the ReAct steps executed, write a concise summary/result of your sub-task."
1257 |                 agent_history.append({"role": "user", "parts": [{"text": synthesis_prompt}]})
1258 |                 try:
1259 |                     synth_text = await call_provider(
1260 |                         provider=provider,
1261 |                         model=model,
1262 |                         api_key=api_key,
1263 |                         messages=convert_gemini_history_to_standard(agent_history),
1264 |                         system_prompt=agent_data["systemPrompt"],
1265 |                         temperature=0.3,
1266 |                         timeout=15.0
1267 |                     )
1268 |                     if synth_text:
1269 |                         agent_final_answer = synth_text
1270 |                 except Exception:
1271 |                     pass
1272 | 
1273 |             agent_results[node_id] = agent_final_answer or "Sub-task completed."
1274 |             
1275 |             # Save state checkpoint
1276 |             db.save_checkpoint(session_id, node_id, {"final_answer": agent_final_answer})
1277 |             
1278 |             for n in nodes:
1279 |                 if n["id"] == node_id:
1280 |                     n["data"]["status"] = "IDLE"
1281 |             
1282 |             setup_metadata["agent_talk"].append({
1283 |                 "id": f"agent-log-{node_id}-{now_str()}",
1284 |                 "senderId": node_id,
1285 |                 "senderName": agent_name,
1286 |                 "senderIcon": agent_data["icon"],
1287 |                 "text": agent_final_answer[:180] + "..." if len(agent_final_answer) > 180 else agent_final_answer,
1288 |                 "timestamp": now_str()
1289 |             })
1290 |             yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1291 |             
1292 |             # Only store outcome memory if meaningful
1293 |             if agent_final_answer and len(agent_final_answer) > 40 and agent_final_answer != "Sub-task completed.":
1294 |                 try:
1295 |                     memory_text = f"Objective: {agent_data['objective']}\nOutcome: {agent_final_answer[:500]}"
1296 |                     await store_memory(node_id, memory_text, api_key, session_id, provider=provider)
1297 |                 except Exception:
1298 |                     pass
1299 |         except Exception as e:
1300 |             print(f"[AGENT ERROR] {agent_name} failed: {e}")
1301 |             agent_results[node_id] = f"Agent encountered an error: {str(e)[:200]}"
1302 |             for n in nodes:
1303 |                 if n["id"] == node_id:
1304 |                     n["data"]["status"] = "ERROR"
1305 |             setup_metadata["agent_talk"].append({
1306 |                 "id": f"agent-log-{node_id}-error-{now_str()}",
1307 |                 "senderId": node_id,
1308 |                 "senderName": agent_name,
1309 |                 "senderIcon": agent_data["icon"],
1310 |                 "text": f"⚠ Failed: {str(e)[:150]}",
1311 |                 "timestamp": now_str()
1312 |             })
1313 |             yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1314 |             continue
1315 | 
1316 |     if complexity == "simple" and not agent_results:
1317 |         agent_results["general"] = "Processed the request, but no specific output was generated."
1318 | 
1319 |     yield f"event: status\ndata: {json.dumps('Synthesizing final response...')}\n\n"
1320 | 
1321 |     # Build aggregator prompt — inject relevant memory + agent results
1322 |     aggregator_prompt = ""
1323 |     try:
1324 |         memory_hits = await query_memory(prompt, api_key, top_k=3, agent_id=None, session_id=session_id, provider=provider)
1325 |         if memory_hits:
1326 |             aggregator_prompt += "### Relevant context from past conversation:\n" + "\n".join(f"- {m}" for m in memory_hits) + "\n\n"
1327 |     except Exception:
1328 |         pass
1329 | 
1330 |     if agent_results:
1331 |         aggregator_prompt += "### Analysis context:\n"
1332 |         for _nid, result in agent_results.items():
1333 |             aggregator_prompt += f"{result}\n\n"
1334 | 
1335 |     aggregator_prompt += f"\nUser's current message: {prompt}"
1336 | 
1337 |     # Fallback if aggregator prompt is empty
1338 |     if not aggregator_prompt.strip():
1339 |         aggregator_prompt = f"Answer the following user request concisely and helpfully:\n\n{prompt}"
1340 | 
1341 |     # Build full conversation history for aggregator so it has cross-turn context
1342 |     aggregator_contents = []
1343 |     if history:
1344 |         for msg in history:
1345 |             role = "user" if msg.sender == "user" else "model"
1346 |             aggregator_contents.append({"role": role, "parts": [{"text": msg.text}]})
1347 |     aggregator_contents.append({"role": "user", "parts": [{"text": aggregator_prompt}]})
1348 | 
1349 |     final_synthesis_text = ""
1350 |     try:
1351 |         async for token in stream_provider(
1352 |             provider=provider,
1353 |             model=model,
1354 |             api_key=api_key,
1355 |             messages=convert_gemini_history_to_standard(aggregator_contents),
1356 |             system_prompt=RESPONSE_SYSTEM_INSTRUCTION,
1357 |             temperature=0.7,
1358 |             timeout=90.0
1359 |         ):
1360 |             final_synthesis_text += token
1361 |             yield f"event: text\ndata: {json.dumps(token)}\n\n"
1362 |     except Exception as exc:
1363 |         err_msg = f"\n\n*Stream Synthesis Error: {str(exc)}*\n\n"
1364 |         yield f"event: text\ndata: {json.dumps(err_msg)}\n\n"
1365 |         final_synthesis_text = err_msg
1366 | 
1367 |     print(f"[DEBUG] final_synthesis_text length: {len(final_synthesis_text)}")
1368 |     if not final_synthesis_text:
1369 |         print("[ERROR] Aggregator produced empty response")
1370 | 
1371 |     # Save complete session data
1372 |     final_chat_messages = []
1373 |     if history:
1374 |         for msg in history:
1375 |             final_chat_messages.append({"id": f"msg-{id(msg)}", "sender": msg.sender, "text": msg.text, "timestamp": ""})
1376 |     final_chat_messages.append({"id": "user-prompt", "sender": "user", "text": prompt, "timestamp": now_str()})
1377 |     final_chat_messages.append({"id": "ai-response", "sender": "ai", "text": final_synthesis_text, "timestamp": now_str()})
1378 | 
1379 |     db.save_session(
1380 |         session_id=session_id,
1381 |         title=prompt[:40] + "..." if len(prompt) > 40 else prompt,
1382 |         prompt=prompt,
1383 |         mode=complexity,
1384 |         nodes=nodes,
1385 |         edges=edges,
1386 |         chat_messages=final_chat_messages,
1387 |         agent_talk_logs=setup_metadata["agent_talk"],
1388 |         execution_state="setup",
1389 |         status_message="Execution completed",
1390 |         follow_up_suggestions=follow_up_suggestions
1391 |     )
1392 | 
1393 |     # Cache final response
1394 |     cached_val = {
1395 |         "metadata": {
1396 |             "complexity": complexity,
1397 |             "capabilities": capabilities,
1398 |             "thinking_summary": thinking_summary,
1399 |             "nodes": nodes,
1400 |             "edges": edges,
1401 |             "agent_talk": setup_metadata["agent_talk"],
1402 |             "follow_up_suggestions": follow_up_suggestions
1403 |         },
1404 |         "text": final_synthesis_text
1405 |     }
1406 |     
1407 |     # Compute embeddings inside
1408 |     try:
1409 |         prompt_embedding = await get_embedding(provider, api_key, prompt)
1410 |         if prompt_embedding:
1411 |             prompt_hash_overall = hashlib.sha256(prompt.encode('utf-8')).hexdigest()
1412 |             db.save_cached_response(prompt_hash_overall, prompt, prompt_embedding, cached_val)
1413 |     except Exception:
1414 |         pass
1415 | 
1416 |     # Auto-store this full conversation turn in vector memory for cross-turn recall
1417 |     if final_synthesis_text:
1418 |         try:
1419 |             convo_memory = f"User: {prompt}\nAssistant: {final_synthesis_text[:800]}"
1420 |             await store_memory(f"session_{session_id}", convo_memory, api_key, session_id, provider=provider)
1421 |         except Exception:
1422 |             pass
1423 | 
1424 |     yield "event: done\ndata: {}\n\n"
1425 | 
1426 | @app.post("/execute_custom")
1427 | async def execute_custom(req: ExecuteCustomRequest):
1428 |     api_key = resolve_api_key(req.provider, req.api_key)
1429 |     if not api_key:
1430 |         raise HTTPException(
1431 |             status_code=400,
1432 |             detail=f"API Key for provider '{req.provider}' is missing. Please configure BYOK in Settings."
1433 |         )
1434 | 
1435 |     complexity = "simple" if len(req.nodes) == 1 and req.nodes[0]["id"] == "general" else "custom"
1436 |     capabilities = [n["data"].get("tag", "CUSTOM") for n in req.nodes]
1437 |     
1438 |     return StreamingResponse(
1439 |         run_agent_execution_loop(
1440 |             session_id=req.session_id,
1441 |             prompt=req.prompt,
1442 |             history=req.history or [],
1443 |             api_key=api_key,
1444 |             nodes=req.nodes,
1445 |             edges=req.edges,
1446 |             complexity=complexity,
1447 |             capabilities=capabilities,
1448 |             thinking_summary="Running customized agent workflow",
1449 |             follow_up_suggestions=["Can you explain the agent collaboration?"],
1450 |             provider=req.provider,
1451 |             model=req.model
1452 |         ),
1453 |         media_type="text/event-stream"
1454 |     )
1455 | 
1456 |
```

### File: `Backend/memory_store.json`

> 1 lines | 0.0 KB

```json
1 | []
```

### File: `Backend/providers.py`

> 915 lines | 34.0 KB

```python
  1 | """
  2 | Unified multi-provider AI adapter.
  3 | Supports: Gemini, OpenAI, Claude, OpenRouter, Groq, DeepSeek,
  4 |           Together AI, Mistral, Fireworks, Perplexity, Cohere, Custom.
  5 | """
  6 | 
  7 | import json
  8 | import re
  9 | import os
 10 | from typing import List, Dict, Any, Optional, AsyncGenerator
 11 | import httpx
 12 | 
 13 | # ─── Provider Registry ───────────────────────────────────────────────
 14 | 
 15 | PROVIDERS: Dict[str, Dict[str, Any]] = {
 16 |     "gemini": {
 17 |         "name": "Google Gemini",
 18 |         "description": "Multimodal AI with native JSON schema & embeddings",
 19 |         "base_url": "https://generativelanguage.googleapis.com/v1beta",
 20 |         "chat_path": None,  # Gemini uses model-specific paths
 21 |         "default_model": "gemini-2.5-flash",
 22 |         "models": [
 23 |             {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash", "tier": "fast"},
 24 |             {"id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro", "tier": "advanced"},
 25 |             {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash", "tier": "fast"},
 26 |         ],
 27 |         "capabilities": ["chat", "streaming", "json_schema", "embeddings"],
 28 |         "key_url": "https://aistudio.google.com/apikey",
 29 |         "key_hint": "AIzaSy...",
 30 |         "adapter": "gemini",
 31 |     },
 32 |     "openai": {
 33 |         "name": "OpenAI",
 34 |         "description": "GPT-4o, o3-mini, o1 reasoning models",
 35 |         "base_url": "https://api.openai.com/v1",
 36 |         "chat_path": "/chat/completions",
 37 |         "default_model": "gpt-4o",
 38 |         "models": [
 39 |             {"id": "gpt-4o", "name": "GPT-4o", "tier": "advanced"},
 40 |             {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "tier": "fast"},
 41 |             {"id": "gpt-4-turbo", "name": "GPT-4 Turbo", "tier": "advanced"},
 42 |             {"id": "o3-mini", "name": "o3-mini", "tier": "reasoning"},
 43 |             {"id": "o1", "name": "o1", "tier": "reasoning"},
 44 |         ],
 45 |         "capabilities": ["chat", "streaming", "json_mode", "embeddings"],
 46 |         "key_url": "https://platform.openai.com/api-keys",
 47 |         "key_hint": "sk-...",
 48 |         "adapter": "openai",
 49 |     },
 50 |     "claude": {
 51 |         "name": "Anthropic Claude",
 52 |         "description": "Claude Sonnet 4, Opus, Haiku family",
 53 |         "base_url": "https://api.anthropic.com/v1",
 54 |         "chat_path": "/messages",
 55 |         "default_model": "claude-3-5-sonnet-20241022",
 56 |         "models": [
 57 |             {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet", "tier": "advanced"},
 58 |             {"id": "claude-3-5-haiku-20241022", "name": "Claude 3.5 Haiku", "tier": "fast"},
 59 |             {"id": "claude-3-opus-20240229", "name": "Claude 3 Opus", "tier": "advanced"},
 60 |         ],
 61 |         "capabilities": ["chat", "streaming"],
 62 |         "key_url": "https://console.anthropic.com/settings/keys",
 63 |         "key_hint": "sk-ant-...",
 64 |         "adapter": "claude",
 65 |     },
 66 |     "openrouter": {
 67 |         "name": "OpenRouter",
 68 |         "description": "One API for 200+ models including GPT, Claude, Llama",
 69 |         "base_url": "https://openrouter.ai/api/v1",
 70 |         "chat_path": "/chat/completions",
 71 |         "default_model": "openai/gpt-4o",
 72 |         "models": [
 73 |             {"id": "openai/gpt-4o", "name": "GPT-4o", "tier": "advanced"},
 74 |             {"id": "anthropic/claude-sonnet-4", "name": "Claude Sonnet 4", "tier": "advanced"},
 75 |             {"id": "google/gemini-2.5-flash-preview", "name": "Gemini 2.5 Flash", "tier": "fast"},
 76 |             {"id": "meta-llama/llama-3.1-405b-instruct", "name": "Llama 3.1 405B", "tier": "open"},
 77 |             {"id": "deepseek/deepseek-chat", "name": "DeepSeek V3", "tier": "open"},
 78 |             {"id": "qwen/qwen-2.5-72b-instruct", "name": "Qwen 2.5 72B", "tier": "open"},
 79 |         ],
 80 |         "capabilities": ["chat", "streaming", "json_mode"],
 81 |         "key_url": "https://openrouter.ai/keys",
 82 |         "key_hint": "sk-or-...",
 83 |         "adapter": "openai",
 84 |     },
 85 |     "groq": {
 86 |         "name": "Groq",
 87 |         "description": "Ultra-fast LPU inference on open models",
 88 |         "base_url": "https://api.groq.com/openai/v1",
 89 |         "chat_path": "/chat/completions",
 90 |         "default_model": "llama-3.3-70b-versatile",
 91 |         "models": [
 92 |             {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B", "tier": "fast"},
 93 |             {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 8B Instant", "tier": "fast"},
 94 |             {"id": "mixtral-8x7b-32768", "name": "Mixtral 8x7B", "tier": "fast"},
 95 |             {"id": "gemma2-9b-it", "name": "Gemma 2 9B", "tier": "fast"},
 96 |         ],
 97 |         "capabilities": ["chat", "streaming", "json_mode"],
 98 |         "key_url": "https://console.groq.com/keys",
 99 |         "key_hint": "gsk_...",
100 |         "adapter": "openai",
101 |     },
102 |     "deepseek": {
103 |         "name": "DeepSeek",
104 |         "description": "DeepSeek V3 & R1 reasoning models",
105 |         "base_url": "https://api.deepseek.com/v1",
106 |         "chat_path": "/chat/completions",
107 |         "default_model": "deepseek-chat",
108 |         "models": [
109 |             {"id": "deepseek-chat", "name": "DeepSeek V3", "tier": "advanced"},
110 |             {"id": "deepseek-reasoner", "name": "DeepSeek R1", "tier": "reasoning"},
111 |         ],
112 |         "capabilities": ["chat", "streaming", "json_mode"],
113 |         "key_url": "https://platform.deepseek.com/api_keys",
114 |         "key_hint": "sk-...",
115 |         "adapter": "openai",
116 |     },
117 |     "together": {
118 |         "name": "Together AI",
119 |         "description": "Open-source models with fast hosted inference",
120 |         "base_url": "https://api.together.xyz/v1",
121 |         "chat_path": "/chat/completions",
122 |         "default_model": "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo",
123 |         "models": [
124 |             {"id": "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo", "name": "Llama 3.1 405B Turbo", "tier": "advanced"},
125 |             {"id": "mistralai/Mixtral-8x7B-Instruct-v0.1", "name": "Mixtral 8x7B", "tier": "fast"},
126 |             {"id": "Qwen/Qwen2.5-72B-Instruct-Turbo", "name": "Qwen 2.5 72B Turbo", "tier": "advanced"},
127 |         ],
128 |         "capabilities": ["chat", "streaming", "json_mode"],
129 |         "key_url": "https://api.together.xyz/settings/api-keys",
130 |         "key_hint": "",
131 |         "adapter": "openai",
132 |     },
133 |     "mistral": {
134 |         "name": "Mistral AI",
135 |         "description": "Mistral Large, Codestral, and more",
136 |         "base_url": "https://api.mistral.ai/v1",
137 |         "chat_path": "/chat/completions",
138 |         "default_model": "mistral-large-latest",
139 |         "models": [
140 |             {"id": "mistral-large-latest", "name": "Mistral Large", "tier": "advanced"},
141 |             {"id": "mistral-medium-latest", "name": "Mistral Medium", "tier": "fast"},
142 |             {"id": "codestral-latest", "name": "Codestral", "tier": "code"},
143 |             {"id": "open-mistral-nemo", "name": "Mistral Nemo (Free)", "tier": "fast"},
144 |         ],
145 |         "capabilities": ["chat", "streaming", "json_mode"],
146 |         "key_url": "https://console.mistral.ai/api-keys/",
147 |         "key_hint": "",
148 |         "adapter": "openai",
149 |     },
150 |     "fireworks": {
151 |         "name": "Fireworks AI",
152 |         "description": "Fast inference on popular open-source models",
153 |         "base_url": "https://api.fireworks.ai/inference/v1",
154 |         "chat_path": "/chat/completions",
155 |         "default_model": "accounts/fireworks/models/llama-v3p1-405b-instruct",
156 |         "models": [
157 |             {"id": "accounts/fireworks/models/llama-v3p1-405b-instruct", "name": "Llama 3.1 405B", "tier": "advanced"},
158 |             {"id": "accounts/fireworks/models/mixtral-8x7b-instruct", "name": "Mixtral 8x7B", "tier": "fast"},
159 |             {"id": "accounts/fireworks/models/qwen2p5-72b-instruct", "name": "Qwen 2.5 72B", "tier": "advanced"},
160 |         ],
161 |         "capabilities": ["chat", "streaming", "json_mode"],
162 |         "key_url": "https://fireworks.ai/api-keys",
163 |         "key_hint": "fw_...",
164 |         "adapter": "openai",
165 |     },
166 |     "perplexity": {
167 |         "name": "Perplexity",
168 |         "description": "Online search-augmented generation models",
169 |         "base_url": "https://api.perplexity.ai",
170 |         "chat_path": "/chat/completions",
171 |         "default_model": "sonar-pro",
172 |         "models": [
173 |             {"id": "sonar-pro", "name": "Sonar Pro", "tier": "advanced"},
174 |             {"id": "sonar", "name": "Sonar", "tier": "fast"},
175 |         ],
176 |         "capabilities": ["chat", "streaming"],
177 |         "key_url": "https://www.perplexity.ai/settings/api",
178 |         "key_hint": "pplx-...",
179 |         "adapter": "openai",
180 |     },
181 |     "cohere": {
182 |         "name": "Cohere",
183 |         "description": "Command R+ enterprise models with citations",
184 |         "base_url": "https://api.cohere.ai/v2",
185 |         "chat_path": "/chat",
186 |         "default_model": "command-r-plus",
187 |         "models": [
188 |             {"id": "command-r-plus", "name": "Command R+", "tier": "advanced"},
189 |             {"id": "command-r", "name": "Command R", "tier": "fast"},
190 |         ],
191 |         "capabilities": ["chat", "streaming"],
192 |         "key_url": "https://dashboard.cohere.com/api-keys",
193 |         "key_hint": "",
194 |         "adapter": "cohere",
195 |     },
196 |     "custom": {
197 |         "name": "Custom / Open Code",
198 |         "description": "Ollama, vLLM, LM Studio, or any OpenAI-compatible endpoint",
199 |         "base_url": "",
200 |         "chat_path": "/v1/chat/completions",
201 |         "default_model": "",
202 |         "models": [],
203 |         "capabilities": ["chat", "streaming", "json_mode"],
204 |         "key_url": "",
205 |         "key_hint": "Any key or leave empty",
206 |         "adapter": "openai",
207 |         "is_custom": True,
208 |     },
209 | }
210 | 
211 | 
212 | def get_provider_config(provider_id: str) -> Dict[str, Any]:
213 |     """Get config for a provider. Returns empty dict if not found."""
214 |     return PROVIDERS.get(provider_id.lower(), {})
215 | 
216 | 
217 | def get_available_providers() -> Dict[str, Any]:
218 |     """Return provider registry for the frontend."""
219 |     result = {}
220 |     for pid, cfg in PROVIDERS.items():
221 |         result[pid] = {
222 |             "name": cfg["name"],
223 |             "description": cfg["description"],
224 |             "models": cfg["models"],
225 |             "default_model": cfg["default_model"],
226 |             "capabilities": cfg["capabilities"],
227 |             "key_url": cfg["key_url"],
228 |             "key_hint": cfg["key_hint"],
229 |             "is_custom": cfg.get("is_custom", False),
230 |         }
231 |     return result
232 | 
233 | 
234 | def resolve_api_key(provider: str, user_key: Optional[str]) -> str:
235 |     """Resolve key from user input or fallback to environment variables."""
236 |     if user_key and user_key.strip():
237 |         return user_key.strip()
238 | 
239 |     env_keys = {
240 |         "gemini": "GEMINI_API_KEY",
241 |         "openai": "OPENAI_API_KEY",
242 |         "claude": "ANTHROPIC_API_KEY",
243 |         "openrouter": "OPENROUTER_API_KEY",
244 |         "groq": "GROQ_API_KEY",
245 |         "deepseek": "DEEPSEEK_API_KEY",
246 |         "together": "TOGETHER_API_KEY",
247 |         "mistral": "MISTRAL_API_KEY",
248 |         "fireworks": "FIREWORKS_API_KEY",
249 |         "perplexity": "PERPLEXITY_API_KEY",
250 |         "cohere": "COHERE_API_KEY",
251 |     }
252 |     env_var_name = env_keys.get(provider.lower())
253 |     if env_var_name:
254 |         val = os.environ.get(env_var_name)
255 |         if val:
256 |             return val
257 |     return ""
258 | 
259 | 
260 | def extract_json_from_text(text: str) -> Optional[Dict[str, Any]]:
261 |     """Extract and parse a JSON object from text that may contain markdown or extra content."""
262 |     # Try direct parse first
263 |     try:
264 |         return json.loads(text.strip())
265 |     except (json.JSONDecodeError, ValueError):
266 |         pass
267 | 
268 |     # Try extracting from ```json ... ``` code block
269 |     match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
270 |     if match:
271 |         try:
272 |             return json.loads(match.group(1).strip())
273 |         except (json.JSONDecodeError, ValueError):
274 |             pass
275 | 
276 |     # Try finding outermost { ... }
277 |     depth = 0
278 |     start = -1
279 |     for i, ch in enumerate(text):
280 |         if ch == "{":
281 |             if depth == 0:
282 |                 start = i
283 |             depth += 1
284 |         elif ch == "}":
285 |             depth -= 1
286 |             if depth == 0 and start >= 0:
287 |                 try:
288 |                     return json.loads(text[start:i + 1])
289 |                 except (json.JSONDecodeError, ValueError):
290 |                     break
291 | 
292 |     return None
293 | 
294 | 
295 | def _build_openai_messages(
296 |     messages: List[Dict[str, str]],
297 |     system_prompt: str,
298 |     model: str,
299 | ) -> List[Dict[str, str]]:
300 |     """Convert internal message format to OpenAI-compatible messages."""
301 |     result = []
302 |     is_reasoning = any(m in model.lower() for m in ["o1", "o3"])
303 |     if system_prompt:
304 |         result.append({
305 |             "role": "developer" if is_reasoning else "system",
306 |             "content": system_prompt,
307 |         })
308 |     for msg in messages:
309 |         result.append({
310 |             "role": msg.get("role", "user"),
311 |             "content": msg.get("content", ""),
312 |         })
313 |     return result
314 | 
315 | 
316 | def _build_gemini_contents(
317 |     messages: List[Dict[str, str]],
318 |     system_prompt: str,
319 | ) -> Dict[str, Any]:
320 |     """Convert internal message format to Gemini contents format."""
321 |     contents = []
322 |     for msg in messages:
323 |         # Map assistant role to model for Gemini
324 |         role = "model" if msg.get("role") in ["model", "assistant"] else "user"
325 |         contents.append({
326 |             "role": role,
327 |             "parts": [{"text": msg.get("content", "")}],
328 |         })
329 |     return {
330 |         "contents": contents,
331 |         "systemInstruction": {"parts": [{"text": system_prompt}]} if system_prompt else None,
332 |     }
333 | 
334 | 
335 | def _build_claude_messages(
336 |     messages: List[Dict[str, str]],
337 |     system_prompt: str,
338 | ) -> Dict[str, Any]:
339 |     """Convert internal message format to Claude format."""
340 |     claude_msgs = []
341 |     for msg in messages:
342 |         # Claude expects assistant instead of model
343 |         role = "assistant" if msg.get("role") in ["model", "assistant"] else "user"
344 |         claude_msgs.append({
345 |             "role": role,
346 |             "content": msg.get("content", ""),
347 |         })
348 |     return {
349 |         "system": system_prompt,
350 |         "messages": claude_msgs,
351 |     }
352 | 
353 | 
354 | # ─── OpenAI-Compatible Adapter ───────────────────────────────────────
355 | 
356 | async def _call_openai_compatible(
357 |     config: Dict[str, Any],
358 |     model: str,
359 |     api_key: str,
360 |     messages: List[Dict[str, str]],
361 |     system_prompt: str,
362 |     temperature: float = 0.7,
363 |     json_mode: bool = False,
364 |     json_schema_hint: str = None,
365 |     timeout: float = 30.0,
366 | ) -> str:
367 |     """Non-streaming call to any OpenAI-compatible endpoint."""
368 |     base_url = config["base_url"].rstrip("/")
369 |     chat_path = config.get("chat_path", "/chat/completions")
370 |     url = f"{base_url}{chat_path}"
371 | 
372 |     headers = {
373 |         "Content-Type": "application/json",
374 |         "Authorization": f"Bearer {api_key}",
375 |     }
376 |     if "openrouter" in base_url:
377 |         headers["HTTP-Referer"] = "https://solospace.app"
378 |         headers["X-Title"] = "Solospace"
379 | 
380 |     oa_msgs = _build_openai_messages(messages, system_prompt, model)
381 | 
382 |     payload: Dict[str, Any] = {
383 |         "model": model,
384 |         "messages": oa_msgs,
385 |         "temperature": temperature,
386 |         "max_tokens": 8192,
387 |     }
388 | 
389 |     if any(m in model.lower() for m in ["o1", "o3", "deepseek-reasoner"]):
390 |         payload.pop("temperature", None)
391 | 
392 |     if json_mode:
393 |         payload["response_format"] = {"type": "json_object"}
394 |         if json_schema_hint:
395 |             last_msg = oa_msgs[-1] if oa_msgs else {}
396 |             if last_msg.get("role") == "user":
397 |                 last_msg["content"] = f"{last_msg.get('content', '')}\n\nIMPORTANT: Respond ONLY with valid JSON matching this structure:\n{json_schema_hint}"
398 | 
399 |     async with httpx.AsyncClient() as client:
400 |         resp = await client.post(url, json=payload, headers=headers, timeout=timeout)
401 |         if resp.status_code != 200:
402 |             raise Exception(f"Provider error ({resp.status_code}): {resp.text[:500]}")
403 |         data = resp.json()
404 |         return data["choices"][0]["message"]["content"]
405 | 
406 | 
407 | async def _stream_openai_compatible(
408 |     config: Dict[str, Any],
409 |     model: str,
410 |     api_key: str,
411 |     messages: List[Dict[str, str]],
412 |     system_prompt: str,
413 |     temperature: float = 0.7,
414 |     timeout: float = 90.0,
415 | ) -> AsyncGenerator[str, None]:
416 |     """Streaming call to any OpenAI-compatible endpoint. Yields text chunks."""
417 |     base_url = config["base_url"].rstrip("/")
418 |     chat_path = config.get("chat_path", "/chat/completions")
419 |     url = f"{base_url}{chat_path}"
420 | 
421 |     headers = {
422 |         "Content-Type": "application/json",
423 |         "Authorization": f"Bearer {api_key}",
424 |     }
425 |     if "openrouter" in base_url:
426 |         headers["HTTP-Referer"] = "https://solospace.app"
427 |         headers["X-Title"] = "Solospace"
428 | 
429 |     oa_msgs = _build_openai_messages(messages, system_prompt, model)
430 | 
431 |     payload: Dict[str, Any] = {
432 |         "model": model,
433 |         "messages": oa_msgs,
434 |         "temperature": temperature,
435 |         "max_tokens": 8192,
436 |         "stream": True,
437 |     }
438 |     if any(m in model.lower() for m in ["o1", "o3", "deepseek-reasoner"]):
439 |         payload.pop("temperature", None)
440 | 
441 |     async with httpx.AsyncClient() as client:
442 |         async with client.stream("POST", url, json=payload, headers=headers, timeout=timeout) as resp:
443 |             if resp.status_code != 200:
444 |                 err_body = await resp.aread()
445 |                 raise Exception(f"Provider stream error ({resp.status_code}): {err_body.decode()[:500]}")
446 |             async for line in resp.aiter_lines():
447 |                 line = line.strip()
448 |                 if not line or not line.startswith("data:"):
449 |                     continue
450 |                 data_str = line[5:].strip()
451 |                 if data_str == "[DONE]":
452 |                     break
453 |                 try:
454 |                     obj = json.loads(data_str)
455 |                     delta = obj.get("choices", [{}])[0].get("delta", {})
456 |                     content = delta.get("content", "")
457 |                     if content:
458 |                         yield content
459 |                 except (json.JSONDecodeError, IndexError, KeyError):
460 |                     continue
461 | 
462 | 
463 | # ─── Gemini Adapter ──────────────────────────────────────────────────
464 | 
465 | GEMINI_SAFETY = [
466 |     {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
467 |     {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
468 |     {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
469 |     {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
470 | ]
471 | 
472 | 
473 | async def _call_gemini(
474 |     config: Dict[str, Any],
475 |     model: str,
476 |     api_key: str,
477 |     messages: List[Dict[str, str]],
478 |     system_prompt: str,
479 |     temperature: float = 0.7,
480 |     json_schema: Dict[str, Any] = None,
481 |     timeout: float = 30.0,
482 | ) -> str:
483 |     """Non-streaming call to Gemini API."""
484 |     base_url = config["base_url"].rstrip("/")
485 |     url = f"{base_url}/models/{model}:generateContent?key={api_key}"
486 | 
487 |     gemini_data = _build_gemini_contents(messages, system_prompt)
488 | 
489 |     payload: Dict[str, Any] = {
490 |         **gemini_data,
491 |         "generationConfig": {"temperature": temperature},
492 |         "safetySettings": GEMINI_SAFETY,
493 |     }
494 | 
495 |     if json_schema:
496 |         payload["generationConfig"]["responseMimeType"] = "application/json"
497 |         payload["generationConfig"]["responseSchema"] = json_schema
498 | 
499 |     async with httpx.AsyncClient() as client:
500 |         resp = await client.post(url, json=payload, timeout=timeout)
501 |         if resp.status_code != 200:
502 |             raise Exception(f"Gemini error ({resp.status_code}): {resp.text[:500]}")
503 |         data = resp.json()
504 |         return data["candidates"][0]["content"]["parts"][-1]["text"]
505 | 
506 | 
507 | async def _stream_gemini(
508 |     config: Dict[str, Any],
509 |     model: str,
510 |     api_key: str,
511 |     messages: List[Dict[str, str]],
512 |     system_prompt: str,
513 |     temperature: float = 0.7,
514 |     timeout: float = 90.0,
515 | ) -> AsyncGenerator[str, None]:
516 |     """Streaming call to Gemini API. Yields text chunks."""
517 |     base_url = config["base_url"].rstrip("/")
518 |     url = f"{base_url}/models/{model}:streamGenerateContent?alt=sse&key={api_key}"
519 | 
520 |     gemini_data = _build_gemini_contents(messages, system_prompt)
521 | 
522 |     payload: Dict[str, Any] = {
523 |         **gemini_data,
524 |         "generationConfig": {"temperature": temperature},
525 |         "safetySettings": GEMINI_SAFETY,
526 |     }
527 | 
528 |     async with httpx.AsyncClient() as client:
529 |         async with client.stream("POST", url, json=payload, timeout=timeout) as resp:
530 |             if resp.status_code != 200:
531 |                 err_body = await resp.aread()
532 |                 raise Exception(f"Gemini stream error ({resp.status_code}): {err_body.decode()[:500]}")
533 |             async for line in resp.aiter_lines():
534 |                 line = line.strip()
535 |                 if not line or not line.startswith("data:"):
536 |                     continue
537 |                 data_str = line[5:].strip()
538 |                 if not data_str:
539 |                     continue
540 |                 try:
541 |                     obj = json.loads(data_str)
542 |                     for cand in obj.get("candidates", []):
543 |                         for part in cand.get("content", {}).get("parts", []):
544 |                             text = part.get("text", "")
545 |                             if text:
546 |                                 yield text
547 |                 except (json.JSONDecodeError, IndexError, KeyError):
548 |                     continue
549 | 
550 | 
551 | # ─── Claude Adapter ──────────────────────────────────────────────────
552 | 
553 | async def _call_claude(
554 |     config: Dict[str, Any],
555 |     model: str,
556 |     api_key: str,
557 |     messages: List[Dict[str, str]],
558 |     system_prompt: str,
559 |     temperature: float = 0.7,
560 |     json_mode: bool = False,
561 |     json_schema_hint: str = None,
562 |     timeout: float = 30.0,
563 | ) -> str:
564 |     """Non-streaming call to Claude API."""
565 |     base_url = config["base_url"].rstrip("/")
566 |     url = f"{base_url}/messages"
567 | 
568 |     claude_data = _build_claude_messages(messages, system_prompt)
569 | 
570 |     headers = {
571 |         "Content-Type": "application/json",
572 |         "x-api-key": api_key,
573 |         "anthropic-version": "2023-06-01",
574 |     }
575 | 
576 |     payload: Dict[str, Any] = {
577 |         "model": model,
578 |         "max_tokens": 4096,
579 |         "temperature": temperature,
580 |         **claude_data,
581 |     }
582 | 
583 |     if json_mode:
584 |         json_instruction = "IMPORTANT: You MUST respond ONLY with a single valid JSON object. No markdown, no explanation, no code fences. Just raw JSON."
585 |         if json_schema_hint:
586 |             json_instruction += f"\n\nThe JSON should match this structure:\n{json_schema_hint}"
587 |         payload["system"] = f"{json_instruction}\n\n{claude_data.get('system', '')}"
588 | 
589 |     async with httpx.AsyncClient() as client:
590 |         resp = await client.post(url, json=payload, headers=headers, timeout=timeout)
591 |         if resp.status_code != 200:
592 |             raise Exception(f"Claude error ({resp.status_code}): {resp.text[:500]}")
593 |         data = resp.json()
594 |         text_parts = []
595 |         for block in data.get("content", []):
596 |             if block.get("type") == "text":
597 |                 text_parts.append(block["text"])
598 |         return "\n".join(text_parts)
599 | 
600 | 
601 | async def _stream_claude(
602 |     config: Dict[str, Any],
603 |     model: str,
604 |     api_key: str,
605 |     messages: List[Dict[str, str]],
606 |     system_prompt: str,
607 |     temperature: float = 0.7,
608 |     timeout: float = 90.0,
609 | ) -> AsyncGenerator[str, None]:
610 |     """Streaming call to Claude API. Yields text chunks."""
611 |     base_url = config["base_url"].rstrip("/")
612 |     url = f"{base_url}/messages"
613 | 
614 |     claude_data = _build_claude_messages(messages, system_prompt)
615 | 
616 |     headers = {
617 |         "Content-Type": "application/json",
618 |         "x-api-key": api_key,
619 |         "anthropic-version": "2023-06-01",
620 |     }
621 | 
622 |     payload: Dict[str, Any] = {
623 |         "model": model,
624 |         "max_tokens": 4096,
625 |         "temperature": temperature,
626 |         "stream": True,
627 |         **claude_data,
628 |     }
629 | 
630 |     async with httpx.AsyncClient() as client:
631 |         async with client.stream("POST", url, json=payload, headers=headers, timeout=timeout) as resp:
632 |             if resp.status_code != 200:
633 |                 err_body = await resp.aread()
634 |                 raise Exception(f"Claude stream error ({resp.status_code}): {err_body.decode()[:500]}")
635 |             async for line in resp.aiter_lines():
636 |                 line = line.strip()
637 |                 if not line or not line.startswith("data:"):
638 |                     continue
639 |                 data_str = line[5:].strip()
640 |                 if not data_str:
641 |                     continue
642 |                 try:
643 |                     obj = json.loads(data_str)
644 |                     event_type = obj.get("type", "")
645 |                     if event_type == "content_block_delta":
646 |                         delta = obj.get("delta", {})
647 |                         if delta.get("type") == "text_delta":
648 |                             text = delta.get("text", "")
649 |                             if text:
650 |                                 yield text
651 |                 except (json.JSONDecodeError, KeyError):
652 |                     continue
653 | 
654 | 
655 | # ─── Cohere Adapter ──────────────────────────────────────────────────
656 | 
657 | async def _call_cohere(
658 |     config: Dict[str, Any],
659 |     model: str,
660 |     api_key: str,
661 |     messages: List[Dict[str, str]],
662 |     system_prompt: str,
663 |     temperature: float = 0.7,
664 |     json_mode: bool = False,
665 |     json_schema_hint: str = None,
666 |     timeout: float = 30.0,
667 | ) -> str:
668 |     """Non-streaming call to Cohere v2 API."""
669 |     base_url = config["base_url"].rstrip("/")
670 |     url = f"{base_url}/chat"
671 | 
672 |     headers = {
673 |         "Content-Type": "application/json",
674 |         "Authorization": f"Bearer {api_key}",
675 |     }
676 | 
677 |     chat_history = []
678 |     for msg in messages[:-1]:
679 |         chat_history.append({
680 |             "role": "USER" if msg.get("role") == "user" else "CHATBOT",
681 |             "message": msg.get("content", ""),
682 |         })
683 | 
684 |     payload: Dict[str, Any] = {
685 |         "model": model,
686 |         "message": messages[-1].get("content", "") if messages else "",
687 |         "chat_history": chat_history,
688 |         "temperature": temperature,
689 |     }
690 | 
691 |     if system_prompt:
692 |         payload["preamble"] = system_prompt
693 | 
694 |     if json_mode:
695 |         json_instr = "Respond ONLY with valid JSON."
696 |         if json_schema_hint:
697 |             json_instr += f" Structure: {json_schema_hint}"
698 |         payload["message"] = f"{json_instr}\n\n{payload['message']}"
699 | 
700 |     async with httpx.AsyncClient() as client:
701 |         resp = await client.post(url, json=payload, headers=headers, timeout=timeout)
702 |         if resp.status_code != 200:
703 |             raise Exception(f"Cohere error ({resp.status_code}): {resp.text[:500]}")
704 |         data = resp.json()
705 |         return data.get("text", "")
706 | 
707 | 
708 | async def _stream_cohere(
709 |     config: Dict[str, Any],
710 |     model: str,
711 |     api_key: str,
712 |     messages: List[Dict[str, str]],
713 |     system_prompt: str,
714 |     temperature: float = 0.7,
715 |     timeout: float = 90.0,
716 | ) -> AsyncGenerator[str, None]:
717 |     """Streaming call to Cohere v2 API. Yields text chunks."""
718 |     base_url = config["base_url"].rstrip("/")
719 |     url = f"{base_url}/chat"
720 | 
721 |     headers = {
722 |         "Content-Type": "application/json",
723 |         "Authorization": f"Bearer {api_key}",
724 |     }
725 | 
726 |     chat_history = []
727 |     for msg in messages[:-1]:
728 |         chat_history.append({
729 |             "role": "USER" if msg.get("role") == "user" else "CHATBOT",
730 |             "message": msg.get("content", ""),
731 |         })
732 | 
733 |     payload: Dict[str, Any] = {
734 |         "model": model,
735 |         "message": messages[-1].get("content", "") if messages else "",
736 |         "chat_history": chat_history,
737 |         "temperature": temperature,
738 |         "stream": True,
739 |     }
740 |     if system_prompt:
741 |         payload["preamble"] = system_prompt
742 | 
743 |     async with httpx.AsyncClient() as client:
744 |         async with client.stream("POST", url, json=payload, headers=headers, timeout=timeout) as resp:
745 |             if resp.status_code != 200:
746 |                 err_body = await resp.aread()
747 |                 raise Exception(f"Cohere stream error ({resp.status_code}): {err_body.decode()[:500]}")
748 |             async for line in resp.aiter_lines():
749 |                 line = line.strip()
750 |                 if not line:
751 |                     continue
752 |                 try:
753 |                     obj = json.loads(line)
754 |                     event_type = obj.get("event_type", "")
755 |                     if event_type == "text-generation":
756 |                         text = obj.get("text", "")
757 |                         if text:
758 |                             yield text
759 |                 except (json.JSONDecodeError, KeyError):
760 |                     continue
761 | 
762 | 
763 | # ─── Unified Interface ───────────────────────────────────────────────
764 | 
765 | async def call_provider(
766 |     provider: str,
767 |     model: Optional[str],
768 |     api_key: str,
769 |     messages: List[Dict[str, str]],
770 |     system_prompt: str = "",
771 |     temperature: float = 0.7,
772 |     json_schema: Dict[str, Any] = None,
773 |     json_schema_hint: str = None,
774 |     timeout: float = 30.0,
775 | ) -> str:
776 |     """Unified call to any provider."""
777 |     config = get_provider_config(provider)
778 |     if not config:
779 |         raise Exception(f"Unknown provider: {provider}")
780 | 
781 |     resolved_model = model or config.get("default_model", "")
782 |     resolved_key = resolve_api_key(provider, api_key)
783 |     if not resolved_key:
784 |         raise Exception(f"API key missing for provider {provider}")
785 | 
786 |     adapter = config.get("adapter", "openai")
787 |     wants_json = json_schema is not None or json_schema_hint is not None
788 | 
789 |     if adapter == "gemini":
790 |         return await _call_gemini(config, resolved_model, resolved_key, messages, system_prompt,
791 |                                    temperature=temperature, json_schema=json_schema, timeout=timeout)
792 |     elif adapter == "claude":
793 |         return await _call_claude(config, resolved_model, resolved_key, messages, system_prompt,
794 |                                    temperature=temperature, json_mode=wants_json,
795 |                                    json_schema_hint=json_schema_hint, timeout=timeout)
796 |     elif adapter == "cohere":
797 |         return await _call_cohere(config, resolved_model, resolved_key, messages, system_prompt,
798 |                                    temperature=temperature, json_mode=wants_json,
799 |                                    json_schema_hint=json_schema_hint, timeout=timeout)
800 |     else:  # openai-compatible
801 |         return await _call_openai_compatible(config, resolved_model, resolved_key, messages, system_prompt,
802 |                                               temperature=temperature, json_mode=wants_json,
803 |                                               json_schema_hint=json_schema_hint, timeout=timeout)
804 | 
805 | 
806 | async def stream_provider(
807 |     provider: str,
808 |     model: Optional[str],
809 |     api_key: str,
810 |     messages: List[Dict[str, str]],
811 |     system_prompt: str = "",
812 |     temperature: float = 0.7,
813 |     timeout: float = 90.0,
814 | ) -> AsyncGenerator[str, None]:
815 |     """Unified streaming call to any provider."""
816 |     config = get_provider_config(provider)
817 |     if not config:
818 |         raise Exception(f"Unknown provider: {provider}")
819 | 
820 |     resolved_model = model or config.get("default_model", "")
821 |     resolved_key = resolve_api_key(provider, api_key)
822 |     if not resolved_key:
823 |         raise Exception(f"API key missing for provider {provider}")
824 | 
825 |     adapter = config.get("adapter", "openai")
826 | 
827 |     if adapter == "gemini":
828 |         async for chunk in _stream_gemini(config, resolved_model, resolved_key, messages, system_prompt,
829 |                                            temperature=temperature, timeout=timeout):
830 |             yield chunk
831 |     elif adapter == "claude":
832 |         async for chunk in _stream_claude(config, resolved_model, resolved_key, messages, system_prompt,
833 |                                            temperature=temperature, timeout=timeout):
834 |             yield chunk
835 |     elif adapter == "cohere":
836 |         async for chunk in _stream_cohere(config, resolved_model, resolved_key, messages, system_prompt,
837 |                                            temperature=temperature, timeout=timeout):
838 |             yield chunk
839 |     else:  # openai-compatible
840 |         async for chunk in _stream_openai_compatible(config, resolved_model, resolved_key, messages, system_prompt,
841 |                                                       temperature=temperature, timeout=timeout):
842 |             yield chunk
843 | 
844 | 
845 | async def call_provider_json(
846 |     provider: str,
847 |     model: Optional[str],
848 |     api_key: str,
849 |     messages: List[Dict[str, str]],
850 |     system_prompt: str = "",
851 |     temperature: float = 0.2,
852 |     json_schema: Dict[str, Any] = None,
853 |     timeout: float = 30.0,
854 | ) -> Dict[str, Any]:
855 |     """Unified JSON completions call."""
856 |     schema_hint = None
857 |     if json_schema:
858 |         schema_hint = json.dumps(json_schema, indent=2)
859 | 
860 |     response_text = await call_provider(
861 |         provider=provider,
862 |         model=model,
863 |         api_key=api_key,
864 |         messages=messages,
865 |         system_prompt=system_prompt,
866 |         temperature=temperature,
867 |         json_schema=json_schema,
868 |         json_schema_hint=schema_hint,
869 |         timeout=timeout
870 |     )
871 |     
872 |     parsed = extract_json_from_text(response_text)
873 |     if parsed is None:
874 |         raise ValueError(f"Failed to extract JSON from response: {response_text[:1000]}")
875 |     return parsed
876 | 
877 | 
878 | async def get_embedding(provider: str, api_key: str, text: str) -> List[float]:
879 |     """Unified embedding generator."""
880 |     resolved_key = resolve_api_key(provider, api_key)
881 |     if not resolved_key:
882 |         return []
883 | 
884 |     if provider.lower() == "gemini":
885 |         url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={resolved_key}"
886 |         payload = {
887 |             "model": "models/text-embedding-004",
888 |             "content": {"parts": [{"text": text}]}
889 |         }
890 |         async with httpx.AsyncClient() as client:
891 |             try:
892 |                 r = await client.post(url, json=payload, timeout=15.0)
893 |                 if r.status_code == 200:
894 |                     return r.json().get("embedding", {}).get("values", [])
895 |             except Exception as e:
896 |                 print(f"[EMBEDDING ERROR] Gemini embedding failed: {e}")
897 |     elif provider.lower() == "openai":
898 |         url = "https://api.openai.com/v1/embeddings"
899 |         headers = {
900 |             "Content-Type": "application/json",
901 |             "Authorization": f"Bearer {resolved_key}"
902 |         }
903 |         payload = {
904 |             "model": "text-embedding-3-small",
905 |             "input": text
906 |         }
907 |         async with httpx.AsyncClient() as client:
908 |             try:
909 |                 r = await client.post(url, json=payload, headers=headers, timeout=15.0)
910 |                 if r.status_code == 200:
911 |                     return r.json().get("data", [{}])[0].get("embedding", [])
912 |             except Exception as e:
913 |                 print(f"[EMBEDDING ERROR] OpenAI embedding failed: {e}")
914 |     return []
915 |
```

### File: `Backend/requirements.txt`

> 6 lines | 0.1 KB

```text
1 | fastapi>=0.100.0
2 | uvicorn>=0.22.0
3 | httpx>=0.24.0
4 | pydantic>=2.0
5 | beautifulsoup4>=4.12.0
6 |
```

### File: `Backend/run.bat`

> 19 lines | 0.4 KB

```text
 1 | @echo off
 2 | echo Starting Solospace Python Backend Setup...
 3 | cd /d "%~dp0"
 4 | 
 5 | if not exist venv (
 6 |     echo Creating virtual environment...
 7 |     python -m venv venv
 8 | )
 9 | 
10 | echo Activating virtual environment...
11 | call venv\Scripts\activate.bat
12 | 
13 | echo Installing dependencies...
14 | python -m pip install --upgrade pip
15 | pip install -r requirements.txt
16 | 
17 | echo Starting FastAPI server with Uvicorn...
18 | uvicorn main:app --host 127.0.0.1 --port 8000 --reload
19 |
```

### File: `Frontend/app/api/gemini/approve/route.ts`

> 25 lines | 0.8 KB

```typescript
 1 | import { NextRequest } from "next/server";
 2 | 
 3 | export async function POST(req: NextRequest) {
 4 |   try {
 5 |     const body = await req.json();
 6 | 
 7 |     const pyResponse = await fetch("http://127.0.0.1:8000/approve", {
 8 |       method: "POST",
 9 |       headers: { "Content-Type": "application/json" },
10 |       body: JSON.stringify(body),
11 |     });
12 | 
13 |     if (!pyResponse.ok) {
14 |       const errorData = await pyResponse.json().catch(() => ({ detail: `Backend error: ${pyResponse.status}` }));
15 |       return Response.json(errorData, { status: pyResponse.status });
16 |     }
17 | 
18 |     const data = await pyResponse.json();
19 |     return Response.json(data);
20 |   } catch (err: any) {
21 |     console.error("Proxy error for /approve — Python backend unreachable:", err.message);
22 |     return Response.json({ detail: "Python backend is unavailable." }, { status: 503 });
23 |   }
24 | }
25 |
```

### File: `Frontend/app/api/gemini/execute_custom/route.ts`

> 80 lines | 2.9 KB

```typescript
 1 | import { NextRequest } from "next/server";
 2 | 
 3 | export async function POST(req: NextRequest) {
 4 |   try {
 5 |     const body = await req.json();
 6 | 
 7 |     const pyResponse = await fetch("http://127.0.0.1:8000/execute_custom", {
 8 |       method: "POST",
 9 |       headers: { "Content-Type": "application/json" },
10 |       body: JSON.stringify(body),
11 |     });
12 | 
13 |     if (!pyResponse.ok) {
14 |       const errorData = await pyResponse.json().catch(() => ({ detail: `Backend error: ${pyResponse.status}` }));
15 |       
16 |       const errStream = new ReadableStream({
17 |         start(controller) {
18 |           const errMsg = `**Backend Error (${pyResponse.status})**\n\n${errorData.detail || "The Python orchestrator returned an error."}\n\n*Make sure your Gemini API key is configured correctly in Settings.*`;
19 |           const metaMsg = JSON.stringify({
20 |             complexity: "simple",
21 |             capabilities: [],
22 |             nodes: [],
23 |             edges: [],
24 |             agent_talk: []
25 |           });
26 |           controller.enqueue(new TextEncoder().encode(`event: metadata\ndata: ${metaMsg}\n\n`));
27 |           controller.enqueue(new TextEncoder().encode(`event: text\ndata: ${JSON.stringify(errMsg)}\n\n`));
28 |           controller.enqueue(new TextEncoder().encode(`event: done\ndata: {}\n\n`));
29 |           controller.close();
30 |         }
31 |       });
32 |       
33 |       return new Response(errStream, {
34 |         headers: {
35 |           "Content-Type": "text/event-stream",
36 |           "Cache-Control": "no-cache, no-transform",
37 |           "Connection": "keep-alive",
38 |         },
39 |       });
40 |     }
41 | 
42 |     // Proxy the Python backend's readable stream directly
43 |     return new Response(pyResponse.body, {
44 |       headers: {
45 |         "Content-Type": "text/event-stream",
46 |         "Cache-Control": "no-cache, no-transform",
47 |         "Connection": "keep-alive",
48 |       },
49 |     });
50 | 
51 |   } catch (err: any) {
52 |     console.error("Proxy error — Python backend unreachable:", err.message);
53 |     
54 |     const errStream = new ReadableStream({
55 |       start(controller) {
56 |         const errMsg = "**Python backend is unavailable.**\n\nPlease ensure the backend server is running:\n\n```bash\ncd Backend\npython -m uvicorn main:app --reload\n```\n\nAlso verify your Gemini API key is set in Settings (key icon in the header).";
57 |         const metaMsg = JSON.stringify({
58 |           complexity: "simple",
59 |           capabilities: [],
60 |           nodes: [],
61 |           edges: [],
62 |           agent_talk: []
63 |         });
64 |         controller.enqueue(new TextEncoder().encode(`event: metadata\ndata: ${metaMsg}\n\n`));
65 |         controller.enqueue(new TextEncoder().encode(`event: text\ndata: ${JSON.stringify(errMsg)}\n\n`));
66 |         controller.enqueue(new TextEncoder().encode(`event: done\ndata: {}\n\n`));
67 |         controller.close();
68 |       }
69 |     });
70 |     
71 |     return new Response(errStream, {
72 |       headers: {
73 |         "Content-Type": "text/event-stream",
74 |         "Cache-Control": "no-cache, no-transform",
75 |         "Connection": "keep-alive",
76 |       },
77 |     });
78 |   }
79 | }
80 |
```

### File: `Frontend/app/api/gemini/orchestrate/route.ts`

> 80 lines | 2.9 KB

```typescript
 1 | import { NextRequest } from "next/server";
 2 | 
 3 | export async function POST(req: NextRequest) {
 4 |   try {
 5 |     const body = await req.json();
 6 | 
 7 |     const pyResponse = await fetch("http://127.0.0.1:8000/orchestrate", {
 8 |       method: "POST",
 9 |       headers: { "Content-Type": "application/json" },
10 |       body: JSON.stringify(body),
11 |     });
12 | 
13 |     if (!pyResponse.ok) {
14 |       const errorData = await pyResponse.json().catch(() => ({ detail: `Backend error: ${pyResponse.status}` }));
15 |       
16 |       const errStream = new ReadableStream({
17 |         start(controller) {
18 |           const errMsg = `**Backend Error (${pyResponse.status})**\n\n${errorData.detail || "The Python orchestrator returned an error."}\n\n*Make sure your Gemini API key is configured correctly in Settings.*`;
19 |           const metaMsg = JSON.stringify({
20 |             complexity: "simple",
21 |             capabilities: [],
22 |             nodes: [],
23 |             edges: [],
24 |             agent_talk: []
25 |           });
26 |           controller.enqueue(new TextEncoder().encode(`event: metadata\ndata: ${metaMsg}\n\n`));
27 |           controller.enqueue(new TextEncoder().encode(`event: text\ndata: ${JSON.stringify(errMsg)}\n\n`));
28 |           controller.enqueue(new TextEncoder().encode(`event: done\ndata: {}\n\n`));
29 |           controller.close();
30 |         }
31 |       });
32 |       
33 |       return new Response(errStream, {
34 |         headers: {
35 |           "Content-Type": "text/event-stream",
36 |           "Cache-Control": "no-cache, no-transform",
37 |           "Connection": "keep-alive",
38 |         },
39 |       });
40 |     }
41 | 
42 |     // Proxy the Python backend's readable stream directly
43 |     return new Response(pyResponse.body, {
44 |       headers: {
45 |         "Content-Type": "text/event-stream",
46 |         "Cache-Control": "no-cache, no-transform",
47 |         "Connection": "keep-alive",
48 |       },
49 |     });
50 | 
51 |   } catch (err: any) {
52 |     console.error("Proxy error — Python backend unreachable:", err.message);
53 |     
54 |     const errStream = new ReadableStream({
55 |       start(controller) {
56 |         const errMsg = "**Python backend is unavailable.**\n\nPlease ensure the backend server is running:\n\n```bash\ncd Backend\npython -m uvicorn main:app --reload\n```\n\nAlso verify your Gemini API key is set in Settings (key icon in the header).";
57 |         const metaMsg = JSON.stringify({
58 |           complexity: "simple",
59 |           capabilities: [],
60 |           nodes: [],
61 |           edges: [],
62 |           agent_talk: []
63 |         });
64 |         controller.enqueue(new TextEncoder().encode(`event: metadata\ndata: ${metaMsg}\n\n`));
65 |         controller.enqueue(new TextEncoder().encode(`event: text\ndata: ${JSON.stringify(errMsg)}\n\n`));
66 |         controller.enqueue(new TextEncoder().encode(`event: done\ndata: {}\n\n`));
67 |         controller.close();
68 |       }
69 |     });
70 |     
71 |     return new Response(errStream, {
72 |       headers: {
73 |         "Content-Type": "text/event-stream",
74 |         "Cache-Control": "no-cache, no-transform",
75 |         "Connection": "keep-alive",
76 |       },
77 |     });
78 |   }
79 | }
80 |
```

### File: `Frontend/app/api/gemini/providers/route.ts`

> 26 lines | 0.6 KB

```typescript
 1 | import { NextResponse } from "next/server";
 2 | 
 3 | export async function GET() {
 4 |   try {
 5 |     const pyResponse = await fetch("http://127.0.0.1:8000/providers", {
 6 |       method: "GET",
 7 |     });
 8 | 
 9 |     if (!pyResponse.ok) {
10 |       return NextResponse.json(
11 |         { error: `Backend error: ${pyResponse.status}` },
12 |         { status: pyResponse.status }
13 |       );
14 |     }
15 | 
16 |     const data = await pyResponse.json();
17 |     return NextResponse.json(data);
18 |   } catch (err: any) {
19 |     console.error("Proxy error — Python backend unreachable:", err.message);
20 |     return NextResponse.json(
21 |       { error: "Python backend is unavailable" },
22 |       { status: 503 }
23 |     );
24 |   }
25 | }
26 |
```

### File: `Frontend/app/api/gemini/sessions/route.ts`

> 47 lines | 1.7 KB

```typescript
 1 | import { NextRequest } from "next/server";
 2 | 
 3 | export async function GET(req: NextRequest) {
 4 |   try {
 5 |     const { searchParams } = new URL(req.url);
 6 |     const id = searchParams.get("id");
 7 |     
 8 |     const url = id ? `http://127.0.0.1:8000/sessions/${id}` : "http://127.0.0.1:8000/sessions";
 9 |     const pyResponse = await fetch(url, { method: "GET" });
10 | 
11 |     if (!pyResponse.ok) {
12 |       const errorData = await pyResponse.json().catch(() => ({ detail: `Backend error: ${pyResponse.status}` }));
13 |       return Response.json(errorData, { status: pyResponse.status });
14 |     }
15 | 
16 |     const data = await pyResponse.json();
17 |     return Response.json(data);
18 |   } catch (err: any) {
19 |     console.error("Proxy error for GET /sessions — Python backend unreachable:", err.message);
20 |     return Response.json({ detail: "Python backend is unavailable." }, { status: 503 });
21 |   }
22 | }
23 | 
24 | export async function DELETE(req: NextRequest) {
25 |   try {
26 |     const { searchParams } = new URL(req.url);
27 |     const id = searchParams.get("id");
28 | 
29 |     if (!id) {
30 |       return Response.json({ detail: "Missing session id parameter" }, { status: 400 });
31 |     }
32 | 
33 |     const pyResponse = await fetch(`http://127.0.0.1:8000/sessions/${id}`, { method: "DELETE" });
34 | 
35 |     if (!pyResponse.ok) {
36 |       const errorData = await pyResponse.json().catch(() => ({ detail: `Backend error: ${pyResponse.status}` }));
37 |       return Response.json(errorData, { status: pyResponse.status });
38 |     }
39 | 
40 |     const data = await pyResponse.json();
41 |     return Response.json(data);
42 |   } catch (err: any) {
43 |     console.error("Proxy error for DELETE /sessions — Python backend unreachable:", err.message);
44 |     return Response.json({ detail: "Python backend is unavailable." }, { status: 503 });
45 |   }
46 | }
47 |
```

### File: `Frontend/app/globals.css`

> 207 lines | 5.0 KB

```css
  1 | @import "tailwindcss";
  2 | @import "tw-animate-css";
  3 | @import "@xyflow/react/dist/style.css";
  4 | 
  5 | /* React Flow styling overrides */
  6 | .react-flow__minimap {
  7 |   background-color: rgba(13, 13, 13, 0.8) !important;
  8 |   backdrop-filter: blur(8px);
  9 |   border: 1px solid rgba(255, 255, 255, 0.08) !important;
 10 |   border-radius: 12px;
 11 | }
 12 | 
 13 | .react-flow__minimap-mask {
 14 |   fill: rgba(0, 0, 0, 0.6) !important;
 15 | }
 16 | 
 17 | .react-flow__controls {
 18 |   background: rgba(13, 13, 13, 0.8) !important;
 19 |   backdrop-filter: blur(8px);
 20 |   border: 1px solid rgba(255, 255, 255, 0.08) !important;
 21 |   border-radius: 8px;
 22 |   overflow: hidden;
 23 |   box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
 24 | }
 25 | 
 26 | .react-flow__controls-button {
 27 |   background: transparent !important;
 28 |   border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
 29 |   color: #a3a3a3 !important;
 30 |   fill: currentColor !important;
 31 |   transition: all 0.15s !important;
 32 | }
 33 | 
 34 | .react-flow__controls-button:hover {
 35 |   background: rgba(255, 255, 255, 0.05) !important;
 36 |   color: #ffffff !important;
 37 | }
 38 | 
 39 | .react-flow__handle {
 40 |   width: 10px !important;
 41 |   height: 10px !important;
 42 |   background: #000000 !important;
 43 |   border: 2px solid #06b6d4 !important;
 44 |   box-shadow: 0 0 8px #06b6d4 !important;
 45 |   transition: all 0.2s;
 46 | }
 47 | 
 48 | .react-flow__handle:hover {
 49 |   transform: scale(1.25);
 50 |   background: #06b6d4 !important;
 51 | }
 52 | 
 53 | .react-flow__edge-path {
 54 |   stroke-dasharray: 5, 5;
 55 |   animation: dash 2.5s linear infinite;
 56 | }
 57 | 
 58 | .react-flow__edge.selected .react-flow__edge-path {
 59 |   stroke: #ffffff !important;
 60 |   stroke-width: 3px !important;
 61 |   filter: drop-shadow(0 0 4px rgba(255,255,255,0.5));
 62 | }
 63 | 
 64 | /* Core design tokens */
 65 | :root {
 66 |   background-color: #000000;
 67 |   color: #ffffff;
 68 | }
 69 | 
 70 | body {
 71 |   background-color: #000000;
 72 |   color: #f5f5f5;
 73 |   font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
 74 |   overflow: hidden;
 75 | }
 76 | 
 77 | /* Custom styles and micro-interactions */
 78 | .canvas-grid {
 79 |   background-image: radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px);
 80 |   background-size: 24px 24px;
 81 |   background-color: #000000;
 82 | }
 83 | 
 84 | .glass-panel {
 85 |   background-color: rgba(13, 13, 13, 0.7);
 86 |   backdrop-filter: blur(12px);
 87 |   border: 1px solid rgba(255, 255, 255, 0.07);
 88 | }
 89 | 
 90 | .glass-panel-active {
 91 |   background-color: rgba(20, 20, 20, 0.85);
 92 |   backdrop-filter: blur(16px);
 93 |   border: 1px solid rgba(255, 255, 255, 0.15);
 94 |   box-shadow: 0 0 25px rgba(255, 255, 255, 0.03);
 95 | }
 96 | 
 97 | .chatgpt-input-box {
 98 |   background-color: #0d0d0d;
 99 |   border: 1px solid rgba(255, 255, 255, 0.08);
100 |   box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
101 |   transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
102 | }
103 | 
104 | .chatgpt-input-box:focus-within {
105 |   border-color: rgba(255, 255, 255, 0.2);
106 |   box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2), 0 8px 32px rgba(0, 0, 0, 0.7);
107 | }
108 | 
109 | .agent-node-card {
110 |   transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s, box-shadow 0.2s;
111 | }
112 | 
113 | .agent-node-card:hover {
114 |   border-color: rgba(255, 255, 255, 0.25);
115 |   box-shadow: 0 8px 30px rgba(0, 0, 0, 0.8), 0 0 15px rgba(255, 255, 255, 0.03);
116 | }
117 | 
118 | /* Pulsing neon state colors for agent nodes */
119 | .node-active-pulse {
120 |   position: relative;
121 | }
122 | 
123 | .node-active-pulse::after {
124 |   content: '';
125 |   position: absolute;
126 |   inset: -1px;
127 |   border-radius: inherit;
128 |   padding: 1px;
129 |   background: linear-gradient(135deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.05));
130 |   mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
131 |   -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
132 |   mask-composite: xor;
133 |   -webkit-mask-composite: xor;
134 |   pointer-events: none;
135 |   animation: border-pulse 2s infinite ease-in-out;
136 | }
137 | 
138 | @keyframes border-pulse {
139 |   0%, 100% { opacity: 0.3; }
140 |   50% { opacity: 1; }
141 | }
142 | 
143 | /* Cursor blink for streaming reasoning */
144 | .cursor-blink {
145 |   animation: blink step-end 0.8s infinite;
146 | }
147 | 
148 | @keyframes blink {
149 |   from, to { background-color: transparent }
150 |   50% { background-color: currentColor }
151 | }
152 | 
153 | /* Custom subtle scrollbars */
154 | .custom-scrollbar::-webkit-scrollbar {
155 |   width: 5px;
156 |   height: 5px;
157 | }
158 | 
159 | .custom-scrollbar::-webkit-scrollbar-track {
160 |   background: #000000;
161 | }
162 | 
163 | .custom-scrollbar::-webkit-scrollbar-thumb {
164 |   background: rgba(255, 255, 255, 0.1);
165 |   border-radius: 99px;
166 | }
167 | 
168 | .custom-scrollbar::-webkit-scrollbar-thumb:hover {
169 |   background: rgba(255, 255, 255, 0.2);
170 | }
171 | 
172 | /* Animated connection dash array */
173 | @keyframes dash {
174 |   to {
175 |     stroke-dashoffset: -40;
176 |   }
177 | }
178 | 
179 | .connection-line {
180 |   animation: dash 2.5s linear infinite;
181 | }
182 | 
183 | /* ─── In-progress connection wire (while dragging between handles) ─── */
184 | .react-flow__connection-line {
185 |   stroke: #06b6d4 !important;
186 |   stroke-width: 2 !important;
187 |   stroke-dasharray: 8, 4;
188 |   animation: dash 0.8s linear infinite;
189 | }
190 | 
191 | .react-flow__connection-path {
192 |   stroke: #06b6d4 !important;
193 |   stroke-width: 2 !important;
194 |   stroke-dasharray: 8, 4;
195 |   animation: dash 0.8s linear infinite;
196 | }
197 | 
198 | /* Override default handle cyan to use per-handle colors set in component */
199 | .react-flow__handle-connecting {
200 |   transform: scale(1.5) !important;
201 | }
202 | 
203 | .react-flow__handle-valid {
204 |   transform: scale(1.6) !important;
205 |   box-shadow: 0 0 14px rgba(6, 182, 212, 0.9) !important;
206 | }
207 |
```

### File: `Frontend/app/layout.tsx`

> 30 lines | 0.8 KB

```tsx
 1 | import type {Metadata} from 'next';
 2 | import './globals.css'; // Global styles
 3 | import { Inter, JetBrains_Mono } from 'next/font/google';
 4 | 
 5 | const inter = Inter({
 6 |   subsets: ['latin'],
 7 |   variable: '--font-sans',
 8 | });
 9 | 
10 | const jetbrainsMono = JetBrains_Mono({
11 |   subsets: ['latin'],
12 |   variable: '--font-mono',
13 | });
14 | 
15 | export const metadata: Metadata = {
16 |   title: 'Solospace - Multi-Agent Orchestration AI OS',
17 |   description: 'An advanced agent orchestration workspace featuring rich conversation steering and active node clustering.',
18 | };
19 | 
20 | export default function RootLayout({children}: {children: React.ReactNode}) {
21 |   return (
22 |     <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} dark`}>
23 |       <body className="font-sans antialiased bg-black text-[#e5e2e1]" suppressHydrationWarning>
24 |         {children}
25 |       </body>
26 |     </html>
27 |   );
28 | }
29 | 
30 |
```

### File: `Frontend/app/page.tsx`

> 1596 lines | 82.1 KB

```tsx
   1 | 'use client';
   2 | 
   3 | import React, { useState, useEffect, useRef } from "react";
   4 | import {
   5 |   Bot,
   6 |   Zap,
   7 |   SquarePlus,
   8 |   Key,
   9 |   History,
  10 |   Settings,
  11 |   User,
  12 |   ChevronRight,
  13 |   ChevronLeft,
  14 |   HelpCircle,
  15 |   UploadCloud,
  16 |   Eye,
  17 |   Mic,
  18 |   GitFork,
  19 |   ArrowRight,
  20 |   Database,
  21 |   Sliders,
  22 |   X,
  23 |   Trash2,
  24 |   Globe,
  25 |   Terminal,
  26 |   Sparkles,
  27 |   Copy,
  28 |   Check,
  29 |   Square
  30 | } from "lucide-react";
  31 | import { motion, AnimatePresence } from "motion/react";
  32 | import { ReactFlowProvider } from '@xyflow/react';
  33 | import { useWorkflowStore, ChatSession, ChatMessage, AgentTalkLog } from "@/store/workflowStore";
  34 | import FlowArena from "@/components/FlowArena";
  35 | import MarkdownRenderer from "@/components/MarkdownRenderer";
  36 | 
  37 | export default function SolospaceApp() {
  38 |   return (
  39 |     <ReactFlowProvider>
  40 |       <SolospaceContent />
  41 |     </ReactFlowProvider>
  42 |   );
  43 | }
  44 | 
  45 | function SolospaceContent() {
  46 |   // Store bindings
  47 |   const sessions = useWorkflowStore((s) => s.sessions);
  48 |   const activeSessionId = useWorkflowStore((s) => s.activeSessionId);
  49 |   const nodes = useWorkflowStore((s) => s.nodes);
  50 |   const edges = useWorkflowStore((s) => s.edges);
  51 |   const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  52 |   const executionState = useWorkflowStore((s) => s.executionState);
  53 |   const isOrchestrating = useWorkflowStore((s) => s.isOrchestrating);
  54 |   const isThinking = useWorkflowStore((s) => s.isThinking);
  55 |   const statusMessage = useWorkflowStore((s) => s.statusMessage);
  56 |   const chatMessages = useWorkflowStore((s) => s.chatMessages);
  57 |   const agentTalkLogs = useWorkflowStore((s) => s.agentTalkLogs);
  58 |   const pendingApproval = useWorkflowStore((s) => s.pendingApproval);
  59 | 
  60 |   const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
  61 |   const setNodes = useWorkflowStore((s) => s.setNodes);
  62 |   const setEdges = useWorkflowStore((s) => s.setEdges);
  63 |   const setExecutionState = useWorkflowStore((s) => s.setExecutionState);
  64 |   const updateNodeField = useWorkflowStore((s) => s.updateNodeField);
  65 |   const addRule = useWorkflowStore((s) => s.addRule);
  66 |   const deleteRule = useWorkflowStore((s) => s.deleteRule);
  67 |   const deleteEdge = useWorkflowStore((s) => s.deleteEdge);
  68 |   const liveThoughts = useWorkflowStore((s) => s.liveThoughts);
  69 |   const setApiKey = useWorkflowStore((s) => s.setApiKey);
  70 |   const apiKey = useWorkflowStore((s) => s.apiKey);
  71 |   const provider = useWorkflowStore((s) => s.provider);
  72 |   const model = useWorkflowStore((s) => s.model);
  73 |   const apiKeys = useWorkflowStore((s) => s.apiKeys);
  74 |   const availableProviders = useWorkflowStore((s) => s.availableProviders);
  75 |   const setProvider = useWorkflowStore((s) => s.setProvider);
  76 |   const setModel = useWorkflowStore((s) => s.setModel);
  77 |   const setProviderApiKey = useWorkflowStore((s) => s.setProviderApiKey);
  78 |   const fetchAvailableProviders = useWorkflowStore((s) => s.fetchAvailableProviders);
  79 | 
  80 |   const triggerSteerOrchestration = useWorkflowStore((s) => s.triggerSteerOrchestration);
  81 |   const setChatMessages = useWorkflowStore((s) => s.setChatMessages);
  82 |   const createSession = useWorkflowStore((s) => s.createSession);
  83 |   const switchSession = useWorkflowStore((s) => s.switchSession);
  84 |   const cancelOrchestration = useWorkflowStore((s) => s.cancelOrchestration);
  85 |   const followUpSuggestions = useWorkflowStore((s) => s.followUpSuggestions);
  86 |   const fetchSessions = useWorkflowStore((s) => s.fetchSessions);
  87 |   const loadSessionFromDb = useWorkflowStore((s) => s.loadSessionFromDb);
  88 |   const deleteSessionFromDb = useWorkflowStore((s) => s.deleteSessionFromDb);
  89 | 
  90 |   const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  91 |   const copyToClipboard = (text: string, msgId: string) => {
  92 |     navigator.clipboard.writeText(text);
  93 |     setCopiedMsgId(msgId);
  94 |     setTimeout(() => setCopiedMsgId(null), 2000);
  95 |   };
  96 | 
  97 |   const chatContainerRef = useRef<HTMLDivElement>(null);
  98 |   const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  99 | 
 100 |   const handleScroll = () => {
 101 |     const container = chatContainerRef.current;
 102 |     if (!container) return;
 103 |     const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
 104 |     setShouldAutoScroll(isAtBottom);
 105 |   };
 106 | 
 107 |   const textareaRef = useRef<HTMLTextAreaElement>(null);
 108 |   const adjustTextareaHeight = () => {
 109 |     const tx = textareaRef.current;
 110 |     if (tx) {
 111 |       tx.style.height = "auto";
 112 |       tx.style.height = `${Math.min(tx.scrollHeight, 200)}px`;
 113 |     }
 114 |   };
 115 | 
 116 |   // Screen and Tab States
 117 |   const [workspaceState, setWorkspaceState] = useState<"home" | "active">("home");
 118 |   const [currentTab, setCurrentTab] = useState<"chat" | "arena">("chat");
 119 |   const [isAutoMode, setIsAutoMode] = useState<boolean>(true);
 120 |   const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(true);
 121 |   const [isLoadingSession, setIsLoadingSession] = useState<boolean>(false);
 122 | 
 123 |   // Input fields
 124 |   const [userQuery, setUserQuery] = useState<string>("");
 125 |   const activeSession = activeSessionId ? sessions[activeSessionId] : null;
 126 |   const activePrompt = activeSession ? activeSession.prompt : "";
 127 | 
 128 |   useEffect(() => {
 129 |     adjustTextareaHeight();
 130 |   }, [userQuery]);
 131 | 
 132 |   // API key — read directly from Zustand (not local state, to avoid disconnect)
 133 |   const [isSecretOpen, setIsSecretOpen] = useState<boolean>(false);
 134 |   const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
 135 | 
 136 |   // Tooltip helper state for collapsed sidebar
 137 |   const [hoveredSidebarItem, setHoveredSidebarItem] = useState<string | null>(null);
 138 | 
 139 |   // Node Configuration Panel
 140 |   const [isConfigPanelOpen, setIsConfigPanelOpen] = useState<boolean>(false);
 141 |   const [newRuleText, setNewRuleText] = useState<string>("");
 142 | 
 143 |   // Chat scroll ref
 144 |   const chatEndRef = useRef<HTMLDivElement>(null);
 145 | 
 146 |   // List of available tools in the Arena tool panel
 147 |   const toolsList = [
 148 |     { name: "Web Search", icon: <Globe className="w-4 h-4" />, desc: "Real-time Google search indices" },
 149 |     { name: "Memory", icon: <Database className="w-4 h-4" />, desc: "Persistent memory vector vault" },
 150 |     { name: "Browser", icon: <Eye className="w-4 h-4" />, desc: "Headless browser sandbox access" },
 151 |     { name: "File Upload", icon: <UploadCloud className="w-4 h-4" />, desc: "Parsing spreadsheet/code datasets" },
 152 |     { name: "Vision", icon: <Eye className="w-4 h-4" />, desc: "Image recognition & layout review" },
 153 |     { name: "Voice", icon: <Mic className="w-4 h-4" />, desc: "Acoustic synthesis & recognition" },
 154 |     { name: "Code Executor", icon: <Terminal className="w-4 h-4" />, desc: "Sandboxed node/python runs" },
 155 |     { name: "API Connector", icon: <GitFork className="w-4 h-4" />, desc: "Synchronize external webhooks" }
 156 |   ];
 157 | 
 158 |   // Sync config panel with selectedNodeId
 159 |   useEffect(() => {
 160 |     if (selectedNodeId) {
 161 |       setIsConfigPanelOpen(true);
 162 |     } else {
 163 |       setIsConfigPanelOpen(false);
 164 |     }
 165 |   }, [selectedNodeId]);
 166 | 
 167 |   // Synchronize modal's local display state when it opens
 168 |   const [apiKeyInput, setApiKeyInput] = useState<string>("");
 169 |   const [selectedProvider, setSelectedProvider] = useState<string>("gemini");
 170 |   const [selectedModel, setSelectedModel] = useState<string>("");
 171 | 
 172 |   useEffect(() => {
 173 |     if (isSecretOpen) {
 174 |       setSelectedProvider(provider);
 175 |       setSelectedModel(model);
 176 |       setApiKeyInput(apiKeys[provider] || apiKey || "");
 177 |     }
 178 |   }, [isSecretOpen, provider, model, apiKeys, apiKey]);
 179 | 
 180 |   // When selectedProvider changes, set selectedModel to its default model, and load key
 181 |   useEffect(() => {
 182 |     if (isSecretOpen && availableProviders[selectedProvider]) {
 183 |       const pConfig = availableProviders[selectedProvider];
 184 |       const modelExists = pConfig.models?.some((m: any) => m.id === selectedModel);
 185 |       if (!modelExists) {
 186 |         setSelectedModel(pConfig.default_model);
 187 |       }
 188 |       setApiKeyInput(apiKeys[selectedProvider] || "");
 189 |     }
 190 |   }, [selectedProvider, availableProviders]);
 191 | 
 192 |   // Scroll helper
 193 |   const scrollToBottom = () => {
 194 |     if (shouldAutoScroll) {
 195 |       chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
 196 |     }
 197 |   };
 198 | 
 199 |   // Auto-scroll chat to bottom if enabled
 200 |   useEffect(() => {
 201 |     scrollToBottom();
 202 |   }, [chatMessages, isThinking, shouldAutoScroll]);
 203 | 
 204 |   // Auto-scroll when chat tab becomes active
 205 |   useEffect(() => {
 206 |     if (workspaceState === "active" && currentTab === "chat") {
 207 |       scrollToBottom();
 208 |     }
 209 |   }, [currentTab, workspaceState]);
 210 | 
 211 |   // Reset to home when active session is deleted
 212 |   useEffect(() => {
 213 |     if (workspaceState === "active" && activeSessionId === null) {
 214 |       setWorkspaceState("home");
 215 |       setCurrentTab("chat");
 216 |       setUserQuery("");
 217 |     }
 218 |   }, [activeSessionId, workspaceState]);
 219 | 
 220 |   // Load sessions and available providers from DB on mount
 221 |   useEffect(() => {
 222 |     fetchSessions().catch(e => console.error("Failed to load sessions:", e));
 223 |     fetchAvailableProviders().catch(e => console.error("Failed to load providers:", e));
 224 |   }, []);
 225 | 
 226 |   const handleCloseConfigPanel = () => {
 227 |     setIsConfigPanelOpen(false);
 228 |     setSelectedNodeId(null);
 229 |   };
 230 | 
 231 |   // Orchestrator — always stays in chat first
 232 |   const startOrchestration = (promptText: string) => {
 233 |     if (!promptText.trim()) return;
 234 |     setWorkspaceState("active");
 235 |     setCurrentTab("chat"); // ALWAYS stay in chat
 236 | 
 237 |     let sessionId = activeSessionId;
 238 |     if (!sessionId) {
 239 |       sessionId = createSession(promptText, isAutoMode ? "auto" : "custom");
 240 |     }
 241 | 
 242 |     setExecutionState("running");
 243 |     triggerSteerOrchestration(promptText, isAutoMode);
 244 |     setUserQuery("");
 245 |   };
 246 | 
 247 |   // Node editing actions
 248 |   const handleAddRule = () => {
 249 |     if (!newRuleText.trim() || !selectedNodeId) return;
 250 |     addRule(selectedNodeId, newRuleText.trim());
 251 |     setNewRuleText("");
 252 |   };
 253 | 
 254 |   const handleDeleteRule = (ruleIndex: number) => {
 255 |     if (!selectedNodeId) return;
 256 |     deleteRule(selectedNodeId, ruleIndex);
 257 |   };
 258 | 
 259 |   const activeNodeDetail = nodes.find(n => n.id === selectedNodeId) as any;
 260 | 
 261 |   // ── Thinking indicator bubble
 262 |   const ThinkingBubble = () => (
 263 |     <motion.div
 264 |       initial={{ opacity: 0, y: 8 }}
 265 |       animate={{ opacity: 1, y: 0 }}
 266 |       exit={{ opacity: 0, y: -4 }}
 267 |       className="flex flex-col gap-1.5 py-2 px-1"
 268 |     >
 269 |       <div className="flex items-center gap-2">
 270 |         <span className="text-xs text-neutral-500 italic">Thinking</span>
 271 |         <span className="flex gap-1">
 272 |           {[0, 1, 2].map(i => (
 273 |             <span
 274 |               key={i}
 275 |               className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce"
 276 |               style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
 277 |             />
 278 |           ))}
 279 |         </span>
 280 |       </div>
 281 |       {statusMessage && (
 282 |         <span className="text-[10px] font-mono text-neutral-600 pl-0.5 truncate max-w-sm">
 283 |           {statusMessage}
 284 |         </span>
 285 |       )}
 286 |       {liveThoughts && (
 287 |         <div className="mt-1 text-[10px] text-neutral-500 font-sans leading-relaxed max-w-lg whitespace-pre-wrap border-l-2 border-neutral-800 pl-2">
 288 |           {liveThoughts.slice(-400)}
 289 |         </div>
 290 |       )}
 291 |     </motion.div>
 292 |   );
 293 | 
 294 |   // ── Collapsible agent trace (real data from backend)
 295 |   const AgentTraceBlock = ({ logs, thinkingSummary }: { logs: AgentTalkLog[], thinkingSummary?: string }) => {
 296 |     if (logs.length === 0 && !thinkingSummary) return null;
 297 |     return (
 298 |       <div className="border border-[#1f1f1f] rounded-xl overflow-hidden bg-[#050505] mt-3 max-w-2xl w-full">
 299 |         <details className="group" open>
 300 |           <summary className="flex items-center justify-between p-3 cursor-pointer select-none text-[11px] font-semibold text-neutral-500 hover:text-white hover:bg-neutral-900/40 transition-colors">
 301 |             <div className="flex items-center gap-2">
 302 |               <Sparkles className="w-3 h-3 text-neutral-500 group-hover:text-cyan-400 transition-colors" />
 303 |               <span className="font-mono text-[10px] tracking-wider uppercase">Agent Trace & Thinking</span>
 304 |             </div>
 305 |             <div className="flex items-center gap-2">
 306 |               {logs.length > 0 && <span className="text-[9px] text-neutral-600 font-mono">{logs.length} specialist{logs.length !== 1 ? "s" : ""}</span>}
 307 |               <ChevronRight className="w-3.5 h-3.5 text-neutral-600 group-open:rotate-90 transition-transform" />
 308 |             </div>
 309 |           </summary>
 310 |           <div className="border-t border-[#1f1f1f] p-3 space-y-3 bg-[#030303]">
 311 |             {thinkingSummary && (
 312 |               <div className="space-y-1.5 pb-2 border-b border-[#0d0d0d] last:border-0 last:pb-0">
 313 |                 <span className="text-[9px] font-mono text-neutral-500 font-bold uppercase tracking-wider">Reasoning Process</span>
 314 |                 <p className="text-[11px] text-neutral-400 leading-relaxed font-sans whitespace-pre-wrap">
 315 |                   {thinkingSummary}
 316 |                 </p>
 317 |               </div>
 318 |             )}
 319 |             {logs.map((log) => (
 320 |               <div key={log.id} className="flex gap-2 items-start text-[10.5px] leading-relaxed border-b border-[#0d0d0d] pb-2 last:border-0 last:pb-0">
 321 |                 <div className="w-5 h-5 rounded-md bg-neutral-900 flex items-center justify-center border border-white/5 shrink-0 select-none text-[10px] font-mono text-neutral-400">
 322 |                   {log.senderIcon === "science" ? "[S]" : log.senderIcon === "code" ? "[C]" : log.senderIcon === "trending_up" ? "[T]" : log.senderIcon === "present_to_all" ? "[U]" : "[G]"}
 323 |                 </div>
 324 |                 <div className="flex-1 min-w-0">
 325 |                   <div className="flex justify-between items-baseline select-none">
 326 |                     <span className="font-bold text-white uppercase tracking-wider text-[8.5px] leading-none">{log.senderName}</span>
 327 |                     <span className="text-[7.5px] text-neutral-600 font-mono leading-none">{log.timestamp}</span>
 328 |                   </div>
 329 |                   <p className="text-neutral-400 mt-0.5 font-sans leading-relaxed">{log.text}</p>
 330 |                 </div>
 331 |               </div>
 332 |             ))}
 333 |           </div>
 334 |         </details>
 335 |       </div>
 336 |     );
 337 |   };
 338 | 
 339 |   return (
 340 |     <div className="flex h-screen w-full bg-black text-[#f5f5f5] overflow-hidden font-sans">
 341 | 
 342 |       <aside
 343 |         className={`flex flex-col h-full bg-[#0d0d0d] border-r border-[#1f1f1f] shrink-0 transition-all duration-300 z-30 select-none ${
 344 |           isSidebarExpanded ? "w-64" : "w-[60px]"
 345 |         }`}
 346 |         onClick={(e) => {
 347 |           if (!isSidebarExpanded) {
 348 |             const target = e.target as HTMLElement;
 349 |             if (!target.closest('button, a, input')) {
 350 |               setIsSidebarExpanded(true);
 351 |             }
 352 |           }
 353 |         }}
 354 |       >
 355 |         {/* Top Header Area */}
 356 |         <div className="flex items-center gap-3 h-16 border-b border-[#1f1f1f] px-4 justify-between">
 357 |           {isSidebarExpanded ? (
 358 |             <div className="flex items-center gap-2.5">
 359 |               <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
 360 |                 <Bot className="w-4 h-4 text-black stroke-[2.5]" />
 361 |               </div>
 362 |               <div>
 363 |                 <h1 className="text-sm font-bold text-white tracking-tight leading-none">Solospace</h1>
 364 |               </div>
 365 |             </div>
 366 |           ) : (
 367 |             <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center mx-auto">
 368 |               <Bot className="w-4 h-4 text-black stroke-[2.5]" />
 369 |             </div>
 370 |           )}
 371 |           {isSidebarExpanded && (
 372 |             <button
 373 |               onClick={() => setIsSidebarExpanded(false)}
 374 |               className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 transition-colors cursor-pointer"
 375 |               title="Collapse sidebar"
 376 |             >
 377 |               <ChevronLeft className="w-4 h-4" />
 378 |             </button>
 379 |           )}
 380 |         </div>
 381 | 
 382 |         {/* Sidebar Nav Buttons */}
 383 |         <nav className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto custom-scrollbar">
 384 | 
 385 | 
 386 | 
 387 |           {/* New Chat Button */}
 388 |           <button
 389 |             id="new-chat-btn"
 390 |             onClick={() => {
 391 |               const ctrl = useWorkflowStore.getState().abortController;
 392 |               if (ctrl) ctrl.abort();
 393 | 
 394 |               setWorkspaceState("home");
 395 |               setUserQuery("");
 396 |               useWorkflowStore.setState({
 397 |                 activeSessionId: null,
 398 |                 nodes: [],
 399 |                 edges: [],
 400 |                 chatMessages: [],
 401 |                 agentTalkLogs: [],
 402 |                 executionState: "setup",
 403 |                 statusMessage: "",
 404 |                 isThinking: false,
 405 |                 isOrchestrating: false,
 406 |                 liveThoughts: "",
 407 |                 pendingApproval: null,
 408 |                 followUpSuggestions: [],
 409 |                 abortController: null
 410 |               });
 411 |             }}
 412 |             onMouseEnter={() => setHoveredSidebarItem("New Chat")}
 413 |             onMouseLeave={() => setHoveredSidebarItem(null)}
 414 |             className={`w-full flex items-center rounded-lg transition-all duration-150 py-2.5 cursor-pointer relative ${
 415 |               isSidebarExpanded ? "px-3 gap-3 hover:bg-neutral-900 text-neutral-200" : "justify-center text-neutral-400 hover:bg-neutral-900"
 416 |             }`}
 417 |           >
 418 |             <SquarePlus className="w-5 h-5 stroke-[1.8]" />
 419 |             {isSidebarExpanded && <span className="text-xs font-semibold">New Chat</span>}
 420 |             {!isSidebarExpanded && hoveredSidebarItem === "New Chat" && (
 421 |               <div className="absolute left-[64px] bg-[#1a1a1a] border border-[#2d2d2d] py-1 px-2.5 rounded text-[10px] text-white whitespace-nowrap z-50 pointer-events-none shadow-md">
 422 |                 New Chat
 423 |               </div>
 424 |             )}
 425 |           </button>
 426 | 
 427 |           {/* BYOK Button */}
 428 |           <button
 429 |             id="byok-sidebar-btn"
 430 |             onClick={() => setIsSecretOpen(true)}
 431 |             onMouseEnter={() => setHoveredSidebarItem("BYOK")}
 432 |             onMouseLeave={() => setHoveredSidebarItem(null)}
 433 |             className={`w-full flex items-center rounded-lg transition-all duration-150 py-2.5 cursor-pointer relative ${
 434 |               isSidebarExpanded ? "px-3 gap-3 hover:bg-neutral-900 text-neutral-200" : "justify-center text-neutral-400 hover:bg-neutral-900"
 435 |             }`}
 436 |           >
 437 |             <Key className="w-5 h-5 stroke-[1.8]" />
 438 |             {isSidebarExpanded && <span className="text-xs font-semibold">API Keys</span>}
 439 |             {!isSidebarExpanded && hoveredSidebarItem === "BYOK" && (
 440 |               <div className="absolute left-[64px] bg-[#1a1a1a] border border-[#2d2d2d] py-1 px-2.5 rounded text-[10px] text-white whitespace-nowrap z-50 pointer-events-none shadow-md">
 441 |                 Bring Your Own Key
 442 |               </div>
 443 |             )}
 444 |           </button>
 445 | 
 446 |           {/* Recents Log */}
 447 |           {isSidebarExpanded && (
 448 |             <div className="pt-6 space-y-2 select-none">
 449 |               <div className="flex items-center gap-1.5 px-3">
 450 |                 <History className="w-3.5 h-3.5 text-neutral-600" />
 451 |                 <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest font-mono">Recents</span>
 452 |               </div>
 453 |               <div className="space-y-1 max-h-[220px] overflow-y-auto custom-scrollbar">
 454 |                 {Object.values(sessions).length === 0 ? (
 455 |                   <span className="text-[10px] text-neutral-600 italic px-3 block pt-1">No chats yet.</span>
 456 |                 ) : (
 457 |                   Object.values(sessions).reverse().map((s) => (
 458 |                     <div key={s.id} className="group/session flex items-center justify-between px-2 py-1 rounded-md hover:bg-neutral-900 transition-colors">
 459 |                       <button
 460 |                         disabled={isLoadingSession}
 461 |                         onClick={async () => {
 462 |                           setIsLoadingSession(true);
 463 |                           try {
 464 |                             await loadSessionFromDb(s.id);
 465 |                             setWorkspaceState("active");
 466 |                             setCurrentTab("chat");
 467 |                           } catch (err) {
 468 |                             console.error(err);
 469 |                           } finally {
 470 |                             setIsLoadingSession(false);
 471 |                           }
 472 |                         }}
 473 |                         className={`text-left text-xs truncate font-medium flex-1 cursor-pointer transition-colors ${
 474 |                           activeSessionId === s.id
 475 |                             ? "text-white font-bold"
 476 |                             : "text-neutral-500 hover:text-white"
 477 |                         }`}
 478 |                         title={s.prompt}
 479 |                       >
 480 |                         {s.title}
 481 |                       </button>
 482 |                       <button
 483 |                         onClick={async (e) => {
 484 |                           e.stopPropagation();
 485 |                           if (confirm(`Are you sure you want to delete "${s.title}"?`)) {
 486 |                             await deleteSessionFromDb(s.id);
 487 |                           }
 488 |                         }}
 489 |                         className="opacity-0 group-hover/session:opacity-100 p-1 text-neutral-600 hover:text-rose-400 rounded transition-opacity cursor-pointer"
 490 |                         title="Delete Chat"
 491 |                       >
 492 |                         <Trash2 className="w-3.5 h-3.5" />
 493 |                       </button>
 494 |                     </div>
 495 |                   ))
 496 |                 )}
 497 |               </div>
 498 |             </div>
 499 |           )}
 500 |         </nav>
 501 | 
 502 |         {/* Sidebar Footer */}
 503 |         <div className="p-2 border-t border-[#1f1f1f] space-y-1 select-none">
 504 |           <button
 505 |             onClick={() => alert("Settings panel coming soon.")}
 506 |             className={`w-full flex items-center rounded-lg hover:bg-neutral-900 transition-colors py-2 cursor-pointer ${
 507 |               isSidebarExpanded ? "px-3 gap-3 text-neutral-400 hover:text-white" : "justify-center text-neutral-400 hover:text-white"
 508 |             }`}
 509 |           >
 510 |             <Settings className="w-4 h-4" />
 511 |             {isSidebarExpanded && <span className="text-xs">Settings</span>}
 512 |           </button>
 513 |           <button
 514 |             onClick={() => setIsProfileOpen(true)}
 515 |             className={`w-full flex items-center rounded-lg hover:bg-neutral-900 transition-colors py-2 cursor-pointer ${
 516 |               isSidebarExpanded ? "px-3 gap-3 text-neutral-400 hover:text-white" : "justify-center text-neutral-400 hover:text-white"
 517 |             }`}
 518 |           >
 519 |             <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center shrink-0 border border-neutral-700">
 520 |               <User className="w-3.5 h-3.5 text-neutral-300" />
 521 |             </div>
 522 |             {isSidebarExpanded && <span className="text-xs truncate font-medium">Profile</span>}
 523 |           </button>
 524 |         </div>
 525 |       </aside>
 526 | 
 527 |       <main className="flex-1 flex flex-col min-w-0 bg-[#000000] relative transition-all duration-300">
 528 | 
 529 |         {/* Header */}
 530 |         <header className="flex justify-between items-center w-full px-6 h-16 border-b border-[#141414] shrink-0 z-10 bg-black/85 backdrop-blur-md">
 531 |           <div className="flex items-center gap-2">
 532 |           </div>
 533 | 
 534 |           {/* Tab Switcher — Chat always left, Flow/Arena only visible when complex task ran */}
 535 |           <div className="flex items-center bg-[#0d0d0d] border border-[#1f1f1f] p-[2px] rounded-full select-none">
 536 |             <button
 537 |               id="tab-chat"
 538 |               onClick={() => {
 539 |                 if (workspaceState === "home") return;
 540 |                 setCurrentTab("chat");
 541 |               }}
 542 |               className={`px-6 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
 543 |                 currentTab === "chat" || workspaceState === "home"
 544 |                   ? "bg-neutral-800 text-white"
 545 |                   : "text-neutral-400 hover:text-white"
 546 |               }`}
 547 |             >
 548 |               Chat
 549 |             </button>
 550 |             {/* Flow tab only shown when complex task (nodes exist) */}
 551 |             {workspaceState === "active" && (
 552 |               <button
 553 |                 id="tab-flow"
 554 |                 onClick={() => setCurrentTab("arena")}
 555 |                 className={`px-6 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
 556 |                   currentTab === "arena"
 557 |                     ? "bg-neutral-800 text-white"
 558 |                     : "text-neutral-400 hover:text-white"
 559 |                 }`}
 560 |               >
 561 |                 <GitFork className="w-3 h-3" />
 562 |                 Flow
 563 |                 {nodes.length > 0 && (
 564 |                   <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse ml-0.5" />
 565 |                 )}
 566 |               </button>
 567 |             )}
 568 |           </div>
 569 | 
 570 |           {/* Right Header Controls */}
 571 |           <div className="flex items-center gap-4 select-none">
 572 |             <button
 573 |               onClick={() => alert("Solospace — AI-powered assistant. Enter any prompt to get a complete, detailed response. For complex tasks, use the Flow tab to inspect the multi-agent pipeline.")}
 574 |               className="text-neutral-400 hover:text-white p-1.5 rounded-md hover:bg-neutral-900 transition-colors cursor-pointer"
 575 |             >
 576 |               <HelpCircle className="w-4 h-4 stroke-[1.8]" />
 577 |             </button>
 578 |           </div>
 579 |         </header>
 580 | 
 581 |         {/* View Layout */}
 582 |         <div className="flex-1 relative overflow-hidden">
 583 | 
 584 |           {/* A. HOME SCREEN */}
 585 |           {workspaceState === "home" && (
 586 |             <div className="absolute inset-0 flex flex-col justify-between overflow-y-auto custom-scrollbar">
 587 |               <div />
 588 |               <div className="w-full max-w-2xl mx-auto px-6 py-12 flex flex-col items-center">
 589 |                 <div className="text-center mb-10 space-y-2 select-none">
 590 |                   <h1 className="text-4xl font-extrabold tracking-tight text-white antialiased">
 591 |                     What&apos;s on your mind?
 592 |                   </h1>
 593 |                   <p className="text-sm text-neutral-400 font-sans">
 594 |                     Ask anything. Get a real, complete answer instantly.
 595 |                   </p>
 596 |                 </div>
 597 | 
 598 |                 {/* Search Bar */}
 599 |                 <div className="w-full chatgpt-input-box rounded-[24px] p-2 flex flex-col gap-2">
 600 |                   <div className="flex items-center gap-3">
 601 |                     <button
 602 |                       onClick={() => alert("File attachment coming soon.")}
 603 |                       className="p-2 text-neutral-500 hover:text-neutral-300 rounded-full hover:bg-neutral-900 transition-colors shrink-0 cursor-pointer"
 604 |                       title="Attach File"
 605 |                     >
 606 |                       <UploadCloud className="w-5 h-5 stroke-[1.8]" />
 607 |                     </button>
 608 |                     <textarea
 609 |                       id="home-prompt-input"
 610 |                       rows={1}
 611 |                       value={userQuery}
 612 |                       onChange={(e) => setUserQuery(e.target.value)}
 613 |                       onKeyDown={(e) => {
 614 |                         if (e.key === "Enter" && !e.shiftKey) {
 615 |                           e.preventDefault();
 616 |                           if (userQuery.trim()) startOrchestration(userQuery);
 617 |                         }
 618 |                       }}
 619 |                       placeholder="Describe your idea, problem, or question..."
 620 |                       className="flex-1 bg-transparent text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-0 resize-none py-1.5 custom-scrollbar"
 621 |                       style={{ maxHeight: "150px" }}
 622 |                     />
 623 |                     <div className="flex items-center gap-1.5 shrink-0">
 624 |                       <button
 625 |                         onClick={() => alert("Voice input coming soon.")}
 626 |                         className="p-2 text-neutral-500 hover:text-neutral-300 rounded-full hover:bg-neutral-900 transition-colors cursor-pointer"
 627 |                         title="Voice Input"
 628 |                       >
 629 |                         <Mic className="w-5 h-5 stroke-[1.8]" />
 630 |                       </button>
 631 |                       <button
 632 |                         id="home-send-btn"
 633 |                         onClick={() => startOrchestration(userQuery)}
 634 |                         disabled={!userQuery.trim()}
 635 |                         className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-neutral-200 active:scale-95 disabled:opacity-20 disabled:scale-100 transition-all font-semibold cursor-pointer"
 636 |                         title="Send prompt"
 637 |                       >
 638 |                         <ArrowRight className="w-4 h-4 text-black stroke-[3]" />
 639 |                       </button>
 640 |                     </div>
 641 |                   </div>
 642 |                 </div>
 643 | 
 644 |                 {/* Mode Selector */}
 645 |                 <div className="flex items-center gap-3 mt-5 select-none">
 646 |                   <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Mode:</span>
 647 |                   <button
 648 |                     onClick={() => setIsAutoMode(true)}
 649 |                     className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono border transition-all cursor-pointer ${
 650 |                       isAutoMode
 651 |                         ? "bg-white text-black border-white font-bold"
 652 |                         : "bg-neutral-950 text-neutral-400 border-[#1f1f1f] hover:text-white"
 653 |                     }`}
 654 |                   >
 655 |                     <Zap className="w-3 h-3 stroke-[2]" />
 656 |                     <span>Auto Agent</span>
 657 |                   </button>
 658 |                   <button
 659 |                     onClick={() => setIsAutoMode(false)}
 660 |                     className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono border transition-all cursor-pointer ${
 661 |                       !isAutoMode
 662 |                         ? "bg-white text-black border-white font-bold"
 663 |                         : "bg-neutral-950 text-neutral-400 border-[#1f1f1f] hover:text-white"
 664 |                     }`}
 665 |                   >
 666 |                     <Sliders className="w-3 h-3" />
 667 |                     <span>Custom Agent</span>
 668 |                   </button>
 669 |                 </div>
 670 |               </div>
 671 |               <div />
 672 |             </div>
 673 |           )}
 674 | 
 675 |           {/* B. ACTIVE WORKSPACE */}
 676 |           {workspaceState === "active" && (
 677 |             <div className="absolute inset-0 flex">
 678 | 
 679 |               {/* VIEW 1: CHAT (Primary — always shown first) */}
 680 |               {currentTab === "chat" && (
 681 |                 <div className="flex-1 flex flex-col justify-between overflow-hidden bg-black">
 682 | 
 683 |                   {/* Chat messages */}
 684 |                   <div
 685 |                     ref={chatContainerRef}
 686 |                     onScroll={handleScroll}
 687 |                     className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4"
 688 |                   >
 689 |                     {isLoadingSession ? (
 690 |                       <div className="flex items-center justify-center h-full">
 691 |                         <div className="flex flex-col items-center gap-3 text-neutral-500">
 692 |                           <div className="w-6 h-6 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
 693 |                           <span className="text-xs font-semibold">Loading Session...</span>
 694 |                         </div>
 695 |                       </div>
 696 |                     ) : (
 697 |                       <div className="max-w-5xl mx-auto space-y-4 select-text">
 698 | 
 699 |                       {chatMessages.map((msg, msgIdx) => (
 700 |                         <motion.div
 701 |                           key={msg.id}
 702 |                           initial={{ opacity: 0, y: 12 }}
 703 |                           animate={{ opacity: 1, y: 0 }}
 704 |                           transition={{ duration: 0.3 }}
 705 |                           className={`flex w-full ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
 706 |                         >
 707 |                           {msg.sender === "user" ? (
 708 |                             <div className="max-w-[72%] rounded-3xl px-5 py-3 bg-[#2f2f2f] text-neutral-100 text-sm leading-relaxed">
 709 |                               <p className="whitespace-pre-wrap">{msg.text}</p>
 710 |                             </div>
 711 |                           ) : (
 712 |                             <div className="flex-1 max-w-[88%] flex flex-col items-start space-y-1">
 713 |                               <div className="w-full text-neutral-100 text-sm leading-relaxed px-1 py-2">
 714 |                                 <MarkdownRenderer content={msg.text || "*Streaming response...*"} />
 715 |                                 
 716 |                                 {/* Action Buttons for AI Response */}
 717 |                                 {msg.text && (
 718 |                                   <div className="flex items-center gap-3 mt-4 text-neutral-500 select-none">
 719 |                                     <button
 720 |                                       onClick={() => copyToClipboard(msg.text, msg.id)}
 721 |                                       className="flex items-center gap-1.5 text-[11px] hover:text-neutral-200 transition-colors cursor-pointer p-1 rounded-md hover:bg-neutral-800"
 722 |                                       title="Copy response"
 723 |                                     >
 724 |                                       {copiedMsgId === msg.id ? (
 725 |                                         <>
 726 |                                           <Check className="w-3.5 h-3.5 text-emerald-400" />
 727 |                                           <span className="text-emerald-400 font-medium">Copied</span>
 728 |                                         </>
 729 |                                       ) : (
 730 |                                         <>
 731 |                                           <Copy className="w-3.5 h-3.5" />
 732 |                                           <span>Copy</span>
 733 |                                         </>
 734 |                                       )}
 735 |                                     </button>
 736 |                                     {msgIdx === chatMessages.length - 1 && !isThinking && !isOrchestrating && (
 737 |                                       <button
 738 |                                         onClick={() => {
 739 |                                           const lastUser = chatMessages.slice().reverse().find(m => m.sender === "user");
 740 |                                           if (lastUser) {
 741 |                                             setChatMessages(prev => {
 742 |                                               const lastAiIdx = prev.map((m, i) => m.sender === 'ai' ? i : -1).filter(i => i >= 0).pop();
 743 |                                               if (lastAiIdx !== undefined) {
 744 |                                                 return prev.filter((_, i) => i !== lastAiIdx);
 745 |                                               }
 746 |                                               return prev;
 747 |                                             });
 748 |                                             startOrchestration(lastUser.text);
 749 |                                           }
 750 |                                         }}
 751 |                                         className="flex items-center gap-1.5 text-[11px] hover:text-neutral-200 transition-colors cursor-pointer p-1 rounded-md hover:bg-neutral-800"
 752 |                                         title="Regenerate response"
 753 |                                       >
 754 |                                         <Zap className="w-3.5 h-3.5" />
 755 |                                         <span>Regenerate</span>
 756 |                                       </button>
 757 |                                     )}
 758 |                                   </div>
 759 |                                 )}
 760 |                               </div>
 761 | 
 762 |                               {/* Collapsible trace block and see flow buttons outside bubble */}
 763 |                               {msgIdx === chatMessages.length - 1 && (
 764 |                                 <div className="space-y-3 pt-1 w-full">
 765 |                                   <AgentTraceBlock
 766 |                                     logs={agentTalkLogs}
 767 |                                     thinkingSummary={msg.thinkingSummary}
 768 |                                   />
 769 |                                   
 770 |                                   {!isThinking && !isOrchestrating && nodes.length > 0 && (
 771 |                                     <div className="flex flex-wrap gap-2 pt-1">
 772 |                                       <button
 773 |                                         id="see-flow-btn"
 774 |                                         onClick={() => setCurrentTab("arena")}
 775 |                                         className="px-4 py-2 bg-neutral-950 hover:bg-neutral-900 border border-[#1f1f1f] hover:border-cyan-500/40 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer max-w-max select-none"
 776 |                                       >
 777 |                                         <GitFork className="w-3.5 h-3.5 text-cyan-400" />
 778 |                                         <span>See Agent Flow</span>
 779 |                                         <span className="text-[9px] font-mono text-neutral-600">({nodes.length} agents)</span>
 780 |                                       </button>
 781 | 
 782 |                                       {!isAutoMode && (
 783 |                                         <button
 784 |                                           onClick={() => setCurrentTab("arena")}
 785 |                                           className="px-4 py-2 bg-neutral-950 hover:bg-neutral-900 border border-[#1f1f1f] hover:border-neutral-500 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer max-w-max select-none"
 786 |                                         >
 787 |                                           <Sliders className="w-3.5 h-3.5" />
 788 |                                           <span>Customize Agents</span>
 789 |                                         </button>
 790 |                                       )}
 791 |                                     </div>
 792 |                                   )}
 793 | 
 794 |                                   {!isThinking && !isOrchestrating && followUpSuggestions && followUpSuggestions.length > 0 && (
 795 |                                     <div className="flex flex-wrap gap-2 pt-2 select-none">
 796 |                                       <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-wider self-center">Suggestions:</span>
 797 |                                       {followUpSuggestions.map((suggestion, idx) => (
 798 |                                         <button
 799 |                                           key={idx}
 800 |                                           onClick={() => {
 801 |                                             setUserQuery(suggestion);
 802 |                                             startOrchestration(suggestion);
 803 |                                           }}
 804 |                                           className="px-3 py-1.5 bg-neutral-950 hover:bg-neutral-900 border border-[#1f1f1f] hover:border-cyan-500/30 rounded-full text-[10px] text-neutral-400 hover:text-white transition-all cursor-pointer animate-fade-in"
 805 |                                         >
 806 |                                           {suggestion}
 807 |                                         </button>
 808 |                                       ))}
 809 |                                     </div>
 810 |                                   )}
 811 |                                 </div>
 812 |                               )}
 813 |                             </div>
 814 |                           )}
 815 |                         </motion.div>
 816 |                       ))}
 817 | 
 818 |                       {/* Thinking indicator */}
 819 |                       <AnimatePresence>
 820 |                         {isThinking && <ThinkingBubble />}
 821 |                       </AnimatePresence>
 822 | 
 823 |                       {/* Auto-scroll anchor */}
 824 |                       <div ref={chatEndRef} />
 825 |                     </div>
 826 |                     )}
 827 |                   </div>
 828 | 
 829 |                   {/* Bottom input bar */}
 830 |                   <div className="px-6 py-4 bg-black/60 border-t border-[#141414] backdrop-blur-xl shrink-0 flex flex-col gap-2">
 831 |                     {!isAutoMode && workspaceState === "active" && (
 832 |                       <div className="text-[10px] font-mono text-amber-400 bg-amber-950/30 px-3 py-1 rounded-full self-center border border-amber-500/20 max-w-max select-none">
 833 |                         Planning Mode – Edit agents in Flow, then click Proceed
 834 |                       </div>
 835 |                     )}
 836 |                     <div className="max-w-3xl mx-auto w-full chatgpt-input-box rounded-[24px] p-1.5 flex items-center gap-2">
 837 |                       <textarea
 838 |                         ref={textareaRef}
 839 |                         id="chat-prompt-input"
 840 |                         rows={1}
 841 |                         value={userQuery}
 842 |                         onChange={(e) => setUserQuery(e.target.value)}
 843 |                         onKeyDown={(e) => {
 844 |                           if (e.key === "Enter" && !e.shiftKey) {
 845 |                             e.preventDefault();
 846 |                             if (!isOrchestrating && userQuery.trim()) startOrchestration(userQuery);
 847 |                           }
 848 |                         }}
 849 |                         placeholder={isOrchestrating ? "Streaming response..." : (isAutoMode ? "Ask a follow-up or new question..." : "Enter a new idea to generate agents (no auto-run)...")}
 850 |                         disabled={isOrchestrating}
 851 |                         className="flex-1 bg-transparent text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-0 px-3 py-1.5 disabled:opacity-50 resize-none max-h-40 custom-scrollbar"
 852 |                       />
 853 |                       {isOrchestrating ? (
 854 |                         <button
 855 |                           onClick={cancelOrchestration}
 856 |                           className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-500 active:scale-95 transition-all font-semibold cursor-pointer shrink-0"
 857 |                           title="Stop generating"
 858 |                         >
 859 |                           <Square className="w-3.5 h-3.5 text-white fill-white" />
 860 |                         </button>
 861 |                       ) : (
 862 |                         <button
 863 |                           id="chat-send-btn"
 864 |                           onClick={() => startOrchestration(userQuery)}
 865 |                           disabled={!userQuery.trim() || isThinking}
 866 |                           className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-neutral-200 active:scale-95 disabled:opacity-20 disabled:scale-100 transition-all font-semibold cursor-pointer shrink-0"
 867 |                           title="Send message"
 868 |                         >
 869 |                           <ArrowRight className="w-4 h-4 text-black stroke-[3]" />
 870 |                         </button>
 871 |                       )}
 872 |                     </div>
 873 |                   </div>
 874 |                 </div>
 875 |               )}
 876 | 
 877 |               {/* VIEW 2: ARENA CANVAS (Optional — Flow inspection/editing) */}
 878 |               {currentTab === "arena" && (
 879 |                 <div className="flex-1 relative overflow-hidden bg-[#000000] flex">
 880 | 
 881 |                   {/* Back to chat bar at top */}
 882 |                   <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#0d0d0d]/90 border border-[#1f1f1f] rounded-full px-4 py-2 backdrop-blur-md shadow-xl pointer-events-auto">
 883 |                     <button
 884 |                       onClick={() => setCurrentTab("chat")}
 885 |                       className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer font-mono"
 886 |                     >
 887 |                       <ChevronLeft className="w-3.5 h-3.5" />
 888 |                       Back to Chat
 889 |                     </button>
 890 |                     <span className="text-neutral-700 text-xs">|</span>
 891 |                     <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
 892 |                       Agent Flow — {nodes.length} active
 893 |                     </span>
 894 |                   </div>
 895 | 
 896 |                   {/* FLOATING LEFT SIDE Arena Tools Panel */}
 897 |                   <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col bg-[#0d0d0d]/80 border border-[#1f1f1f] p-1.5 rounded-xl z-20 backdrop-blur-md shadow-2xl">
 898 |                     <div className="text-[8px] font-mono text-neutral-600 uppercase tracking-widest px-2 pb-2 text-center select-none border-b border-[#141414] mb-2 font-bold">
 899 |                       Tools
 900 |                     </div>
 901 |                     {toolsList.map((tool) => (
 902 |                       <div
 903 |                         key={tool.name}
 904 |                         draggable
 905 |                         onDragStart={(e) => e.dataTransfer.setData("toolName", tool.name)}
 906 |                         className="p-2.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-900 transition-all cursor-grab active:cursor-grabbing flex items-center justify-center relative group"
 907 |                       >
 908 |                         {tool.icon}
 909 |                         <div className="absolute left-12 bg-[#0c0c0c] border border-[#1f1f1f] p-2.5 rounded-lg text-left hidden group-hover:block w-40 z-30 shadow-2xl pointer-events-none">
 910 |                           <h4 className="text-[10px] font-bold text-white">{tool.name}</h4>
 911 |                           <p className="text-[9px] text-neutral-400 mt-0.5 leading-relaxed">{tool.desc}</p>
 912 |                           <span className="text-[8px] font-mono text-neutral-600 block mt-1.5 italic">Drag onto agent node</span>
 913 |                         </div>
 914 |                       </div>
 915 |                     ))}
 916 |                   </div>
 917 | 
 918 |                   {/* Flow Arena */}
 919 |                   <FlowArena />
 920 | 
 921 |                   {/* Bottom controls — Proceed & Return to Chat */}
 922 |                   <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center gap-3 font-semibold select-none">
 923 |                     <button
 924 |                       disabled={isOrchestrating}
 925 |                       onClick={async () => {
 926 |                         if (isOrchestrating) return;
 927 |                         // Bug 11: Immediately set orchestrating to prevent double-fire before async fn sets it
 928 |                         useWorkflowStore.setState({ isOrchestrating: true });
 929 |                         setCurrentTab("chat"); // Switch back to chat to see the output stream
 930 |                         const triggerCustomExecution = useWorkflowStore.getState().triggerCustomExecution;
 931 |                         await triggerCustomExecution();
 932 |                       }}
 933 |                       className="bg-white hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-500 text-black font-bold text-xs h-10 px-6 rounded-[24px] shadow-2xl flex items-center gap-1.5 cursor-pointer shrink-0 transition-all active:scale-95 disabled:scale-100 disabled:cursor-not-allowed"
 934 |                     >
 935 |                       {isOrchestrating ? (
 936 |                         <>
 937 |                           <div className="w-3.5 h-3.5 border-2 border-neutral-500 border-t-neutral-200 rounded-full animate-spin" />
 938 |                           <span>Running Flow...</span>
 939 |                         </>
 940 |                       ) : (
 941 |                         <>
 942 |                           <Zap className="w-3.5 h-3.5 text-black fill-black" />
 943 |                           <span>Proceed with Agents</span>
 944 |                         </>
 945 |                       )}
 946 |                     </button>
 947 |                     <button
 948 |                       onClick={() => setCurrentTab("chat")}
 949 |                       className="h-10 px-4 rounded-[24px] border border-[#1f1f1f] hover:border-neutral-600 bg-black/80 backdrop-blur-md text-neutral-400 hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-2xl"
 950 |                     >
 951 |                       Return to Chat
 952 |                     </button>
 953 |                   </div>
 954 |                 </div>
 955 |               )}
 956 |             </div>
 957 |           )}
 958 |         </div>
 959 |       </main>
 960 | 
 961 |       {/* 3. RIGHT Sliding Configuration Edit Panel */}
 962 |       {currentTab === "arena" && (
 963 |         <div
 964 |           className={`fixed top-0 right-0 h-full w-80 bg-[#0c0c0c]/95 border-l border-[#1f1f1f] z-40 flex flex-col justify-between shadow-2xl transition-transform duration-300 right-panel select-none ${
 965 |             isConfigPanelOpen ? "translate-x-0" : "translate-x-full"
 966 |           }`}
 967 |         >
 968 |         <button
 969 |           onClick={handleCloseConfigPanel}
 970 |           className="absolute -left-8 top-1/2 -translate-y-1/2 w-8 h-16 bg-[#0c0c0c]/95 border border-[#1f1f1f] border-r-0 rounded-l-xl flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer"
 971 |         >
 972 |           {isConfigPanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
 973 |         </button>
 974 | 
 975 |         {activeNodeDetail ? (
 976 |           <div className="flex-1 flex flex-col h-full overflow-hidden">
 977 |             <div className="p-5 border-b border-[#1f1f1f] flex justify-between items-center bg-[#0d0d0d]">
 978 |               <div>
 979 |                 <h3 className="text-sm font-bold text-white uppercase tracking-wider">{activeNodeDetail.data.name}</h3>
 980 |                 <span className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest block mt-0.5">{activeNodeDetail.data.tag}</span>
 981 |               </div>
 982 |               <button onClick={handleCloseConfigPanel} className="text-neutral-500 hover:text-white cursor-pointer">
 983 |                 <X className="w-4 h-4" />
 984 |               </button>
 985 |             </div>
 986 | 
 987 |             <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
 988 |               {/* Enable/Disable toggle */}
 989 |               <div className="flex items-center justify-between bg-[#070707] border border-[#1f1f1f] p-3 rounded-xl">
 990 |                 <div className="flex flex-col">
 991 |                   <span className="text-[10px] font-bold text-white uppercase tracking-wider">Active</span>
 992 |                   <span className="text-[9px] text-neutral-500 mt-0.5">Disable to exclude from pipeline</span>
 993 |                 </div>
 994 |                 <button
 995 |                   onClick={() => updateNodeField(activeNodeDetail.id, { enabled: !activeNodeDetail.data.enabled })}
 996 |                   className={`w-10 h-5 rounded-full p-0.5 transition-all duration-200 cursor-pointer ${activeNodeDetail.data.enabled ? "bg-white" : "bg-neutral-800"}`}
 997 |                 >
 998 |                   <div className={`w-4 h-4 rounded-full transition-transform ${activeNodeDetail.data.enabled ? "bg-black translate-x-5" : "bg-neutral-600 translate-x-0"}`} />
 999 |                 </button>
1000 |               </div>
1001 | 
1002 |               {/* Priority Slider */}
1003 |               <div className="space-y-1 bg-[#070707] border border-[#1f1f1f] p-3 rounded-xl">
1004 |                 <div className="flex justify-between items-center text-[9px] font-mono uppercase text-neutral-400 font-bold">
1005 |                   <span>Priority</span>
1006 |                   <span className="text-white">Level {activeNodeDetail.data.priority}</span>
1007 |                 </div>
1008 |                 <input
1009 |                   type="range" min="1" max="10" step="1"
1010 |                   value={activeNodeDetail.data.priority}
1011 |                   onChange={(e) => updateNodeField(activeNodeDetail.id, { priority: parseInt(e.target.value) })}
1012 |                   className="w-full accent-white h-1 bg-[#1f1f1f] rounded-lg appearance-none cursor-pointer mt-2"
1013 |                 />
1014 |               </div>
1015 | 
1016 |               {/* Name */}
1017 |               <div className="space-y-1.5">
1018 |                 <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Agent Name</label>
1019 |                 <input
1020 |                   type="text" value={activeNodeDetail.data.name}
1021 |                   onChange={(e) => updateNodeField(activeNodeDetail.id, { name: e.target.value })}
1022 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-3 py-2 text-xs text-white focus:border-neutral-500 outline-none"
1023 |                 />
1024 |               </div>
1025 | 
1026 |               {/* Personality */}
1027 |               <div className="space-y-1.5">
1028 |                 <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Personality</label>
1029 |                 <input
1030 |                   type="text" value={activeNodeDetail.data.personality}
1031 |                   onChange={(e) => updateNodeField(activeNodeDetail.id, { personality: e.target.value })}
1032 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-3 py-2 text-xs text-white focus:border-neutral-500 outline-none"
1033 |                 />
1034 |               </div>
1035 | 
1036 |               {/* System Prompt */}
1037 |               <div className="space-y-1.5">
1038 |                 <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">System Prompt</label>
1039 |                 <textarea
1040 |                   value={activeNodeDetail.data.systemPrompt}
1041 |                   onChange={(e) => updateNodeField(activeNodeDetail.id, { systemPrompt: e.target.value })}
1042 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg p-3 text-xs text-white focus:border-neutral-500 outline-none min-h-[80px] resize-none leading-relaxed"
1043 |                 />
1044 |               </div>
1045 | 
1046 |               {/* Goal Objective */}
1047 |               <div className="space-y-1.5">
1048 |                 <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Objective</label>
1049 |                 <textarea
1050 |                   value={activeNodeDetail.data.objective}
1051 |                   onChange={(e) => updateNodeField(activeNodeDetail.id, { objective: e.target.value })}
1052 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg p-3 text-xs text-white focus:border-neutral-500 outline-none min-h-[60px] resize-none leading-relaxed"
1053 |                 />
1054 |               </div>
1055 | 
1056 |               {/* Rules */}
1057 |               <div className="space-y-2">
1058 |                 <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold block">Rules</label>
1059 |                 <div className="space-y-1.5">
1060 |                   {activeNodeDetail.data.rules && activeNodeDetail.data.rules.map((rule: any, idx: number) => (
1061 |                     <div key={idx} className="flex gap-2 items-center bg-[#050505] border border-[#1f1f1f] p-2 rounded-lg justify-between">
1062 |                       <span className="text-[10px] text-neutral-300 leading-normal flex-1 pr-2">{rule}</span>
1063 |                       <button onClick={() => handleDeleteRule(idx)} className="text-neutral-500 hover:text-red-400 transition-colors shrink-0 cursor-pointer">
1064 |                         <Trash2 className="w-3.5 h-3.5" />
1065 |                       </button>
1066 |                     </div>
1067 |                   ))}
1068 |                 </div>
1069 |                 <div className="flex gap-2">
1070 |                   <input
1071 |                     type="text" value={newRuleText}
1072 |                     onChange={(e) => setNewRuleText(e.target.value)}
1073 |                     placeholder="Add constraint..."
1074 |                     className="flex-1 bg-[#050505] border border-[#1f1f1f] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-neutral-500"
1075 |                   />
1076 |                   <button onClick={handleAddRule} className="bg-white text-black font-bold text-xs px-3 rounded-lg hover:bg-neutral-200 cursor-pointer">Add</button>
1077 |                 </div>
1078 |               </div>
1079 | 
1080 |               {/* Sliders */}
1081 |               <div className="space-y-4 pt-3 border-t border-[#141414]">
1082 |                 {[
1083 |                   { label: "Creativity", key: "temp", min: 0, max: 1, step: 0.05, display: (v: number) => v.toString() },
1084 |                   { label: "Logic / Depth", key: "logic", min: 10, max: 100, step: 5, display: (v: number) => `${v}%` },
1085 |                   { label: "Empathy", key: "empathy", min: 0, max: 100, step: 5, display: (v: number) => `${v}%` }
1086 |                 ].map(({ label, key, min, max, step, display }) => (
1087 |                   <div key={key} className="space-y-1">
1088 |                     <div className="flex justify-between items-center text-[9px] font-mono uppercase text-neutral-400 font-bold">
1089 |                       <span>{label}</span>
1090 |                       <span className="text-white">{display(activeNodeDetail.data[key])}</span>
1091 |                     </div>
1092 |                     <input
1093 |                       type="range" min={min} max={max} step={step}
1094 |                       value={activeNodeDetail.data[key]}
1095 |                       onChange={(e) => updateNodeField(activeNodeDetail.id, { [key]: key === "temp" ? parseFloat(e.target.value) : parseInt(e.target.value) })}
1096 |                       className="w-full accent-white h-1 bg-[#1f1f1f] rounded-lg appearance-none cursor-pointer"
1097 |                     />
1098 |                   </div>
1099 |                 ))}
1100 |               </div>
1101 | 
1102 |               {/* Tool Integrations */}
1103 |               <div className="pt-5 border-t border-[#141414] space-y-4">
1104 |                 <div className="flex justify-between items-center">
1105 |                   <label className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Tools</label>
1106 |                   <span className="text-[8px] font-mono text-neutral-500 uppercase">Attached: {activeNodeDetail.data.tools?.length || 0}</span>
1107 |                 </div>
1108 |                 <select
1109 |                   id="tool-selector-dropdown"
1110 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 outline-none focus:border-neutral-500"
1111 |                   defaultValue=""
1112 |                   onChange={(e) => {
1113 |                     const toolName = e.target.value;
1114 |                     if (!toolName) return;
1115 |                     const currentTools = activeNodeDetail.data.tools || [];
1116 |                     if (!currentTools.includes(toolName)) {
1117 |                       const updatedTools = [...currentTools, toolName];
1118 |                       const permissions = activeNodeDetail.data.toolPermissions || {};
1119 |                       const updatedPerms = { ...permissions, [toolName]: permissions[toolName] || "ALLOWED" };
1120 |                       updateNodeField(activeNodeDetail.id, { tools: updatedTools, toolPermissions: updatedPerms });
1121 |                     }
1122 |                     e.target.value = "";
1123 |                   }}
1124 |                 >
1125 |                   <option value="" disabled>+ Attach tool...</option>
1126 |                   {["Web Search", "Browser", "Memory", "File Upload", "Code Executor", "Vision", "Voice", "API Connector"]
1127 |                     .filter(tool => !(activeNodeDetail.data.tools || []).includes(tool))
1128 |                     .map((tool: string) => (
1129 |                       <option key={tool} value={tool}>{tool}</option>
1130 |                     ))}
1131 |                 </select>
1132 | 
1133 |                 <div className="space-y-3">
1134 |                   {(!activeNodeDetail.data.tools || activeNodeDetail.data.tools.length === 0) ? (
1135 |                     <div className="bg-[#050505] border border-dashed border-[#1f1f1f] p-4 text-center rounded-xl">
1136 |                       <p className="text-[10px] text-neutral-500">No tools attached.</p>
1137 |                     </div>
1138 |                   ) : (
1139 |                     activeNodeDetail.data.tools.map((tool: any) => {
1140 |                       const currentPermissions = activeNodeDetail.data.toolPermissions || {};
1141 |                       const permission = currentPermissions[tool] || "ALLOWED";
1142 |                       return (
1143 |                         <div key={tool} className="bg-[#050505] border border-[#1f1f1f] p-3 rounded-xl space-y-2">
1144 |                           <div className="flex justify-between items-center">
1145 |                             <span className="text-xs font-bold text-white flex items-center gap-1.5">
1146 |                               <span className={`w-1.5 h-1.5 rounded-full ${permission === "ALLOWED" ? "bg-emerald-500 animate-pulse" : permission === "ASK" ? "bg-amber-500" : "bg-rose-500"}`} />
1147 |                               {tool}
1148 |                             </span>
1149 |                             <button
1150 |                               onClick={() => {
1151 |                                 const updatedTools = (activeNodeDetail.data.tools || []).filter((t: string) => t !== tool);
1152 |                                 const updatedPerms = { ...(activeNodeDetail.data.toolPermissions || {}) };
1153 |                                 delete updatedPerms[tool];
1154 |                                 updateNodeField(activeNodeDetail.id, { tools: updatedTools, toolPermissions: updatedPerms });
1155 |                               }}
1156 |                               className="text-neutral-500 hover:text-red-400 p-1 transition-colors cursor-pointer"
1157 |                             >
1158 |                               <Trash2 className="w-3.5 h-3.5" />
1159 |                             </button>
1160 |                           </div>
1161 |                           <div className="grid grid-cols-3 gap-1 pt-1">
1162 |                             {(["ALLOWED", "ASK", "DENIED"] as const).map((level) => (
1163 |                               <button
1164 |                                 key={level}
1165 |                                 onClick={() => {
1166 |                                   const updatedPerms = { ...(activeNodeDetail.data.toolPermissions || {}), [tool]: level };
1167 |                                   updateNodeField(activeNodeDetail.id, { toolPermissions: updatedPerms });
1168 |                                 }}
1169 |                                 className={`py-1 text-[9px] font-mono font-bold rounded-md border transition-all cursor-pointer ${
1170 |                                   permission === level
1171 |                                     ? level === "ALLOWED" ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/50"
1172 |                                     : level === "ASK" ? "bg-amber-950/40 text-amber-400 border-amber-500/50"
1173 |                                     : "bg-rose-950/40 text-rose-400 border-rose-500/50"
1174 |                                     : "bg-transparent text-neutral-500 border-[#1f1f1f] hover:text-neutral-300"
1175 |                                 }`}
1176 |                               >
1177 |                                 {level === "ALLOWED" ? "ALLOW" : level === "ASK" ? "ASK" : "DENY"}
1178 |                               </button>
1179 |                             ))}
1180 |                           </div>
1181 |                         </div>
1182 |                       );
1183 |                     })
1184 |                   )}
1185 |                 </div>
1186 |               </div>
1187 | 
1188 |               {/* Connections */}
1189 |               <div className="pt-5 border-t border-[#141414] space-y-4">
1190 |                 <div className="flex justify-between items-center">
1191 |                   <label className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Connections</label>
1192 |                   <span className="text-[8px] font-mono text-neutral-500 uppercase">
1193 |                     Links: {edges.filter(c => c.source === activeNodeDetail.id || c.target === activeNodeDetail.id).length}
1194 |                   </span>
1195 |                 </div>
1196 |                 <select
1197 |                   id="connection-selector-dropdown"
1198 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 outline-none focus:border-neutral-500"
1199 |                   defaultValue=""
1200 |                   onChange={(e) => {
1201 |                     const targetId = e.target.value;
1202 |                     if (!targetId) return;
1203 |                     const exists = edges.some(c =>
1204 |                       (c.source === activeNodeDetail.id && c.target === targetId) ||
1205 |                       (c.source === targetId && c.target === activeNodeDetail.id)
1206 |                     );
1207 |                     if (!exists) {
1208 |                       setEdges(prev => [...prev, {
1209 |                         id: `e-${activeNodeDetail.id}-${targetId}`,
1210 |                         source: activeNodeDetail.id,
1211 |                         target: targetId,
1212 |                         animated: true,
1213 |                         type: 'custom'
1214 |                       }]);
1215 |                       // Bug 1: Sync dependency — the target node now depends on this (source) node
1216 |                       const targetNode = nodes.find(n => n.id === targetId);
1217 |                       if (targetNode) {
1218 |                         const currentDeps = (targetNode.data as any).dependencies || [];
1219 |                         if (!currentDeps.includes(activeNodeDetail.id)) {
1220 |                           updateNodeField(targetId, {
1221 |                             dependencies: [...currentDeps, activeNodeDetail.id]
1222 |                           });
1223 |                         }
1224 |                       }
1225 |                     }
1226 |                     e.target.value = "";
1227 |                   }}
1228 |                 >
1229 |                   <option value="" disabled>+ Connect to agent...</option>
1230 |                   {nodes.filter(n => n.id !== activeNodeDetail.id && n.type === 'custom').map(node => (
1231 |                     <option key={node.id} value={node.id}>{(node.data as any).name}</option>
1232 |                   ))}
1233 |                 </select>
1234 |                 <div className="space-y-1.5">
1235 |                   {(() => {
1236 |                     const linkedConns = edges.filter(c => c.source === activeNodeDetail.id || c.target === activeNodeDetail.id);
1237 |                     if (linkedConns.length === 0) {
1238 |                       return (
1239 |                         <div className="bg-[#050505] border border-dashed border-[#1f1f1f] p-3 text-center rounded-xl">
1240 |                           <p className="text-[10px] text-neutral-500">No connections.</p>
1241 |                         </div>
1242 |                       );
1243 |                     }
1244 |                     return linkedConns.map((conn, index) => {
1245 |                       const otherNodeId = conn.source === activeNodeDetail.id ? conn.target : conn.source;
1246 |                       const otherNode = nodes.find(n => n.id === otherNodeId);
1247 |                       return (
1248 |                         <div key={index} className="flex gap-2 items-center bg-[#050505] border border-[#1f1f1f] p-2 rounded-lg justify-between">
1249 |                           <span className="text-[10px] text-neutral-300 leading-normal flex-1 pr-2">
1250 |                             {otherNode ? (otherNode.data as any).name : otherNodeId}
1251 |                           </span>
1252 |                           <button onClick={() => deleteEdge(conn.id)} className="text-neutral-500 hover:text-red-400 transition-colors shrink-0 cursor-pointer">
1253 |                             <Trash2 className="w-3.5 h-3.5" />
1254 |                           </button>
1255 |                         </div>
1256 |                       );
1257 |                     });
1258 |                   })()}
1259 |                 </div>
1260 |               </div>
1261 | 
1262 |               {/* Execution Logs */}
1263 |               <div className="pt-5 border-t border-[#141414] space-y-3">
1264 |                 <div className="flex justify-between items-center">
1265 |                   <label className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Execution Log</label>
1266 |                   <button
1267 |                     onClick={() => updateNodeField(activeNodeDetail.id, { toolLogs: [] })}
1268 |                     className="text-[8px] font-mono text-neutral-500 hover:text-white uppercase transition-colors cursor-pointer"
1269 |                   >
1270 |                     Clear
1271 |                   </button>
1272 |                 </div>
1273 |                 <div className="bg-black border border-[#1f1f1f] rounded-xl p-3 h-44 overflow-y-auto font-mono text-[9px] space-y-1.5 custom-scrollbar">
1274 |                   {(!activeNodeDetail.data.toolLogs || activeNodeDetail.data.toolLogs.length === 0) ? (
1275 |                     <div className="h-full flex items-center justify-center text-neutral-600 text-center">
1276 |                       <span>No logs recorded.</span>
1277 |                     </div>
1278 |                   ) : (
1279 |                     activeNodeDetail.data.toolLogs.map((log: any) => (
1280 |                       <div key={log.id} className="flex gap-1.5 items-start leading-normal text-neutral-300">
1281 |                         <span className="text-neutral-500 shrink-0 select-none">[{log.timestamp}]</span>
1282 |                         <div className="flex-1">
1283 |                           <span className="font-bold text-white uppercase mr-1">[{log.tool}]</span>
1284 |                           <span>{log.detail}</span>
1285 |                         </div>
1286 |                         <span className={`shrink-0 font-bold px-1 rounded-sm text-[8px] ${
1287 |                           log.status === "SUCCESS" ? "bg-emerald-950 text-emerald-400" :
1288 |                           log.status === "PENDING" ? "bg-amber-950 text-amber-400 animate-pulse" :
1289 |                           log.status === "BLOCKED" ? "bg-rose-950 text-rose-400" : "bg-neutral-800 text-neutral-400"
1290 |                         }`}>
1291 |                           {log.status}
1292 |                         </span>
1293 |                       </div>
1294 |                     ))
1295 |                   )}
1296 |                 </div>
1297 | 
1298 |               </div>
1299 |             </div>
1300 | 
1301 |             {/* Footer */}
1302 |             <div className="p-4 border-t border-[#1f1f1f] bg-[#0d0d0d] grid grid-cols-2 gap-3">
1303 |               <button
1304 |                 onClick={() => { handleCloseConfigPanel(); }}
1305 |                 className="py-2.5 border border-[#1f1f1f] text-xs font-semibold text-neutral-400 hover:text-white rounded-lg transition-colors font-mono cursor-pointer"
1306 |               >
1307 |                 Close
1308 |               </button>
1309 |               <button
1310 |                 onClick={() => {
1311 |                   alert("Agent configuration saved.");
1312 |                   handleCloseConfigPanel();
1313 |                 }}
1314 |                 className="py-2.5 bg-white hover:bg-neutral-100 text-black text-xs font-bold rounded-lg transition-all font-mono cursor-pointer"
1315 |               >
1316 |                 Save Config
1317 |               </button>
1318 |             </div>
1319 |           </div>
1320 |         ) : (
1321 |           <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
1322 |             <Bot className="w-12 h-12 text-neutral-700 mb-3 animate-pulse" />
1323 |             <p className="text-xs text-neutral-500">Click any agent node in the Flow to edit its configuration.</p>
1324 |           </div>
1325 |         )}
1326 |         </div>
1327 |       )}
1328 | 
1329 |       {/* 4. Modals & Overlays */}
1330 |       <AnimatePresence>
1331 | 
1332 |         {/* BYOK MODAL */}
1333 |         {isSecretOpen && (
1334 |           <motion.div
1335 |             initial={{ opacity: 0 }}
1336 |             animate={{ opacity: 1 }}
1337 |             exit={{ opacity: 0 }}
1338 |             className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-6 select-none"
1339 |           >
1340 |             <motion.div
1341 |               initial={{ scale: 0.95 }}
1342 |               animate={{ scale: 1 }}
1343 |               exit={{ scale: 0.95 }}
1344 |               className="w-full max-w-md bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl p-6 relative shadow-2xl"
1345 |             >
1346 |               <button onClick={() => setIsSecretOpen(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white cursor-pointer">
1347 |                 <X className="w-5 h-5" />
1348 |               </button>
1349 |               <div className="flex gap-4 items-center mb-6">
1350 |                 <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
1351 |                   <Key className="w-6 h-6 text-white" />
1352 |                 </div>
1353 |                 <div>
1354 |                   <h3 className="text-sm font-bold text-white">AI Engine Settings</h3>
1355 |                   <p className="text-xs text-neutral-400 font-sans mt-0.5">Select your AI provider and configure keys.</p>
1356 |                 </div>
1357 |               </div>
1358 |               <div className="space-y-4">
1359 |                 {/* 1. Provider Selector */}
1360 |                 <div className="space-y-1.5">
1361 |                   <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">Provider</label>
1362 |                   <select
1363 |                     value={selectedProvider}
1364 |                     onChange={(e) => setSelectedProvider(e.target.value)}
1365 |                     className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500"
1366 |                   >
1367 |                     {Object.keys(availableProviders).length > 0 ? (
1368 |                       Object.entries(availableProviders).map(([pid, cfg]: [string, any]) => (
1369 |                         <option key={pid} value={pid}>{cfg.name}</option>
1370 |                       ))
1371 |                     ) : (
1372 |                       <option value="gemini">Google Gemini</option>
1373 |                     )}
1374 |                   </select>
1375 |                 </div>
1376 | 
1377 |                 {/* 2. Model Selector */}
1378 |                 <div className="space-y-1.5">
1379 |                   <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">Model</label>
1380 |                   {availableProviders[selectedProvider]?.models?.length > 0 ? (
1381 |                     <select
1382 |                       value={selectedModel}
1383 |                       onChange={(e) => setSelectedModel(e.target.value)}
1384 |                       className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500"
1385 |                     >
1386 |                       {availableProviders[selectedProvider].models.map((m: any) => (
1387 |                         <option key={m.id} value={m.id}>{m.name} ({m.tier})</option>
1388 |                       ))}
1389 |                     </select>
1390 |                   ) : (
1391 |                     <input
1392 |                       type="text"
1393 |                       placeholder="e.g. llama3, qwen2.5, my-fine-tune"
1394 |                       value={selectedModel}
1395 |                       onChange={(e) => setSelectedModel(e.target.value)}
1396 |                       className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500"
1397 |                     />
1398 |                   )}
1399 |                 </div>
1400 | 
1401 |                 {/* 3. API Key Input */}
1402 |                 <div className="space-y-1.5">
1403 |                   <div className="flex justify-between items-center">
1404 |                     <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">
1405 |                       {selectedProvider.toUpperCase()}_API_KEY
1406 |                     </label>
1407 |                     {availableProviders[selectedProvider]?.key_url && (
1408 |                       <a
1409 |                         href={availableProviders[selectedProvider].key_url}
1410 |                         target="_blank"
1411 |                         rel="noreferrer"
1412 |                         className="text-[9px] text-cyan-400 hover:underline"
1413 |                       >
1414 |                         Get key ↗
1415 |                       </a>
1416 |                     )}
1417 |                   </div>
1418 |                   <input
1419 |                     id="api-key-input"
1420 |                     type="password"
1421 |                     placeholder={
1422 |                       availableProviders[selectedProvider]
1423 |                         ? `Enter key (starts with ${availableProviders[selectedProvider].key_hint || "sk-..."})`
1424 |                         : "Enter API key"
1425 |                     }
1426 |                     value={apiKeyInput}
1427 |                     onChange={(e) => setApiKeyInput(e.target.value)}
1428 |                     className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500"
1429 |                   />
1430 |                   <p className="text-[9px] text-neutral-500 font-mono leading-normal">
1431 |                     {availableProviders[selectedProvider]?.description || "Configure key for custom models. Key is stored locally in-memory."}
1432 |                   </p>
1433 |                 </div>
1434 | 
1435 |                 {/* 4. Save and Cancel Buttons */}
1436 |                 <div className="pt-4 flex gap-3">
1437 |                   <button
1438 |                     id="save-api-key-btn"
1439 |                     onClick={() => {
1440 |                       setProvider(selectedProvider);
1441 |                       setModel(selectedModel);
1442 |                       setProviderApiKey(selectedProvider, apiKeyInput.trim());
1443 |                       setIsSecretOpen(false);
1444 |                     }}
1445 |                     className="flex-1 py-2.5 bg-white hover:bg-neutral-100 text-black font-bold rounded-xl text-xs font-mono transition-colors cursor-pointer"
1446 |                   >
1447 |                     Save Settings
1448 |                   </button>
1449 |                   <button
1450 |                     onClick={() => setIsSecretOpen(false)}
1451 |                     className="px-5 py-2.5 border border-[#1f1f1f] text-neutral-400 hover:text-white rounded-xl text-xs font-mono transition-colors cursor-pointer"
1452 |                   >
1453 |                     Cancel
1454 |                   </button>
1455 |                 </div>
1456 |               </div>
1457 |             </motion.div>
1458 |           </motion.div>
1459 |         )}
1460 | 
1461 |         {/* USER PROFILE MODAL */}
1462 |         {isProfileOpen && (
1463 |           <motion.div
1464 |             initial={{ opacity: 0 }}
1465 |             animate={{ opacity: 1 }}
1466 |             exit={{ opacity: 0 }}
1467 |             className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-6 select-none"
1468 |           >
1469 |             <motion.div
1470 |               initial={{ scale: 0.95 }}
1471 |               animate={{ scale: 1 }}
1472 |               exit={{ scale: 0.95 }}
1473 |               className="w-full max-w-sm bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl p-6 relative shadow-2xl"
1474 |             >
1475 |               <button onClick={() => setIsProfileOpen(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white cursor-pointer">
1476 |                 <X className="w-5 h-5" />
1477 |               </button>
1478 |               <div className="flex flex-col items-center text-center space-y-4 py-4">
1479 |                 <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#1f1f1f] flex items-center justify-center bg-neutral-900">
1480 |                   <User className="w-8 h-8 text-neutral-500" />
1481 |                 </div>
1482 |                 <div>
1483 |                   <h3 className="text-sm font-bold text-white uppercase tracking-wider">User Profile</h3>
1484 |                   <span className="text-xs text-neutral-400 font-mono">solospace_user@gmail.com</span>
1485 |                 </div>
1486 |                 <div className="w-full pt-4 space-y-2 border-t border-[#141414]">
1487 |                   <div className="flex justify-between items-center bg-black py-2 px-3 rounded text-[10px] border border-[#141414] font-mono">
1488 |                     <span className="text-neutral-500">Plan:</span>
1489 |                     <span className="text-white font-bold">Pro</span>
1490 |                   </div>
1491 |                   <div className="flex justify-between items-center bg-black py-2 px-3 rounded text-[10px] border border-[#141414] font-mono">
1492 |                     <span className="text-neutral-500">Sessions:</span>
1493 |                     <span className="text-white font-bold">{Object.values(sessions).length}</span>
1494 |                   </div>
1495 |                 </div>
1496 |                 <button
1497 |                   onClick={() => setIsProfileOpen(false)}
1498 |                   className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-[#1f1f1f] text-neutral-300 hover:text-white font-bold rounded-xl text-xs font-mono transition-colors cursor-pointer"
1499 |                 >
1500 |                   Close
1501 |                 </button>
1502 |               </div>
1503 |             </motion.div>
1504 |           </motion.div>
1505 |         )}
1506 | 
1507 |         {/* TOOL APPROVAL TOAST */}
1508 |         {pendingApproval && (
1509 |           <div className="fixed bottom-6 right-6 w-96 bg-[#0d0d0d] border border-amber-500/50 shadow-[0_0_50px_rgba(245,158,11,0.15)] rounded-2xl p-5 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 select-none">
1510 |             <div className="flex gap-4 items-start">
1511 |               <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 shrink-0">
1512 |                 <Sliders className="w-5 h-5 animate-pulse" />
1513 |               </div>
1514 |               <div className="flex-1 space-y-2">
1515 |                 <div className="flex justify-between items-center">
1516 |                   <span className="text-[10px] font-bold text-amber-500 font-mono tracking-widest uppercase">Permission Required</span>
1517 |                   <span className="text-[9px] text-neutral-500 font-mono">Agent Tool</span>
1518 |                 </div>
1519 |                 <h4 className="text-xs font-bold text-white">
1520 |                   &apos;{(nodes.find(n => n.id === pendingApproval.nodeId)?.data as any)?.name}&apos; wants to use <span className="text-amber-400 font-mono">[{pendingApproval.toolName}]</span>
1521 |                 </h4>
1522 |                 <p className="text-[10px] text-neutral-400 leading-normal">
1523 |                   Action: <span className="text-white font-semibold">{pendingApproval.action}</span> — {pendingApproval.detail}
1524 |                 </p>
1525 |                 <div className="pt-3 flex gap-2">
1526 |                   <button
1527 |                     onClick={() => {
1528 |                       const sessId = pendingApproval.sessionId || activeSessionId || "";
1529 |                       fetch("/api/gemini/approve", {
1530 |                         method: "POST",
1531 |                         headers: { "Content-Type": "application/json" },
1532 |                         body: JSON.stringify({
1533 |                           sessionId: sessId,
1534 |                           nodeId: pendingApproval.nodeId,
1535 |                           toolName: pendingApproval.toolName,
1536 |                           action: "approve"
1537 |                         })
1538 |                       }).catch(e => console.error("Failed to approve tool:", e));
1539 | 
1540 |                       const node = nodes.find(n => n.id === pendingApproval.nodeId);
1541 |                       if (node) {
1542 |                         const updatedLogs = ((node.data as any).toolLogs || []).map((log: any) => {
1543 |                           if (log.id === pendingApproval.logId) {
1544 |                             return { ...log, status: "SUCCESS" as const, detail: `Approved: ${pendingApproval.detail}` };
1545 |                           }
1546 |                           return log;
1547 |                         });
1548 |                         updateNodeField(pendingApproval.nodeId, { toolLogs: updatedLogs });
1549 |                       }
1550 |                       useWorkflowStore.setState({ pendingApproval: null });
1551 |                     }}
1552 |                     className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-lg text-[10px] font-mono transition-colors cursor-pointer"
1553 |                   >
1554 |                     Approve
1555 |                   </button>
1556 |                   <button
1557 |                     onClick={() => {
1558 |                       const sessId = pendingApproval.sessionId || activeSessionId || "";
1559 |                       fetch("/api/gemini/approve", {
1560 |                         method: "POST",
1561 |                         headers: { "Content-Type": "application/json" },
1562 |                         body: JSON.stringify({
1563 |                           sessionId: sessId,
1564 |                           nodeId: pendingApproval.nodeId,
1565 |                           toolName: pendingApproval.toolName,
1566 |                           action: "deny"
1567 |                         })
1568 |                       }).catch(e => console.error("Failed to deny tool:", e));
1569 | 
1570 |                       const node = nodes.find(n => n.id === pendingApproval.nodeId);
1571 |                       if (node) {
1572 |                         const updatedLogs = ((node.data as any).toolLogs || []).map((log: any) => {
1573 |                           if (log.id === pendingApproval.logId) {
1574 |                             return { ...log, status: "BLOCKED" as const, detail: `Denied: ${pendingApproval.detail}` };
1575 |                           }
1576 |                           return log;
1577 |                         });
1578 |                         updateNodeField(pendingApproval.nodeId, { toolLogs: updatedLogs });
1579 |                       }
1580 |                       useWorkflowStore.setState({ pendingApproval: null });
1581 |                     }}
1582 |                     className="px-4 py-2 border border-[#1f1f1f] text-neutral-400 hover:text-white rounded-lg text-[10px] font-mono transition-colors cursor-pointer"
1583 |                   >
1584 |                     Deny
1585 |                   </button>
1586 |                 </div>
1587 |               </div>
1588 |             </div>
1589 |           </div>
1590 |         )}
1591 | 
1592 |       </AnimatePresence>
1593 |     </div>
1594 |   );
1595 | }
1596 |
```

### File: `Frontend/components/edges/CustomEdge.tsx`

> 134 lines | 3.9 KB

```tsx
  1 | import React, { useState } from 'react';
  2 | import { EdgeLabelRenderer, EdgeProps, getBezierPath } from '@xyflow/react';
  3 | import { X } from 'lucide-react';
  4 | import { useWorkflowStore } from '@/store/workflowStore';
  5 | 
  6 | export const CustomEdge = ({
  7 |   id,
  8 |   sourceX,
  9 |   sourceY,
 10 |   targetX,
 11 |   targetY,
 12 |   sourcePosition,
 13 |   targetPosition,
 14 |   style = {},
 15 |   markerEnd,
 16 |   source,
 17 |   target,
 18 | }: EdgeProps) => {
 19 |   const [isHovered, setIsHovered] = useState(false);
 20 |   const deleteEdge = useWorkflowStore((s) => s.deleteEdge);
 21 |   const edges = useWorkflowStore((s) => s.edges);  // Bug 6: needed for parallel edge offset
 22 | 
 23 |   // Bug 6: Calculate Y offset for parallel edges between the same pair of nodes
 24 |   const parallelEdges = edges.filter(
 25 |     e => (e.source === source && e.target === target) ||
 26 |          (e.source === target && e.target === source)
 27 |   );
 28 |   const edgeIndex = parallelEdges.findIndex(e => e.id === id);
 29 |   const totalParallel = parallelEdges.length;
 30 |   const offset = totalParallel > 1 ? (edgeIndex - (totalParallel - 1) / 2) * 25 : 0;
 31 | 
 32 |   const [edgePath, labelX, labelY] = getBezierPath({
 33 |     sourceX,
 34 |     sourceY: sourceY + offset,  // Bug 6: offset to separate parallel edges
 35 |     targetX,
 36 |     targetY: targetY + offset,  // Bug 6: offset to separate parallel edges
 37 |     sourcePosition,
 38 |     targetPosition,
 39 |   });
 40 | 
 41 |   const strokeColor = (style as any).stroke || '#06b6d4'; // default cyan neon
 42 | 
 43 |   return (
 44 |     <g 
 45 |       onMouseEnter={() => setIsHovered(true)} 
 46 |       onMouseLeave={() => setIsHovered(false)}
 47 |       className="group"
 48 |     >
 49 |       {/* Bug 5: Arrow marker definition — unique per edge id to avoid conflicts */}
 50 |       <defs>
 51 |         <marker
 52 |           id={`arrowhead-${id}`}
 53 |           viewBox="0 0 10 10"
 54 |           refX="9"
 55 |           refY="5"
 56 |           markerWidth="7"
 57 |           markerHeight="7"
 58 |           orient="auto"
 59 |         >
 60 |           <path
 61 |             d="M 0 0 L 10 5 L 0 10 z"
 62 |             fill={strokeColor}
 63 |             opacity={isHovered ? 1 : 0.75}
 64 |           />
 65 |         </marker>
 66 |       </defs>
 67 | 
 68 |       {/* Background thicker glow path */}
 69 |       <path
 70 |         id={`${id}-glow`}
 71 |         className="react-flow__edge-path-glow"
 72 |         d={edgePath}
 73 |         fill="none"
 74 |         stroke={strokeColor}
 75 |         strokeWidth={6}
 76 |         strokeOpacity={isHovered ? 0.35 : 0.15}
 77 |         style={{
 78 |           transition: 'stroke-width 0.2s, stroke-opacity 0.2s',
 79 |           filter: `drop-shadow(0 0 4px ${strokeColor})`,
 80 |         }}
 81 |       />
 82 | 
 83 |       {/* Main Core Path — Bug 5: markerEnd for directional arrow */}
 84 |       <path
 85 |         id={id}
 86 |         className="react-flow__edge-path connection-line"
 87 |         d={edgePath}
 88 |         fill="none"
 89 |         stroke={strokeColor}
 90 |         strokeWidth={isHovered ? 2.5 : 1.5}
 91 |         markerEnd={`url(#arrowhead-${id})`}
 92 |         style={{
 93 |           transition: 'stroke-width 0.2s',
 94 |           ...style,
 95 |         }}
 96 |       />
 97 | 
 98 |       {/* Invisible thicker interaction path for easier hovering */}
 99 |       <path
100 |         d={edgePath}
101 |         fill="none"
102 |         stroke="transparent"
103 |         strokeWidth={15}
104 |         className="cursor-pointer"
105 |       />
106 | 
107 |       {/* Delete Button Label overlay */}
108 |       {isHovered && (
109 |         <EdgeLabelRenderer>
110 |           <div
111 |             style={{
112 |               position: 'absolute',
113 |               transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
114 |               pointerEvents: 'all',
115 |             }}
116 |             className="nodrag nopan z-40"
117 |           >
118 |             <button
119 |               onClick={(e) => {
120 |                 e.stopPropagation();
121 |                 deleteEdge(id);
122 |               }}
123 |               className="w-5 h-5 rounded-full bg-[#0d0d0d] border border-[#1f1f1f] text-neutral-400 hover:text-red-400 flex items-center justify-center shadow-lg transition-all hover:scale-115 active:scale-95 cursor-pointer"
124 |               title="Delete connection"
125 |             >
126 |               <X className="w-3 h-3 stroke-[2.5]" />
127 |             </button>
128 |           </div>
129 |         </EdgeLabelRenderer>
130 |       )}
131 |     </g>
132 |   );
133 | };
134 |
```

### File: `Frontend/components/nodes/CustomNode.tsx`

> 199 lines | 8.0 KB

```tsx
  1 | import React, { useState } from 'react';
  2 | import { Handle, Position, NodeProps } from '@xyflow/react';
  3 | import { 
  4 |   Bot, 
  5 |   FlaskConical, 
  6 |   Code, 
  7 |   TrendingUp, 
  8 |   Edit, 
  9 |   Trash2, 
 10 |   Maximize
 11 | } from 'lucide-react';
 12 | import { useWorkflowStore, CanvasNodeData } from '@/store/workflowStore';
 13 | 
 14 | export const CustomNode = ({ id, data, selected }: NodeProps & { data: CanvasNodeData; selected?: boolean }) => {
 15 |   const [isHovered, setIsHovered] = useState(false);
 16 |   const [droppedPulse, setDroppedPulse] = useState(false);
 17 |   
 18 |   const deleteNode = useWorkflowStore((s) => s.deleteNode);
 19 |   const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
 20 |   const updateNodeField = useWorkflowStore((s) => s.updateNodeField);
 21 | 
 22 |   // Icon selector
 23 |   const renderIcon = (iconName: string) => {
 24 |     switch (iconName) {
 25 |       case 'science': return <FlaskConical className="w-4 h-4 text-white" />;
 26 |       case 'code': return <Code className="w-4 h-4 text-white" />;
 27 |       case 'trending_up': return <TrendingUp className="w-4 h-4 text-white" />;
 28 |       default: return <Bot className="w-4 h-4 text-white" />;
 29 |     }
 30 |   };
 31 | 
 32 |   const handleDragOver = (e: React.DragEvent) => {
 33 |     e.preventDefault();
 34 |   };
 35 | 
 36 |   const handleDropTool = (e: React.DragEvent) => {
 37 |     e.preventDefault();
 38 |     const toolName = e.dataTransfer.getData('toolName');
 39 |     if (!toolName) return;
 40 | 
 41 |     const currentTools = data.tools || [];
 42 |     if (!currentTools.includes(toolName)) {
 43 |       const updatedTools = [...currentTools, toolName];
 44 |       const permissions = data.toolPermissions || {};
 45 |       const updatedPerms = { ...permissions, [toolName]: permissions[toolName] || 'ALLOWED' };
 46 |       
 47 |       updateNodeField(id, {
 48 |         tools: updatedTools,
 49 |         toolPermissions: updatedPerms
 50 |       });
 51 |       
 52 |       // Visual feedback pulse
 53 |       setDroppedPulse(true);
 54 |       setTimeout(() => setDroppedPulse(false), 1000);
 55 |     }
 56 |   };
 57 | 
 58 |   const handleFocus = (e: React.MouseEvent) => {
 59 |     e.stopPropagation();
 60 |     setSelectedNodeId(id);
 61 |   };
 62 | 
 63 |   const isNodeEnabled = data.enabled !== false;
 64 |   const isActive = isNodeEnabled && (data.status === 'ACTIVE' || data.status === 'PROCESSING' || data.status === 'SCANNING WEB');
 65 |   const isError = data.status === 'ERROR';
 66 | 
 67 |   return (
 68 |     <div
 69 |       onMouseEnter={() => setIsHovered(true)}
 70 |       onMouseLeave={() => setIsHovered(false)}
 71 |       onDragOver={handleDragOver}
 72 |       onDrop={handleDropTool}
 73 |       onClick={() => {
 74 |         setSelectedNodeId(id);
 75 |       }}
 76 |       className={`relative w-60 glass-panel rounded-xl p-4 cursor-grab active:cursor-grabbing select-none transition-all duration-150 ${
 77 |         selected ? 'ring-1 ring-white border-white scale-[1.01] bg-[#0c0c0c]/90 shadow-2xl' : ''
 78 |       } ${
 79 |         droppedPulse ? 'ring-2 ring-emerald-500 border-emerald-500 scale-105' : ''
 80 |       } ${
 81 |         isActive ? 'node-active-pulse' : ''
 82 |       } ${
 83 |         isError ? 'border-rose-500/60 ring-1 ring-rose-500/30' : ''
 84 |       } ${
 85 |         !isNodeEnabled ? 'opacity-40 grayscale border-dashed border-neutral-700 bg-[#050505] saturate-0' : ''
 86 |       }`}
 87 |     >
 88 |       {!isNodeEnabled && (
 89 |         <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-neutral-900 border border-neutral-700 rounded text-[7px] font-mono text-neutral-400 uppercase tracking-widest font-bold z-10 select-none">
 90 |           Disabled
 91 |         </div>
 92 |       )}
 93 |       {isError && !isActive && (
 94 |         <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-rose-950 border border-rose-800 rounded text-[7px] font-mono text-rose-400 uppercase tracking-widest font-bold z-10 select-none">
 95 |           Failed
 96 |         </div>
 97 |       )}
 98 |       {/* Floating Hover Controls Panel */}
 99 |       {isHovered && (
100 |         <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center bg-[#0d0d0d] border border-[#1f1f1f] p-1 rounded-lg gap-1 shadow-lg pointer-events-auto z-30 animate-in fade-in zoom-in-95 duration-150">
101 |           <button 
102 |             onClick={(e) => {
103 |               e.stopPropagation();
104 |               setSelectedNodeId(id);
105 |             }}
106 |             className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white cursor-pointer"
107 |             title="Edit Configuration"
108 |           >
109 |             <Edit className="w-3.5 h-3.5" />
110 |           </button>
111 |           <button 
112 |             onClick={handleFocus}
113 |             className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white cursor-pointer"
114 |             title="Select Node"
115 |           >
116 |             <Maximize className="w-3.5 h-3.5" />
117 |           </button>
118 |           <button 
119 |             onClick={(e) => {
120 |               e.stopPropagation();
121 |               deleteNode(id);
122 |             }}
123 |             className="p-1 hover:bg-red-950 hover:text-red-400 rounded text-neutral-400 cursor-pointer"
124 |             title="Delete Agent"
125 |           >
126 |             <Trash2 className="w-3.5 h-3.5" />
127 |           </button>
128 |         </div>
129 |       )}
130 | 
131 |       {/* ─── Target Handle (Left — Input Port) ─── */}
132 |       <div
133 |         className="absolute group/handle-in"
134 |         style={{ top: '14px', left: '-8px', zIndex: 10 }}
135 |       >
136 |         <Handle
137 |           type="target"
138 |           position={Position.Left}
139 |           id="input"
140 |           isConnectable={true}
141 |           className="!w-3 !h-3 !bg-black !border-2 !border-rose-500 !rounded-full !shadow-[0_0_10px_rgba(244,63,94,0.6)] !transition-all hover:!scale-150 hover:!bg-rose-500"
142 |         />
143 |         {/* IN label — appears on hover */}
144 |         <span className="pointer-events-none select-none absolute left-5 top-1/2 -translate-y-1/2 text-[8px] font-mono font-bold text-rose-400 bg-rose-950/90 border border-rose-500/30 px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover/handle-in:opacity-100 transition-opacity duration-150">
145 |           IN
146 |         </span>
147 |       </div>
148 | 
149 |       {/* ─── Source Handle (Right — Output Port) ─── */}
150 |       <div
151 |         className="absolute group/handle-out flex items-center"
152 |         style={{ top: '14px', right: '-8px', zIndex: 10 }}
153 |       >
154 |         {/* OUT label — appears on hover */}
155 |         <span className="pointer-events-none select-none absolute right-5 top-1/2 -translate-y-1/2 text-[8px] font-mono font-bold text-emerald-400 bg-emerald-950/90 border border-emerald-500/30 px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover/handle-out:opacity-100 transition-opacity duration-150">
156 |           OUT
157 |         </span>
158 |         <Handle
159 |           type="source"
160 |           position={Position.Right}
161 |           id="output"
162 |           isConnectable={true}
163 |           className="!w-3 !h-3 !bg-black !border-2 !border-emerald-500 !rounded-full !shadow-[0_0_10px_rgba(16,185,129,0.6)] !transition-all hover:!scale-150 hover:!bg-emerald-500"
164 |         />
165 |       </div>
166 | 
167 |       {/* Node Header */}
168 |       <div className="flex items-center gap-2.5 mb-2.5">
169 |         <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center border border-[#1f1f1f] shrink-0">
170 |           {renderIcon(data.icon)}
171 |         </div>
172 |         <div className="min-w-0">
173 |           <h4 className="text-xs font-bold text-white tracking-tight truncate">{data.name}</h4>
174 |           <span className="text-[8px] font-mono text-neutral-500 uppercase tracking-wider block leading-none mt-0.5">{data.tag || 'AGENT_NODE'}</span>
175 |         </div>
176 |       </div>
177 | 
178 |       {/* Description / Objective */}
179 |       <p className="text-[10px] text-neutral-400 line-clamp-2 leading-relaxed">{data.objective}</p>
180 | 
181 |       {/* Bulleted Instruction Rules (Antigravity Rules Style) */}
182 |       {data.rules && data.rules.length > 0 && (
183 |         <ul className="mt-3 pt-2.5 border-t border-[#141414] space-y-1 list-disc list-inside text-[9px] text-neutral-400 font-sans leading-normal">
184 |           {data.rules.slice(0, 3).map((rule, idx) => (
185 |             <li key={idx} className="truncate text-neutral-400/90 pl-0.5" title={rule}>
186 |               {rule}
187 |             </li>
188 |           ))}
189 |           {data.rules.length > 3 && (
190 |             <li className="list-none text-neutral-600 text-[8px] italic pl-2 mt-0.5">
191 |               + {data.rules.length - 3} more constraints
192 |             </li>
193 |           )}
194 |         </ul>
195 |       )}
196 |     </div>
197 |   );
198 | };
199 |
```

### File: `Frontend/components/nodes/GroupNode.tsx`

> 36 lines | 1.4 KB

```tsx
 1 | import React from 'react';
 2 | import { NodeProps } from '@xyflow/react';
 3 | import { Trash2 } from 'lucide-react';
 4 | import { useWorkflowStore } from '@/store/workflowStore';
 5 | 
 6 | export const GroupNode = ({ id, data, selected }: NodeProps & { data: { name: string }; selected?: boolean }) => {
 7 |   const deleteNode = useWorkflowStore((s) => s.deleteNode);
 8 | 
 9 |   return (
10 |     <div
11 |       className={`w-full h-full rounded-2xl border-2 border-dashed transition-all duration-150 relative bg-neutral-950/20 backdrop-blur-[2px] ${
12 |         selected 
13 |           ? 'border-cyan-400 bg-cyan-950/5 shadow-[0_0_15px_rgba(6,182,212,0.15)]' 
14 |           : 'border-neutral-800 hover:border-neutral-600'
15 |       }`}
16 |       style={{ minWidth: 200, minHeight: 150 }}
17 |     >
18 |       {/* Top Header Tag */}
19 |       <div className="absolute -top-3.5 left-4 px-2 py-0.5 bg-[#0a0a0a] border border-[#1f1f1f] rounded-md text-[9px] font-mono font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2 select-none">
20 |         <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
21 |         <span>{data.name || 'Agent Cluster Group'}</span>
22 |         <button
23 |           onClick={(e) => {
24 |             e.stopPropagation();
25 |             deleteNode(id);
26 |           }}
27 |           className="text-neutral-600 hover:text-red-400 ml-1.5 transition-colors"
28 |           title="Delete Group"
29 |         >
30 |           <Trash2 className="w-2.5 h-2.5" />
31 |         </button>
32 |       </div>
33 |     </div>
34 |   );
35 | };
36 |
```

### File: `Frontend/components/ContextMenu.tsx`

> 191 lines | 6.4 KB

```tsx
  1 | import React, { useEffect, useRef } from 'react';
  2 | import { 
  3 |   Trash2, 
  4 |   Power, 
  5 |   Plus, 
  6 |   FolderPlus, 
  7 |   Maximize, 
  8 |   RefreshCw 
  9 | } from 'lucide-react';
 10 | import { useWorkflowStore } from '@/store/workflowStore';
 11 | import { Node } from '@xyflow/react';
 12 | 
 13 | interface ContextMenuProps {
 14 |   x: number;
 15 |   y: number;
 16 |   node: Node | null;
 17 |   onClose: () => void;
 18 | }
 19 | 
 20 | export const ContextMenu = ({ x, y, node, onClose }: ContextMenuProps) => {
 21 |   const menuRef = useRef<HTMLDivElement>(null);
 22 |   
 23 |   const addNode = useWorkflowStore((s) => s.addNode);
 24 |   const deleteNode = useWorkflowStore((s) => s.deleteNode);
 25 |   const updateNodeField = useWorkflowStore((s) => s.updateNodeField);
 26 |   const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
 27 |   const setNodes = useWorkflowStore((s) => s.setNodes);
 28 |   const setEdges = useWorkflowStore((s) => s.setEdges);
 29 | 
 30 |   // Close when clicking outside
 31 |   useEffect(() => {
 32 |     const handleOutsideClick = (e: MouseEvent) => {
 33 |       if (menuRef.current && !menuRef.current.contains(e.target as Element)) {
 34 |         onClose();
 35 |       }
 36 |     };
 37 |     document.addEventListener('click', handleOutsideClick);
 38 |     document.addEventListener('contextmenu', handleOutsideClick);
 39 |     return () => {
 40 |       document.removeEventListener('click', handleOutsideClick);
 41 |       document.removeEventListener('contextmenu', handleOutsideClick);
 42 |     };
 43 |   }, [onClose]);
 44 | 
 45 |   // Actions
 46 |   const handleAddAgent = () => {
 47 |     const randomId = `custom_agent_${Date.now().toString().slice(-4)}`;
 48 |     // Calculate canvas coordinates based on click coordinate (mock transformation)
 49 |     const newNode = {
 50 |       id: randomId,
 51 |       type: 'custom',
 52 |       position: { x: x - 400, y: y - 200 },
 53 |       data: {
 54 |         name: "New Agent Node",
 55 |         tag: "USER_CUSTOM_NODE",
 56 |         status: "IDLE" as const,
 57 |         metricLabel: "Tasks Completed",
 58 |         metricVal: "0",
 59 |         icon: "science",
 60 |         objective: "Enter agent goals...",
 61 |         personality: "Pragmatic, logical, responsive",
 62 |         systemPrompt: "You are a custom assistant. Fulfill user demands precisely.",
 63 |         rules: ["Verify actions before launching"],
 64 |         tools: ["Web Search"],
 65 |         temp: 0.5,
 66 |         logic: 80,
 67 |         empathy: 50,
 68 |         context: "128k",
 69 |         enabled: true,
 70 |         priority: 5,
 71 |         toolPermissions: {
 72 |           "Web Search": "ALLOWED" as const
 73 |         },
 74 |         toolLogs: []
 75 |       }
 76 |     };
 77 |     addNode(newNode);
 78 |     setSelectedNodeId(newNode.id);
 79 |     onClose();
 80 |   };
 81 | 
 82 |   const handleAddGroup = () => {
 83 |     const randomId = `group_${Date.now().toString().slice(-4)}`;
 84 |     const newGroup = {
 85 |       id: randomId,
 86 |       type: 'groupNode',
 87 |       position: { x: x - 450, y: y - 200 },
 88 |       style: { width: 350, height: 260 },
 89 |       data: {
 90 |         name: "Custom Cluster Group"
 91 |       }
 92 |     };
 93 |     addNode(newGroup);
 94 |     onClose();
 95 |   };
 96 | 
 97 |   const handleToggleEnable = () => {
 98 |     if (!node) return;
 99 |     updateNodeField(node.id, { enabled: !(node.data as any).enabled });
100 |     onClose();
101 |   };
102 | 
103 |   // Run Sandbox removed — real tool execution is handled by backend during orchestration
104 | 
105 |   const handleDelete = () => {
106 |     if (!node) return;
107 |     deleteNode(node.id);
108 |     onClose();
109 |   };
110 | 
111 |   const handleClearAll = () => {
112 |     if (confirm("Are you sure you want to clear all nodes and connections?")) {
113 |       setNodes([]);
114 |       setEdges([]);
115 |     }
116 |     onClose();
117 |   };
118 | 
119 |   return (
120 |     <div
121 |       ref={menuRef}
122 |       style={{ top: y, left: x }}
123 |       className="fixed z-50 min-w-48 bg-[#0d0d0d]/95 backdrop-blur-md border border-[#1f1f1f] rounded-lg shadow-2xl p-1.5 flex flex-col gap-0.5 select-none"
124 |     >
125 |       {node ? (
126 |         // Node specific menu items
127 |         <>
128 |           <div className="px-2.5 py-1 text-[9px] font-mono text-neutral-500 border-b border-[#141414] mb-1 font-bold uppercase truncate max-w-48">
129 |             Node: {(node.data as any).name}
130 |           </div>
131 |           
132 |           <button
133 |             onClick={() => {
134 |               setSelectedNodeId(node.id);
135 |               onClose();
136 |             }}
137 |             className="w-full text-left px-2.5 py-2 text-xs text-neutral-300 hover:text-white hover:bg-neutral-900 rounded-md transition-colors flex items-center gap-2 cursor-pointer font-medium"
138 |           >
139 |             <Maximize className="w-3.5 h-3.5" />
140 |             <span>Configure Agent</span>
141 |           </button>
142 |           
143 | 
144 |           <button
145 |             onClick={handleToggleEnable}
146 |             className="w-full text-left px-2.5 py-2 text-xs text-neutral-300 hover:text-white hover:bg-neutral-900 rounded-md transition-colors flex items-center gap-2 cursor-pointer font-medium"
147 |           >
148 |             <Power className={`w-3.5 h-3.5 ${(node.data as any).enabled ? 'text-amber-500' : 'text-emerald-500'}`} />
149 |             <span>{(node.data as any).enabled ? 'Disable Node' : 'Enable Node'}</span>
150 |           </button>
151 |           
152 |           <button
153 |             onClick={handleDelete}
154 |             className="w-full text-left px-2.5 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-md transition-colors flex items-center gap-2 cursor-pointer border-t border-[#141414] mt-1 pt-1.5 font-medium"
155 |           >
156 |             <Trash2 className="w-3.5 h-3.5" />
157 |             <span>Delete Node</span>
158 |           </button>
159 |         </>
160 |       ) : (
161 |         // Canvas/Pane specific menu items
162 |         <>
163 |           <button
164 |             onClick={handleAddAgent}
165 |             className="w-full text-left px-2.5 py-2 text-xs text-neutral-300 hover:text-white hover:bg-neutral-900 rounded-md transition-colors flex items-center gap-2 cursor-pointer font-medium"
166 |           >
167 |             <Plus className="w-3.5 h-3.5 text-cyan-400" />
168 |             <span>Add Agent Node</span>
169 |           </button>
170 |           
171 |           <button
172 |             onClick={handleAddGroup}
173 |             className="w-full text-left px-2.5 py-2 text-xs text-neutral-300 hover:text-white hover:bg-neutral-900 rounded-md transition-colors flex items-center gap-2 cursor-pointer font-medium"
174 |           >
175 |             <FolderPlus className="w-3.5 h-3.5 text-purple-400" />
176 |             <span>Add Cluster Group</span>
177 |           </button>
178 |           
179 |           <button
180 |             onClick={handleClearAll}
181 |             className="w-full text-left px-2.5 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-md transition-colors flex items-center gap-2 cursor-pointer border-t border-[#141414] mt-1 pt-1.5 font-medium"
182 |           >
183 |             <RefreshCw className="w-3.5 h-3.5" />
184 |             <span>Clear Canvas</span>
185 |           </button>
186 |         </>
187 |       )}
188 |     </div>
189 |   );
190 | };
191 |
```

### File: `Frontend/components/FlowArena.tsx`

> 356 lines | 12.1 KB

```tsx
  1 | import React, { useState, useCallback, useEffect } from 'react';
  2 | import { 
  3 |   ReactFlow, 
  4 |   Background, 
  5 |   BackgroundVariant, 
  6 |   MiniMap, 
  7 |   Panel, 
  8 |   useReactFlow,
  9 |   reconnectEdge,
 10 |   Connection,
 11 |   Edge,
 12 |   Node,
 13 |   Viewport
 14 | } from '@xyflow/react';
 15 | import { Plus, Minus, Maximize, PlusCircle, LayoutGrid } from 'lucide-react';
 16 | import { useWorkflowStore, CanvasNodeData } from '@/store/workflowStore';
 17 | import { CustomNode } from './nodes/CustomNode';
 18 | import { GroupNode } from './nodes/GroupNode';
 19 | import { CustomEdge } from './edges/CustomEdge';
 20 | import { ContextMenu } from './ContextMenu';
 21 | import dagre from 'dagre';
 22 | 
 23 | const nodeTypes = {
 24 |   custom: CustomNode,
 25 |   groupNode: GroupNode,
 26 | };
 27 | 
 28 | const edgeTypes = {
 29 |   custom: CustomEdge,
 30 | };
 31 | 
 32 | const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
 33 |   const dagreGraph = new dagre.graphlib.Graph();
 34 |   dagreGraph.setDefaultEdgeLabel(() => ({}));
 35 |   dagreGraph.setGraph({ rankdir: 'LR', nodesep: 150, ranksep: 200 });
 36 | 
 37 |   nodes.forEach((node) => {
 38 |     dagreGraph.setNode(node.id, { width: 240, height: 220 });
 39 |   });
 40 | 
 41 |   edges.forEach((edge) => {
 42 |     dagreGraph.setEdge(edge.source, edge.target);
 43 |   });
 44 | 
 45 |   dagre.layout(dagreGraph);
 46 | 
 47 |   const layoutedNodes = nodes.map((node) => {
 48 |     const nodeWithPosition = dagreGraph.node(node.id);
 49 |     return {
 50 |       ...node,
 51 |       position: {
 52 |         x: nodeWithPosition.x - 120,
 53 |         y: nodeWithPosition.y - 110,
 54 |       },
 55 |     };
 56 |   });
 57 |   return { nodes: layoutedNodes, edges };
 58 | };
 59 | 
 60 | export default function FlowArena() {
 61 |   const { zoomIn, zoomOut, setViewport, getViewport, fitView } = useReactFlow();
 62 |   
 63 |   const nodes = useWorkflowStore((s) => s.nodes);
 64 |   const edges = useWorkflowStore((s) => s.edges);
 65 |   const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
 66 |   const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
 67 |   const onConnect = useWorkflowStore((s) => s.onConnect);
 68 |   const setEdges = useWorkflowStore((s) => s.setEdges);
 69 |   const setNodes = useWorkflowStore((s) => s.setNodes);
 70 |   const addNode = useWorkflowStore((s) => s.addNode);
 71 |   const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
 72 |   const isOrchestrating = useWorkflowStore((s) => s.isOrchestrating);
 73 | 
 74 |   const [initialLayoutDone, setInitialLayoutDone] = useState(false);
 75 | 
 76 |   // Context Menu State
 77 |   const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: Node | null } | null>(null);
 78 | 
 79 |   // Reconnection state
 80 |   const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
 81 |     setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));
 82 |   }, [setEdges]);
 83 | 
 84 |   // Context Menu triggers
 85 |   const onNodeContextMenu = useCallback((event: any, node: Node) => {
 86 |     event.preventDefault();
 87 |     setContextMenu({
 88 |       x: event.clientX,
 89 |       y: event.clientY,
 90 |       node,
 91 |     });
 92 |   }, []);
 93 | 
 94 |   const onPaneContextMenu = useCallback((event: any) => {
 95 |     event.preventDefault();
 96 |     setContextMenu({
 97 |       x: event.clientX,
 98 |       y: event.clientY,
 99 |       node: null,
100 |     });
101 |   }, []);
102 | 
103 |   const onPaneClick = useCallback(() => {
104 |     setContextMenu(null);
105 |   }, []);
106 | 
107 |   // Zoom/Viewport Controls
108 |   const handleZoomIn = () => {
109 |     zoomIn({ duration: 300 });
110 |   };
111 | 
112 |   const handleZoomOut = () => {
113 |     zoomOut({ duration: 300 });
114 |   };
115 | 
116 |   const handleResetView = () => {
117 |     setViewport({ x: 100, y: 50, zoom: 0.9 }, { duration: 400 });
118 |   };
119 | 
120 |   const applyLayout = useCallback(() => {
121 |     if (nodes.length === 0) return;
122 |     const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges);
123 |     setNodes(layoutedNodes);
124 |   }, [nodes, edges, setNodes]);
125 | 
126 |   // Layout nodes once initially when loaded
127 |   useEffect(() => {
128 |     if (!initialLayoutDone && nodes.length > 0) {
129 |       const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges);
130 |       setNodes(layoutedNodes);
131 |       setInitialLayoutDone(true);
132 |     }
133 |   }, [nodes, edges, initialLayoutDone, setNodes]);
134 | 
135 |   // Reset layout state if node length changes back to 0 (new chat)
136 |   useEffect(() => {
137 |     if (nodes.length === 0) {
138 |       setInitialLayoutDone(false);
139 |     }
140 |   }, [nodes.length]);
141 | 
142 |   // Auto-fit viewport on node count changes
143 |   useEffect(() => {
144 |     if (nodes.length > 0) {
145 |       const timer = setTimeout(() => {
146 |         fitView({ padding: 0.2, duration: 400 });
147 |       }, 300);
148 |       return () => clearTimeout(timer);
149 |     }
150 |   }, [nodes.length, fitView]);
151 | 
152 |   const handleAddAgentNode = () => {
153 |     const randomId = `custom_agent_${Date.now().toString().slice(-4)}`;
154 |     const view = getViewport();
155 |     // Center new node inside view coordinates
156 |     let x = (-view.x + window.innerWidth / 2 - 120) / view.zoom;
157 |     let y = (-view.y + window.innerHeight / 2 - 100) / view.zoom;
158 | 
159 |     // Avoid collision
160 |     const NODE_W = 240;
161 |     const NODE_H = 220;
162 |     const existingPositions = nodes.map(n => n.position);
163 |     for (const pos of existingPositions) {
164 |       if (Math.abs(x - pos.x) < NODE_W && Math.abs(y - pos.y) < NODE_H) {
165 |         y = pos.y + NODE_H + 40;
166 |       }
167 |     }
168 | 
169 |     const newNode = {
170 |       id: randomId,
171 |       type: 'custom',
172 |       position: { x: Math.max(50, x), y: Math.max(50, y) },
173 |       data: {
174 |         name: "Custom Agent Node",
175 |         tag: "USER_CUSTOM_NODE",
176 |         status: "IDLE" as const,
177 |         metricLabel: "Tasks Completed",
178 |         metricVal: "0",
179 |         icon: "science",
180 |         objective: "Enter agent goals...",
181 |         personality: "Pragmatic, logical, responsive",
182 |         systemPrompt: "You are a custom assistant. Fulfill user demands precisely.",
183 |         rules: ["Verify actions before launching"],
184 |         tools: ["Web Search"],
185 |         temp: 0.5,
186 |         logic: 80,
187 |         empathy: 50,
188 |         context: "128k",
189 |         enabled: true,
190 |         priority: 5,
191 |         toolPermissions: {
192 |           "Web Search": "ALLOWED" as const
193 |         },
194 |         toolLogs: []
195 |       }
196 |     };
197 |     addNode(newNode);
198 |     setSelectedNodeId(newNode.id);
199 |   };
200 | 
201 |   // Node styles for MiniMap representation
202 |   const getMiniMapNodeColor = (node: Node) => {
203 |     if (node.type === 'groupNode') return 'rgba(255, 255, 255, 0.03)';
204 |     const data = node.data as CanvasNodeData;
205 |     if (data && data.enabled === false) return '#262626';
206 |     if (data && (data.status === 'ACTIVE' || data.status === 'PROCESSING')) return '#06b6d4';
207 |     return '#404040';
208 |   };
209 | 
210 |   return (
211 |     <div className="w-full h-full flex-1 relative bg-black">
212 |       <ReactFlow
213 |         nodes={nodes}
214 |         edges={edges}
215 |         onNodesChange={onNodesChange}
216 |         onEdgesChange={onEdgesChange}
217 |         onConnect={onConnect}
218 |         onReconnect={onReconnect}
219 |         nodeTypes={nodeTypes}
220 |         edgeTypes={edgeTypes}
221 |         onNodeContextMenu={onNodeContextMenu}
222 |         onPaneContextMenu={onPaneContextMenu}
223 |         onPaneClick={onPaneClick}
224 |         snapToGrid={true}
225 |         snapGrid={[15, 15]}
226 |         fitViewOptions={{ padding: 0.2 }}
227 |         className="flow-arena-editor"
228 |         minZoom={0.2}
229 |         maxZoom={2.5}
230 |         defaultViewport={{ x: 100, y: 50, zoom: 0.9 }}
231 |       >
232 |         {/* Subtle grid background dots */}
233 |         <Background 
234 |           variant={BackgroundVariant.Dots} 
235 |           color="rgba(255, 255, 255, 0.06)" 
236 |           gap={24} 
237 |           size={1}
238 |         />
239 | 
240 |         {/* Custom Minimap Overlay */}
241 |         <MiniMap 
242 |           zoomable 
243 |           pannable 
244 |           nodeColor={getMiniMapNodeColor}
245 |           nodeStrokeWidth={3}
246 |           nodeBorderRadius={8}
247 |           maskColor="rgba(0, 0, 0, 0.65)"
248 |           className="!right-4 !top-4"
249 |         />
250 | 
251 |         {/* Custom Floating Zoom & Node controls */}
252 |         <Panel position="bottom-left" className="!left-4 !bottom-14 flex items-center bg-[#0d0d0d] border border-[#1f1f1f] p-1 rounded-xl z-20 shadow-2xl">
253 |           <button 
254 |             onClick={handleZoomIn}
255 |             className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors cursor-pointer"
256 |             title="Zoom In"
257 |           >
258 |             <Plus className="w-3.5 h-3.5" />
259 |           </button>
260 | 
261 |           <button 
262 |             onClick={handleZoomOut}
263 |             className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors cursor-pointer"
264 |             title="Zoom Out"
265 |           >
266 |             <Minus className="w-3.5 h-3.5" />
267 |           </button>
268 | 
269 |           <button 
270 |             onClick={handleResetView}
271 |             className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors border-l border-[#1f1f1f] ml-1 cursor-pointer"
272 |             title="Reset Viewport"
273 |           >
274 |             <Maximize className="w-3.5 h-3.5" />
275 |           </button>
276 | 
277 |           <button 
278 |             onClick={applyLayout}
279 |             className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors border-l border-[#1f1f1f] ml-1 cursor-pointer"
280 |             title="Auto Layout Graph"
281 |           >
282 |             <LayoutGrid className="w-3.5 h-3.5" />
283 |           </button>
284 | 
285 |           <button 
286 |             onClick={handleAddAgentNode}
287 |             className="p-2 text-white hover:bg-neutral-900 rounded-lg transition-colors border-l border-[#1f1f1f] ml-1 flex items-center gap-1 text-[10px] cursor-pointer"
288 |             title="Add Custom Agent Node"
289 |           >
290 |             <PlusCircle className="w-3.5 h-3.5 text-white" />
291 |             <span className="font-semibold pr-1">Node</span>
292 |           </button>
293 |         </Panel>
294 | 
295 |         {/* Right-click Context Menu */}
296 |         {contextMenu && (
297 |           <ContextMenu
298 |             x={contextMenu.x}
299 |             y={contextMenu.y}
300 |             node={contextMenu.node}
301 |             onClose={() => setContextMenu(null)}
302 |           />
303 |         )}
304 | 
305 |         {/* Connection hint — shown when nodes exist but no edges drawn yet */}
306 |         {nodes.length > 1 && edges.length === 0 && !isOrchestrating && (
307 |           <Panel position="top-right" className="!right-4 !top-16 select-none">
308 |             <div className="bg-[#0d0d0d]/92 border border-[#1f1f1f] rounded-xl p-3 backdrop-blur-md shadow-xl w-52">
309 |               <div className="flex items-center gap-2 mb-2.5">
310 |                 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
311 |                 <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider font-bold">How to Connect</span>
312 |               </div>
313 |               <div className="space-y-2 text-[10px] text-neutral-500 leading-relaxed">
314 |                 <div className="flex items-center gap-2">
315 |                   <span className="w-3 h-3 rounded-full bg-black border-2 border-emerald-500 shrink-0" />
316 |                   <span>Drag from <span className="text-emerald-400 font-semibold">green (OUT)</span></span>
317 |                 </div>
318 |                 <div className="flex items-center gap-2">
319 |                   <span className="w-3 h-3 rounded-full bg-black border-2 border-rose-500 shrink-0" />
320 |                   <span>Drop on <span className="text-rose-400 font-semibold">red (IN)</span></span>
321 |                 </div>
322 |                 <div className="flex items-center gap-2 pt-0.5 border-t border-[#141414] mt-1">
323 |                   <span className="w-5 h-0.5 bg-cyan-500 rounded shrink-0" />
324 |                   <span>Wire = agent dependency</span>
325 |                 </div>
326 |               </div>
327 |             </div>
328 |           </Panel>
329 |         )}
330 | 
331 |         {/* Persistent legend — bottom right */}
332 |         <Panel position="bottom-right" className="!right-4 !bottom-14 select-none">
333 |           <div className="bg-[#0d0d0d]/80 border border-[#1f1f1f] rounded-lg p-2.5 backdrop-blur-md shadow-xl text-[9px] font-mono text-neutral-600 space-y-1.5">
334 |             <div className="flex items-center gap-2">
335 |               <span className="w-2.5 h-2.5 rounded-full bg-black border-2 border-rose-500 shrink-0" />
336 |               <span>Input (data in)</span>
337 |             </div>
338 |             <div className="flex items-center gap-2">
339 |               <span className="w-2.5 h-2.5 rounded-full bg-black border-2 border-emerald-500 shrink-0" />
340 |               <span>Output (data out)</span>
341 |             </div>
342 |             <div className="flex items-center gap-2">
343 |               <span className="w-3.5 h-0.5 bg-cyan-500 rounded shrink-0" />
344 |               <span>Dependency wire</span>
345 |             </div>
346 |             <div className="flex items-center gap-2">
347 |               <span className="text-[8px] leading-none">✥</span>
348 |               <span>Drag card to reposition</span>
349 |             </div>
350 |           </div>
351 |         </Panel>
352 |       </ReactFlow>
353 |     </div>
354 |   );
355 | }
356 |
```

### File: `Frontend/components/MarkdownRenderer.tsx`

> 185 lines | 6.3 KB

```tsx
  1 | 'use client';
  2 | 
  3 | import React from "react";
  4 | import ReactMarkdown from "react-markdown";
  5 | import remarkGfm from "remark-gfm";
  6 | import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
  7 | import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
  8 | 
  9 | interface MarkdownRendererProps {
 10 |   content: string;
 11 |   className?: string;
 12 | }
 13 | 
 14 | export default function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
 15 |   return (
 16 |     <div className={`markdown-body ${className}`}>
 17 |       <ReactMarkdown
 18 |         remarkPlugins={[remarkGfm]}
 19 |         components={{
 20 |           // Code blocks
 21 |           code({ node, className, children, ...props }: any) {
 22 |             const match = /language-(\w+)/.exec(className || "");
 23 |             const isInline = !match && !String(children).includes("\n");
 24 | 
 25 |             if (isInline) {
 26 |               return (
 27 |                 <code
 28 |                   className="bg-neutral-800 text-cyan-300 px-1.5 py-0.5 rounded text-[0.82em] font-mono border border-neutral-700/60"
 29 |                   {...props}
 30 |                 >
 31 |                   {children}
 32 |                 </code>
 33 |               );
 34 |             }
 35 | 
 36 |             const language = match ? match[1] : "text";
 37 |             const codeString = String(children).replace(/\n$/, "");
 38 | 
 39 |             return (
 40 |               <div className="my-4 rounded-xl overflow-hidden border border-neutral-800 bg-[#0d0d0d]">
 41 |                 {/* Language badge header */}
 42 |                 <div className="flex items-center justify-between px-4 py-2 bg-neutral-900/80 border-b border-neutral-800">
 43 |                   <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
 44 |                     {language}
 45 |                   </span>
 46 |                   <button
 47 |                     onClick={() => navigator.clipboard.writeText(codeString)}
 48 |                     className="text-[10px] font-mono text-neutral-500 hover:text-white transition-colors cursor-pointer"
 49 |                   >
 50 |                     Copy
 51 |                   </button>
 52 |                 </div>
 53 |                 <SyntaxHighlighter
 54 |                   style={oneDark}
 55 |                   language={language}
 56 |                   PreTag="div"
 57 |                   customStyle={{
 58 |                     margin: 0,
 59 |                     padding: "1rem",
 60 |                     background: "transparent",
 61 |                     fontSize: "0.8rem",
 62 |                     lineHeight: "1.6",
 63 |                   }}
 64 |                   codeTagProps={{ style: { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" } }}
 65 |                 >
 66 |                   {codeString}
 67 |                 </SyntaxHighlighter>
 68 |               </div>
 69 |             );
 70 |           },
 71 | 
 72 |           // Headings
 73 |           h1: ({ children }) => (
 74 |             <h1 className="text-xl font-bold text-white mt-6 mb-3 pb-2 border-b border-neutral-800 leading-tight">
 75 |               {children}
 76 |             </h1>
 77 |           ),
 78 |           h2: ({ children }) => (
 79 |             <h2 className="text-base font-bold text-white mt-5 mb-2 leading-tight">
 80 |               {children}
 81 |             </h2>
 82 |           ),
 83 |           h3: ({ children }) => (
 84 |             <h3 className="text-sm font-semibold text-neutral-200 mt-4 mb-1.5 leading-tight">
 85 |               {children}
 86 |             </h3>
 87 |           ),
 88 |           h4: ({ children }) => (
 89 |             <h4 className="text-sm font-semibold text-neutral-300 mt-3 mb-1 leading-tight">
 90 |               {children}
 91 |             </h4>
 92 |           ),
 93 | 
 94 |           // Paragraph
 95 |           p: ({ children }) => (
 96 |             <p className="text-sm text-neutral-200 leading-relaxed mb-3">
 97 |               {children}
 98 |             </p>
 99 |           ),
100 | 
101 |           // Lists
102 |           ul: ({ children }) => (
103 |             <ul className="list-none space-y-1.5 mb-3 pl-0">
104 |               {children}
105 |             </ul>
106 |           ),
107 |           ol: ({ children }) => (
108 |             <ol className="list-decimal list-inside space-y-1.5 mb-3 pl-1">
109 |               {children}
110 |             </ol>
111 |           ),
112 |           li: ({ children, ordered }: any) => (
113 |             <li className="text-sm text-neutral-200 leading-relaxed flex gap-2 items-start">
114 |               {!ordered && (
115 |                 <span className="text-neutral-500 shrink-0 mt-0.5 select-none">▸</span>
116 |               )}
117 |               <span className="flex-1">{children}</span>
118 |             </li>
119 |           ),
120 | 
121 |           // Blockquote
122 |           blockquote: ({ children }) => (
123 |             <blockquote className="border-l-2 border-neutral-600 pl-4 my-3 text-sm text-neutral-400 italic">
124 |               {children}
125 |             </blockquote>
126 |           ),
127 | 
128 |           // Strong / Em
129 |           strong: ({ children }) => (
130 |             <strong className="font-semibold text-white">{children}</strong>
131 |           ),
132 |           em: ({ children }) => (
133 |             <em className="italic text-neutral-300">{children}</em>
134 |           ),
135 | 
136 |           // Horizontal rule
137 |           hr: () => (
138 |             <hr className="my-4 border-neutral-800" />
139 |           ),
140 | 
141 |           // Tables
142 |           table: ({ children }) => (
143 |             <div className="overflow-x-auto my-4 rounded-xl border border-neutral-800">
144 |               <table className="w-full text-sm border-collapse">{children}</table>
145 |             </div>
146 |           ),
147 |           thead: ({ children }) => (
148 |             <thead className="bg-neutral-900/60">{children}</thead>
149 |           ),
150 |           tbody: ({ children }) => (
151 |             <tbody className="divide-y divide-neutral-800/60">{children}</tbody>
152 |           ),
153 |           tr: ({ children }) => (
154 |             <tr className="hover:bg-neutral-900/30 transition-colors">{children}</tr>
155 |           ),
156 |           th: ({ children }) => (
157 |             <th className="px-4 py-2.5 text-left text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono border-b border-neutral-800">
158 |               {children}
159 |             </th>
160 |           ),
161 |           td: ({ children }) => (
162 |             <td className="px-4 py-2.5 text-xs text-neutral-300 leading-relaxed">
163 |               {children}
164 |             </td>
165 |           ),
166 | 
167 |           // Links
168 |           a: ({ href, children }) => (
169 |             <a
170 |               href={href}
171 |               target="_blank"
172 |               rel="noopener noreferrer"
173 |               className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
174 |             >
175 |               {children}
176 |             </a>
177 |           ),
178 |         }}
179 |       >
180 |         {content}
181 |       </ReactMarkdown>
182 |     </div>
183 |   );
184 | }
185 |
```

### File: `Frontend/store/workflowStore.ts`

> 969 lines | 30.2 KB

```typescript
  1 | import { create } from 'zustand';
  2 | import {
  3 |   Node,
  4 |   Edge,
  5 |   OnNodesChange,
  6 |   OnEdgesChange,
  7 |   OnConnect,
  8 |   applyNodeChanges,
  9 |   applyEdgeChanges,
 10 |   addEdge,
 11 |   Connection
 12 | } from '@xyflow/react';
 13 | 
 14 | export interface ToolLog {
 15 |   id: string;
 16 |   timestamp: string;
 17 |   tool: string;
 18 |   action: string;
 19 |   status: 'SUCCESS' | 'PENDING' | 'BLOCKED' | 'ERROR';
 20 |   detail: string;
 21 | }
 22 | 
 23 | export interface CanvasNodeData {
 24 |   name: string;
 25 |   tag: string;
 26 |   status: 'IDLE' | 'ACTIVE' | 'SCANNING WEB' | 'AUDITING' | 'QUEUED' | 'WAITING' | 'PROCESSING' | 'STANDBY' | 'DISABLED' | 'ERROR';
 27 |   metricLabel: string;
 28 |   metricVal: string;
 29 |   icon: string;
 30 |   objective: string;
 31 |   personality: string;
 32 |   systemPrompt: string;
 33 |   rules: string[];
 34 |   tools: string[];
 35 |   temp: number;
 36 |   logic: number;
 37 |   empathy: number;
 38 |   context: string;
 39 |   enabled: boolean;
 40 |   priority: number;
 41 |   toolPermissions?: Record<string, 'ALLOWED' | 'ASK' | 'DENIED'>;
 42 |   toolLogs?: ToolLog[];
 43 |   [key: string]: any;
 44 | }
 45 | 
 46 | export interface ChatMessage {
 47 |   id: string;
 48 |   sender: 'user' | 'ai';
 49 |   text: string;
 50 |   thinkingSummary?: string;
 51 |   timestamp: string;
 52 | }
 53 | 
 54 | export interface AgentTalkLog {
 55 |   id: string;
 56 |   senderId: string;
 57 |   senderName: string;
 58 |   senderIcon: string;
 59 |   text: string;
 60 |   timestamp: string;
 61 | }
 62 | 
 63 | export interface PendingApproval {
 64 |   sessionId?: string;
 65 |   nodeId: string;
 66 |   toolName: string;
 67 |   action: string;
 68 |   detail: string;
 69 |   logId: string;
 70 | }
 71 | 
 72 | export interface ChatSession {
 73 |   id: string;
 74 |   title: string;
 75 |   prompt: string;
 76 |   mode: 'auto' | 'custom';
 77 |   nodes: Node[];
 78 |   edges: Edge[];
 79 |   chatMessages: ChatMessage[];
 80 |   agentTalkLogs: AgentTalkLog[];
 81 |   executionState: 'setup' | 'running' | 'paused';
 82 |   statusMessage: string;
 83 |   followUpSuggestions?: string[];
 84 | }
 85 | 
 86 | export interface WorkflowState {
 87 |   sessions: Record<string, ChatSession>;
 88 |   activeSessionId: string | null;
 89 |   nodes: Node[];
 90 |   edges: Edge[];
 91 |   selectedNodeId: string | null;
 92 |   executionState: 'setup' | 'running' | 'paused';
 93 |   isOrchestrating: boolean;
 94 |   isThinking: boolean;
 95 |   statusMessage: string;
 96 |   chatMessages: ChatMessage[];
 97 |   agentTalkLogs: AgentTalkLog[];
 98 |   pendingApproval: PendingApproval | null;
 99 |   apiKey: string | null;
100 |   setApiKey: (key: string | null) => void;
101 |   provider: string;
102 |   model: string;
103 |   apiKeys: Record<string, string>;
104 |   availableProviders: Record<string, any>;
105 |   setProvider: (provider: string) => void;
106 |   setModel: (model: string) => void;
107 |   setProviderApiKey: (provider: string, key: string) => void;
108 |   fetchAvailableProviders: () => Promise<void>;
109 |   followUpSuggestions: string[];
110 |   liveThoughts: string;
111 |   abortController: AbortController | null;
112 |   cancelOrchestration: () => void;
113 | 
114 |   // Actions
115 |   setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
116 |   setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;
117 |   onNodesChange: OnNodesChange<Node>;
118 |   onEdgesChange: OnEdgesChange;
119 |   onConnect: OnConnect;
120 |   setSelectedNodeId: (id: string | null) => void;
121 |   updateNodeField: (nodeId: string, updates: Partial<CanvasNodeData>) => void;
122 |   addNode: (node: Node) => void;
123 |   deleteNode: (nodeId: string) => void;
124 |   deleteEdge: (edgeId: string) => void;
125 |   addRule: (nodeId: string, rule: string) => void;
126 |   deleteRule: (nodeId: string, ruleIndex: number) => void;
127 |   simulateToolExecution?: never;
128 |   setExecutionState: (state: 'setup' | 'running' | 'paused') => void;
129 |   setIsOrchestrating: (val: boolean) => void;
130 |   setIsThinking: (val: boolean) => void;
131 |   setStatusMessage: (msg: string) => void;
132 |   setChatMessages: (msgs: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
133 |   setAgentTalkLogs: (logs: AgentTalkLog[] | ((prev: AgentTalkLog[]) => AgentTalkLog[])) => void;
134 |   setPendingApproval: (val: PendingApproval | null) => void;
135 | 
136 |   // Session Actions
137 |   createSession: (prompt: string, mode: 'auto' | 'custom') => string;
138 |   switchSession: (sessionId: string) => void;
139 |   saveCurrentSession: () => void;
140 |   fetchSessions: () => Promise<void>;
141 |   loadSessionFromDb: (sessionId: string) => Promise<void>;
142 |   deleteSessionFromDb: (sessionId: string) => Promise<void>;
143 | 
144 |   triggerSteerOrchestration: (promptText: string, execute?: boolean) => void;
145 |   triggerCustomExecution: () => Promise<void>;
146 | }
147 | 
148 | let saveTimeout: any = null;
149 | const debounceSave = (currentSessionId: string, get: any, set: any) => {
150 |   if (saveTimeout) clearTimeout(saveTimeout);
151 |   saveTimeout = setTimeout(() => {
152 |     // Re-verify the session is still active before saving to prevent stale writes
153 |     const activeId = get().activeSessionId;
154 |     if (activeId !== currentSessionId) return;
155 | 
156 |     set((state: any) => {
157 |       // Only save if the session still exists
158 |       if (!state.sessions[currentSessionId]) return state;
159 | 
160 |       const currentSession = {
161 |         id: currentSessionId,
162 |         title: state.sessions[currentSessionId]?.title || "Chat",
163 |         prompt: state.sessions[currentSessionId]?.prompt || "",
164 |         mode: state.sessions[currentSessionId]?.mode || "auto",
165 |         nodes: state.nodes,
166 |         edges: state.edges,
167 |         chatMessages: state.chatMessages,
168 |         agentTalkLogs: state.agentTalkLogs,
169 |         executionState: state.executionState,
170 |         statusMessage: state.statusMessage,
171 |         followUpSuggestions: state.followUpSuggestions
172 |       };
173 |       return { sessions: { ...state.sessions, [currentSessionId]: currentSession } };
174 |     });
175 |   }, 500);
176 | };
177 | 
178 | export const useWorkflowStore = create<WorkflowState>((set, get) => ({
179 |   sessions: {},
180 |   activeSessionId: null,
181 |   nodes: [],
182 |   edges: [],
183 |   selectedNodeId: null,
184 |   executionState: 'setup',
185 |   isOrchestrating: false,
186 |   isThinking: false,
187 |   statusMessage: '',
188 |   chatMessages: [],
189 |   agentTalkLogs: [],
190 |   pendingApproval: null,
191 |   apiKey: null,
192 |   setApiKey: (key) => set({ apiKey: key }),
193 |   provider: "gemini",
194 |   model: "gemini-2.5-flash",
195 |   apiKeys: {},
196 |   availableProviders: {},
197 |   setProvider: (provider) => set({ provider }),
198 |   setModel: (model) => set({ model }),
199 |   setProviderApiKey: (provider, key) => set((state) => ({ apiKeys: { ...state.apiKeys, [provider]: key } })),
200 |   fetchAvailableProviders: async () => {
201 |     try {
202 |       const resp = await fetch("/api/gemini/providers");
203 |       if (resp.ok) {
204 |         const data = await resp.json();
205 |         set({ availableProviders: data });
206 |       }
207 |     } catch (e) {
208 |       console.error("Failed to fetch available providers", e);
209 |     }
210 |   },
211 |   followUpSuggestions: [],
212 |   liveThoughts: '',
213 |   abortController: null,
214 |   cancelOrchestration: () => {
215 |     const controller = get().abortController;
216 |     if (controller) {
217 |       controller.abort();
218 |       set({ abortController: null, isOrchestrating: false, isThinking: false });
219 |     }
220 |   },
221 | 
222 |   setNodes: (newNodes) => {
223 |     set((state) => ({
224 |       nodes: typeof newNodes === 'function' ? newNodes(state.nodes) : newNodes
225 |     }));
226 |     get().saveCurrentSession();
227 |   },
228 | 
229 |   setEdges: (newEdges) => {
230 |     set((state) => ({
231 |       edges: typeof newEdges === 'function' ? newEdges(state.edges) : newEdges
232 |     }));
233 |     get().saveCurrentSession();
234 |   },
235 | 
236 |   onNodesChange: (changes) => {
237 |     set((state) => ({
238 |       nodes: applyNodeChanges(changes, state.nodes)
239 |     }));
240 |     get().saveCurrentSession();
241 |   },
242 | 
243 |   onEdgesChange: (changes) => {
244 |     set((state) => ({
245 |       edges: applyEdgeChanges(changes, state.edges)
246 |     }));
247 |     get().saveCurrentSession();
248 |   },
249 | 
250 |   onConnect: (connection) => {
251 |     set((state) => {
252 |       const edge: Edge = {
253 |         ...connection,
254 |         id: `e-${connection.source}-${connection.target}`,
255 |         animated: true,
256 |         type: 'custom',
257 |         style: { stroke: '#06b6d4', strokeWidth: 2 }
258 |       };
259 | 
260 |       // Sync dependency: target node depends on source node
261 |       const updatedNodes = state.nodes.map(node => {
262 |         if (node.id === connection.target) {
263 |           const currentDeps = (node.data as any).dependencies || [];
264 |           if (!currentDeps.includes(connection.source)) {
265 |             return {
266 |               ...node,
267 |               data: { ...node.data, dependencies: [...currentDeps, connection.source] }
268 |             };
269 |           }
270 |         }
271 |         return node;
272 |       });
273 | 
274 |       return { edges: addEdge(edge, state.edges), nodes: updatedNodes };
275 |     });
276 |     get().saveCurrentSession();
277 |   },
278 | 
279 |   setSelectedNodeId: (id) => set({ selectedNodeId: id }),
280 | 
281 |   updateNodeField: (nodeId, updates) => {
282 |     set((state) => ({
283 |       nodes: state.nodes.map((node) => {
284 |         if (node.id === nodeId) {
285 |           return { ...node, data: { ...node.data, ...updates } };
286 |         }
287 |         return node;
288 |       })
289 |     }));
290 |     get().saveCurrentSession();
291 |   },
292 | 
293 |   addNode: (node) => {
294 |     set((state) => ({ nodes: [...state.nodes, node] }));
295 |     get().saveCurrentSession();
296 |   },
297 | 
298 |   deleteNode: (nodeId) => {
299 |     set((state) => ({
300 |       nodes: state.nodes.filter((node) => node.id !== nodeId),
301 |       edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
302 |       selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId
303 |     }));
304 |     get().saveCurrentSession();
305 |   },
306 | 
307 |   deleteEdge: (edgeId) => {
308 |     set((state) => {
309 |       const edge = state.edges.find(e => e.id === edgeId);
310 |       let updatedNodes = state.nodes;
311 | 
312 |       // Sync dependency: remove source from target's dependencies when edge deleted
313 |       if (edge) {
314 |         updatedNodes = state.nodes.map(node => {
315 |           if (node.id === edge.target) {
316 |             const currentDeps = (node.data as any).dependencies || [];
317 |             return {
318 |               ...node,
319 |               data: { ...node.data, dependencies: currentDeps.filter((d: string) => d !== edge.source) }
320 |             };
321 |           }
322 |           return node;
323 |         });
324 |       }
325 | 
326 |       return {
327 |         edges: state.edges.filter(e => e.id !== edgeId),
328 |         nodes: updatedNodes
329 |       };
330 |     });
331 |     get().saveCurrentSession();
332 |   },
333 | 
334 |   addRule: (nodeId, rule) => {
335 |     set((state) => ({
336 |       nodes: state.nodes.map((node) => {
337 |         if (node.id === nodeId) {
338 |           return {
339 |             ...node,
340 |             data: { ...node.data, rules: [...((node.data as any).rules || []), rule] }
341 |           };
342 |         }
343 |         return node;
344 |       })
345 |     }));
346 |     get().saveCurrentSession();
347 |   },
348 | 
349 |   deleteRule: (nodeId, ruleIndex) => {
350 |     set((state) => ({
351 |       nodes: state.nodes.map((node) => {
352 |         if (node.id === nodeId) {
353 |           return {
354 |             ...node,
355 |             data: {
356 |               ...node.data,
357 |               rules: ((node.data as any).rules || []).filter((_: any, idx: number) => idx !== ruleIndex)
358 |             }
359 |           };
360 |         }
361 |         return node;
362 |       })
363 |     }));
364 |     get().saveCurrentSession();
365 |   },
366 | 
367 |   // (simulateToolExecution removed — backend runs real tools)
368 | 
369 |   // State modifiers
370 |   setExecutionState: (state) => {
371 |     set({ executionState: state });
372 |     get().saveCurrentSession();
373 |   },
374 |   setIsOrchestrating: (val) => set({ isOrchestrating: val }),
375 |   setIsThinking: (val) => set({ isThinking: val }),
376 |   setStatusMessage: (msg) => {
377 |     set({ statusMessage: msg });
378 |     get().saveCurrentSession();
379 |   },
380 |   setChatMessages: (msgs) => {
381 |     set((state) => ({
382 |       chatMessages: typeof msgs === 'function' ? msgs(state.chatMessages) : msgs
383 |     }));
384 |     get().saveCurrentSession();
385 |   },
386 |   setAgentTalkLogs: (logs) => {
387 |     set((state) => ({
388 |       agentTalkLogs: typeof logs === 'function' ? logs(state.agentTalkLogs) : logs
389 |     }));
390 |     get().saveCurrentSession();
391 |   },
392 |   setPendingApproval: (val) => set({ pendingApproval: val }),
393 | 
394 |   // Session Actions
395 |   createSession: (prompt, mode) => {
396 |     const sessionId = Date.now().toString();
397 |     const newSession: ChatSession = {
398 |       id: sessionId,
399 |       title: prompt.length > 40 ? prompt.substring(0, 40) + "..." : prompt,
400 |       prompt: prompt,
401 |       mode: mode,
402 |       nodes: [],
403 |       edges: [],
404 |       chatMessages: [],
405 |       agentTalkLogs: [],
406 |       executionState: "setup",
407 |       statusMessage: "",
408 |       followUpSuggestions: []
409 |     };
410 | 
411 |     set((state) => ({
412 |       sessions: { ...state.sessions, [sessionId]: newSession },
413 |       activeSessionId: sessionId,
414 |       nodes: [],
415 |       edges: [],
416 |       chatMessages: [],
417 |       agentTalkLogs: [],
418 |       executionState: "setup",
419 |       statusMessage: "",
420 |       followUpSuggestions: []
421 |     }));
422 | 
423 |     return sessionId;
424 |   },
425 | 
426 |   switchSession: (sessionId) => {
427 |     const currentSessionId = get().activeSessionId;
428 |     if (currentSessionId) {
429 |       const currentSession: ChatSession = {
430 |         id: currentSessionId,
431 |         title: get().sessions[currentSessionId]?.title || "Chat",
432 |         prompt: get().sessions[currentSessionId]?.prompt || "",
433 |         mode: get().sessions[currentSessionId]?.mode || "auto",
434 |         nodes: get().nodes,
435 |         edges: get().edges,
436 |         chatMessages: get().chatMessages,
437 |         agentTalkLogs: get().agentTalkLogs,
438 |         executionState: get().executionState,
439 |         statusMessage: get().statusMessage,
440 |         followUpSuggestions: get().followUpSuggestions
441 |       };
442 |       set((state) => ({
443 |         sessions: { ...state.sessions, [currentSessionId]: currentSession }
444 |       }));
445 |     }
446 | 
447 |     const newSession = get().sessions[sessionId];
448 |     if (newSession) {
449 |       set({
450 |         activeSessionId: sessionId,
451 |         nodes: newSession.nodes,
452 |         edges: newSession.edges,
453 |         chatMessages: newSession.chatMessages,
454 |         agentTalkLogs: newSession.agentTalkLogs,
455 |         executionState: newSession.executionState,
456 |         statusMessage: newSession.statusMessage,
457 |         followUpSuggestions: newSession.followUpSuggestions || [],
458 |         selectedNodeId: null
459 |       });
460 |     }
461 |   },
462 | 
463 |   saveCurrentSession: () => {
464 |     const currentSessionId = get().activeSessionId;
465 |     if (!currentSessionId) return;
466 |     debounceSave(currentSessionId, get, set);
467 |   },
468 | 
469 |   fetchSessions: async () => {
470 |     try {
471 |       const response = await fetch("/api/gemini/sessions");
472 |       if (response.ok) {
473 |         const list = await response.json();
474 |         const updatedSessions: Record<string, ChatSession> = { ...get().sessions };
475 |         for (const s of list) {
476 |           if (!updatedSessions[s.session_id]) {
477 |             updatedSessions[s.session_id] = {
478 |               id: s.session_id,
479 |               title: s.title,
480 |               prompt: s.prompt,
481 |               mode: s.mode,
482 |               nodes: [],
483 |               edges: [],
484 |               chatMessages: [],
485 |               agentTalkLogs: [],
486 |               executionState: s.execution_state,
487 |               statusMessage: s.status_message,
488 |               followUpSuggestions: []
489 |             };
490 |           }
491 |         }
492 |         set({ sessions: updatedSessions });
493 |       }
494 |     } catch (e) {
495 |       console.error("Failed to fetch sessions from DB", e);
496 |     }
497 |   },
498 | 
499 |   loadSessionFromDb: async (sessionId: string) => {
500 |     try {
501 |       const response = await fetch(`/api/gemini/sessions?id=${sessionId}`);
502 |       if (response.ok) {
503 |         const fullSession = await response.json();
504 |         const session: ChatSession = {
505 |           id: fullSession.session_id,
506 |           title: fullSession.title,
507 |           prompt: fullSession.prompt,
508 |           mode: fullSession.mode,
509 |           nodes: fullSession.nodes,
510 |           edges: fullSession.edges,
511 |           chatMessages: fullSession.chat_messages,
512 |           agentTalkLogs: fullSession.agent_talk_logs,
513 |           executionState: fullSession.execution_state,
514 |           statusMessage: fullSession.status_message,
515 |           followUpSuggestions: fullSession.follow_up_suggestions
516 |         };
517 |         
518 |         set((state) => ({
519 |           sessions: { ...state.sessions, [sessionId]: session },
520 |           activeSessionId: sessionId,
521 |           nodes: session.nodes,
522 |           edges: session.edges,
523 |           chatMessages: session.chatMessages,
524 |           agentTalkLogs: session.agentTalkLogs,
525 |           executionState: session.executionState,
526 |           statusMessage: session.statusMessage,
527 |           followUpSuggestions: session.followUpSuggestions || [],
528 |           selectedNodeId: null
529 |         }));
530 |       }
531 |     } catch (e) {
532 |       console.error("Failed to load session from DB", e);
533 |     }
534 |   },
535 | 
536 |   deleteSessionFromDb: async (sessionId: string) => {
537 |     // Abort orchestration if deleting the currently active session
538 |     if (get().activeSessionId === sessionId) {
539 |       const ctrl = get().abortController;
540 |       if (ctrl) ctrl.abort();
541 |     }
542 | 
543 |     try {
544 |       const response = await fetch(`/api/gemini/sessions?id=${sessionId}`, {
545 |         method: "DELETE"
546 |       });
547 |       if (response.ok) {
548 |         set((state) => {
549 |           const updated = { ...state.sessions };
550 |           delete updated[sessionId];
551 |           const newActiveId = state.activeSessionId === sessionId ? null : state.activeSessionId;
552 |           return {
553 |             sessions: updated,
554 |             activeSessionId: newActiveId,
555 |             abortController: state.activeSessionId === sessionId ? null : state.abortController,
556 |             isOrchestrating: state.activeSessionId === sessionId ? false : state.isOrchestrating,
557 |             isThinking: state.activeSessionId === sessionId ? false : state.isThinking,
558 |             ...(newActiveId ? {} : {
559 |               nodes: [],
560 |               edges: [],
561 |               chatMessages: [],
562 |               agentTalkLogs: [],
563 |               executionState: "setup",
564 |               statusMessage: "",
565 |               followUpSuggestions: []
566 |             })
567 |           };
568 |         });
569 |       }
570 |     } catch (e) {
571 |       console.error("Failed to delete session", e);
572 |     }
573 |   },
574 | 
575 |   triggerSteerOrchestration: async (promptText, execute = true) => {
576 |     if (!promptText.trim()) return;
577 | 
578 |     // Abort any active orchestration
579 |     const currentController = get().abortController;
580 |     if (currentController) {
581 |       currentController.abort();
582 |     }
583 | 
584 |     const controller = new AbortController();
585 | 
586 |     const userMsg: ChatMessage = {
587 |       id: Date.now().toString(),
588 |       sender: "user",
589 |       text: promptText,
590 |       timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
591 |     };
592 | 
593 |     set((state) => ({
594 |       chatMessages: [...state.chatMessages, userMsg],
595 |       isOrchestrating: true,
596 |       isThinking: true,
597 |       statusMessage: "",
598 |       liveThoughts: "",
599 |       agentTalkLogs: [],
600 |       followUpSuggestions: [],
601 |       abortController: controller
602 |     }));
603 |     get().saveCurrentSession();
604 | 
605 |     // Create target AI message placeholder
606 |     const aiMsgId = (Date.now() + 1).toString();
607 |     set((state) => ({
608 |       chatMessages: [
609 |         ...state.chatMessages,
610 |         {
611 |           id: aiMsgId,
612 |           sender: "ai",
613 |           text: "",
614 |           thinkingSummary: "",
615 |           timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
616 |         }
617 |       ]
618 |     }));
619 |     get().saveCurrentSession();
620 | 
621 |     try {
622 |       const response = await fetch("/api/gemini/orchestrate", {
623 |         method: "POST",
624 |         headers: { "Content-Type": "application/json" },
625 |         body: JSON.stringify({
626 |           prompt: promptText,
627 |           history: get().chatMessages
628 |             .filter(m => m.id !== aiMsgId) // Exclude current empty prompt placeholder
629 |             .map(m => ({ sender: m.sender, text: m.text })),
630 |           api_key: get().apiKeys[get().provider] || get().apiKey || "",
631 |           session_id: get().activeSessionId || "",
632 |           execute_agents: execute,
633 |           provider: get().provider,
634 |           model: get().model
635 |         }),
636 |         signal: controller.signal
637 |       });
638 | 
639 |       if (!response.ok) {
640 |         const errData = await response.json().catch(() => ({ detail: "Orchestration failed." }));
641 |         throw new Error(errData.detail || `Server status error: ${response.status}`);
642 |       }
643 | 
644 |       const reader = response.body?.getReader();
645 |       const decoder = new TextDecoder();
646 |       if (!reader) throw new Error("No response stream body reader.");
647 | 
648 |       let assistantResponse = "";
649 |       let thinkingSummary = "";
650 |       let buffer = "";
651 | 
652 |       while (true) {
653 |         const { done, value } = await reader.read();
654 |         if (done) break;
655 | 
656 |         buffer += decoder.decode(value, { stream: true });
657 |         
658 |         const parts = buffer.split("\n\n");
659 |         buffer = parts.pop() || "";
660 | 
661 |         for (const part of parts) {
662 |           if (!part.trim()) continue;
663 | 
664 |           const lines = part.split("\n");
665 |           let eventType = "text";
666 |           let dataLines: string[] = [];
667 | 
668 |           for (const line of lines) {
669 |             if (line.startsWith("event: ")) {
670 |               eventType = line.slice(7);
671 |             } else if (line.startsWith("data: ")) {
672 |               dataLines.push(line.slice(6));
673 |             } else if (line.startsWith("data:")) {
674 |               dataLines.push(line.slice(5));
675 |             }
676 |           }
677 | 
678 |           const dataContent = dataLines.join("\n");
679 | 
680 |           if (eventType === "text") {
681 |             try {
682 |               const textVal = JSON.parse(dataContent);
683 |               assistantResponse += textVal;
684 |               set((state) => ({
685 |                 isThinking: false, // Turn off thinking dots on first text token
686 |                 chatMessages: state.chatMessages.map(m =>
687 |                   m.id === aiMsgId ? { ...m, text: assistantResponse } : m
688 |                 )
689 |               }));
690 |             } catch (e) {
691 |               console.error("Text SSE parse error", e);
692 |             }
693 |           } else if (eventType === "thinking") {
694 |             try {
695 |               const thoughtVal = JSON.parse(dataContent);
696 |               thinkingSummary += thoughtVal;
697 |               set((state) => ({
698 |                 liveThoughts: thinkingSummary,
699 |                 chatMessages: state.chatMessages.map(m =>
700 |                   m.id === aiMsgId ? { ...m, thinkingSummary: thinkingSummary } : m
701 |                 )
702 |               }));
703 |             } catch (e) {
704 |               console.error("Thinking SSE parse error", e);
705 |             }
706 |           } else if (eventType === "status") {
707 |             try {
708 |               const statusVal = JSON.parse(dataContent);
709 |               set({ statusMessage: typeof statusVal === "string" ? statusVal : "" });
710 |             } catch (e) {
711 |               console.error("Status SSE parse error", e);
712 |             }
713 |           } else if (eventType === "metadata") {
714 |             try {
715 |               const meta = JSON.parse(dataContent);
716 |               set({
717 |                 nodes: meta.nodes || [],
718 |                 edges: meta.edges || [],
719 |                 agentTalkLogs: meta.agent_talk || [],
720 |                 followUpSuggestions: meta.follow_up_suggestions || []  // Bug 2: populate suggestions
721 |               });
722 |             } catch (e) {
723 |               console.error("Metadata SSE parse error", e);
724 |             }
725 |           } else if (eventType === "tool_approval") {
726 |             try {
727 |               const approval = JSON.parse(dataContent);
728 |               set({ pendingApproval: approval });
729 |             } catch (e) {
730 |               console.error("Tool approval SSE parse error", e);
731 |             }
732 |           }
733 |         }
734 |       }
735 | 
736 |       if (!assistantResponse) {
737 |         const fallbackMsg = "I'm sorry, I couldn't generate a response. This might be due to a temporary issue with the AI service or an invalid API key. Please check your API key in Settings and try again.";
738 |         set((state) => ({
739 |           chatMessages: state.chatMessages.map(m =>
740 |             m.id === aiMsgId ? { ...m, text: fallbackMsg } : m
741 |           )
742 |         }));
743 |       }
744 | 
745 |       set({ abortController: null });
746 |       get().saveCurrentSession();
747 |     } catch (err: any) {
748 |       if (err.name === 'AbortError') {
749 |         console.log("Steer Orchestration manually aborted.");
750 |         set((state) => ({
751 |           chatMessages: state.chatMessages.map(m =>
752 |             m.id === aiMsgId && !m.text ? { ...m, text: "*Generation stopped by user.*" } : m
753 |           )
754 |         }));
755 |       } else {
756 |         console.error("Steer Orchestration stream error:", err);
757 |         const errorMsg = `**Connection Error.**\n\n${err.message || "Failed to parse stream event source. Check backend logs."}`;
758 |         set((state) => ({
759 |           chatMessages: state.chatMessages.map(m =>
760 |             m.id === aiMsgId ? { ...m, text: errorMsg } : m
761 |           ),
762 |           nodes: [],
763 |           edges: [],
764 |           followUpSuggestions: []
765 |         }));
766 |       }
767 |       set({ abortController: null, isThinking: false, isOrchestrating: false });
768 |       get().saveCurrentSession();
769 |     } finally {
770 |       set({ isOrchestrating: false, isThinking: false, statusMessage: '', liveThoughts: '' });
771 |       get().saveCurrentSession();
772 |     }
773 |   },
774 | 
775 |   triggerCustomExecution: async () => {
776 |     const currentController = get().abortController;
777 |     if (currentController) {
778 |       currentController.abort();
779 |     }
780 | 
781 |     const controller = new AbortController();
782 | 
783 |     const sessionId = get().activeSessionId;
784 |     if (!sessionId) return;
785 | 
786 |     const prompt = get().chatMessages.findLast(m => m.sender === 'user')?.text || "";
787 | 
788 |     set((state) => ({
789 |       isOrchestrating: true,
790 |       isThinking: true,
791 |       statusMessage: "Running custom orchestration loop...",
792 |       liveThoughts: "",
793 |       agentTalkLogs: [],
794 |       followUpSuggestions: [],
795 |       abortController: controller
796 |     }));
797 |     get().saveCurrentSession();
798 | 
799 |     const aiMsgId = Date.now().toString();
800 |     set((state) => ({
801 |       chatMessages: [
802 |         ...state.chatMessages,
803 |         {
804 |           id: aiMsgId,
805 |           sender: "ai",
806 |           text: "",
807 |           thinkingSummary: "",
808 |           timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
809 |         }
810 |       ]
811 |     }));
812 |     get().saveCurrentSession();
813 | 
814 |     try {
815 |       const response = await fetch("/api/gemini/execute_custom", {
816 |         method: "POST",
817 |         headers: { "Content-Type": "application/json" },
818 |         body: JSON.stringify({
819 |           session_id: sessionId,
820 |           prompt: prompt,
821 |           history: get().chatMessages
822 |             .filter(m => m.id !== aiMsgId)
823 |             .map(m => ({ sender: m.sender, text: m.text })),
824 |           api_key: get().apiKeys[get().provider] || get().apiKey || "",
825 |           nodes: get().nodes,
826 |           edges: get().edges,
827 |           provider: get().provider,
828 |           model: get().model
829 |         }),
830 |         signal: controller.signal
831 |       });
832 | 
833 |       if (!response.ok) {
834 |         const errData = await response.json().catch(() => ({ detail: "Execution failed." }));
835 |         throw new Error(errData.detail || `Server status error: ${response.status}`);
836 |       }
837 | 
838 |       const reader = response.body?.getReader();
839 |       const decoder = new TextDecoder();
840 |       if (!reader) throw new Error("No response stream body reader.");
841 | 
842 |       let assistantResponse = "";
843 |       let thinkingSummary = "";
844 |       let buffer = "";
845 | 
846 |       while (true) {
847 |         const { done, value } = await reader.read();
848 |         if (done) break;
849 | 
850 |         buffer += decoder.decode(value, { stream: true });
851 |         
852 |         const parts = buffer.split("\n\n");
853 |         buffer = parts.pop() || "";
854 | 
855 |         for (const part of parts) {
856 |           if (!part.trim()) continue;
857 | 
858 |           const lines = part.split("\n");
859 |           let eventType = "text";
860 |           let dataLines: string[] = [];
861 | 
862 |           for (const line of lines) {
863 |             if (line.startsWith("event: ")) {
864 |               eventType = line.slice(7);
865 |             } else if (line.startsWith("data: ")) {
866 |               dataLines.push(line.slice(6));
867 |             } else if (line.startsWith("data:")) {
868 |               dataLines.push(line.slice(5));
869 |             }
870 |           }
871 | 
872 |           const dataContent = dataLines.join("\n");
873 | 
874 |           if (eventType === "text") {
875 |             try {
876 |               const textVal = JSON.parse(dataContent);
877 |               assistantResponse += textVal;
878 |               set((state) => ({
879 |                 isThinking: false,
880 |                 chatMessages: state.chatMessages.map(m =>
881 |                   m.id === aiMsgId ? { ...m, text: assistantResponse } : m
882 |                 )
883 |               }));
884 |             } catch (e) {
885 |               console.error("Text SSE parse error", e);
886 |             }
887 |           } else if (eventType === "thinking") {
888 |             try {
889 |               const thoughtVal = JSON.parse(dataContent);
890 |               thinkingSummary += thoughtVal;
891 |               set((state) => ({
892 |                 liveThoughts: thinkingSummary,
893 |                 chatMessages: state.chatMessages.map(m =>
894 |                   m.id === aiMsgId ? { ...m, thinkingSummary: thinkingSummary } : m
895 |                 )
896 |               }));
897 |             } catch (e) {
898 |               console.error("Thinking SSE parse error", e);
899 |             }
900 |           } else if (eventType === "status") {
901 |             try {
902 |               const statusVal = JSON.parse(dataContent);
903 |               set({ statusMessage: typeof statusVal === "string" ? statusVal : "" });
904 |             } catch (e) {
905 |               console.error("Status SSE parse error", e);
906 |             }
907 |           } else if (eventType === "metadata") {
908 |             try {
909 |               const meta = JSON.parse(dataContent);
910 |               set({
911 |                 nodes: meta.nodes || [],
912 |                 edges: meta.edges || [],
913 |                 agentTalkLogs: meta.agent_talk || [],
914 |                 followUpSuggestions: meta.follow_up_suggestions || []  // Bug 2: populate suggestions
915 |               });
916 |             } catch (e) {
917 |               console.error("Metadata SSE parse error", e);
918 |             }
919 |           } else if (eventType === "tool_approval") {
920 |             try {
921 |               const approval = JSON.parse(dataContent);
922 |               set({ pendingApproval: approval });
923 |             } catch (e) {
924 |               console.error("Tool approval SSE parse error", e);
925 |             }
926 |           }
927 |         }
928 |       }
929 | 
930 |       if (!assistantResponse) {
931 |         const fallbackMsg = "I'm sorry, I couldn't generate a response. This might be due to a temporary issue with the AI service or an invalid API key. Please check your API key in Settings and try again.";
932 |         set((state) => ({
933 |           chatMessages: state.chatMessages.map(m =>
934 |             m.id === aiMsgId ? { ...m, text: fallbackMsg } : m
935 |           )
936 |         }));
937 |       }
938 | 
939 |       set({ abortController: null });
940 |       get().saveCurrentSession();
941 |     } catch (err: any) {
942 |       if (err.name === 'AbortError') {
943 |         console.log("Steer Orchestration manually aborted.");
944 |         set((state) => ({
945 |           chatMessages: state.chatMessages.map(m =>
946 |             m.id === aiMsgId && !m.text ? { ...m, text: "*Generation stopped by user.*" } : m
947 |           )
948 |         }));
949 |       } else {
950 |         console.error("Steer Orchestration stream error:", err);
951 |         const errorMsg = `**Connection Error.**\n\n${err.message || "Failed to parse stream event source. Check backend logs."}`;
952 |         set((state) => ({
953 |           chatMessages: state.chatMessages.map(m =>
954 |             m.id === aiMsgId ? { ...m, text: errorMsg } : m
955 |           ),
956 |           nodes: [],
957 |           edges: [],
958 |           followUpSuggestions: []
959 |         }));
960 |       }
961 |       set({ abortController: null, isThinking: false, isOrchestrating: false });
962 |       get().saveCurrentSession();
963 |     } finally {
964 |       set({ isOrchestrating: false, isThinking: false, statusMessage: '', liveThoughts: '' });
965 |       get().saveCurrentSession();
966 |     }
967 |   }
968 | }));
969 |
```

### File: `Frontend/.eslintrc.json`

> 4 lines | 0.0 KB

```json
1 | {
2 |   "extends": "next"
3 | }
4 |
```

### File: `Frontend/.gitignore`

> 8 lines | 0.1 KB

```text
1 | node_modules/
2 | .next/
3 | coverage/
4 | .DS_Store
5 | *.log
6 | .env*
7 | !.env.example
8 |
```

### File: `Frontend/metadata.json`

> 7 lines | 0.3 KB

```json
1 | {
2 |   "name": "Solospace",
3 |   "description": "An advanced agent orchestration platform and workspace with high-fidelity canvas and conversational steering.",
4 |   "requestFramePermissions": [],
5 |   "majorCapabilities": ["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"]
6 | }
7 |
```

### File: `Frontend/next-env.d.ts`

> 7 lines | 0.3 KB

```typescript
1 | /// <reference types="next" />
2 | /// <reference types="next/image-types/global" />
3 | /// <reference path="./.next/types/routes.d.ts" />
4 | 
5 | // NOTE: This file should not be edited
6 | // see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
7 |
```

### File: `Frontend/next.config.ts`

> 37 lines | 0.9 KB

```typescript
 1 | import type {NextConfig} from 'next';
 2 | 
 3 | const nextConfig: NextConfig = {
 4 |   reactStrictMode: true,
 5 |   eslint: {
 6 |     ignoreDuringBuilds: true,
 7 |   },
 8 |   typescript: {
 9 |     ignoreBuildErrors: false,
10 |   },
11 |   // Allow access to remote image placeholder.
12 |   images: {
13 |     remotePatterns: [
14 |       {
15 |         protocol: 'https',
16 |         hostname: 'picsum.photos',
17 |         port: '',
18 |         pathname: '/**', // This allows any path under the hostname
19 |       },
20 |     ],
21 |   },
22 |   output: 'standalone',
23 |   transpilePackages: ['motion'],
24 |   webpack: (config, {dev}) => {
25 |     // HMR is disabled in AI Studio via DISABLE_HMR env var.
26 |     // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
27 |     if (dev && process.env.DISABLE_HMR === 'true') {
28 |       config.watchOptions = {
29 |         ignored: /.*/,
30 |       };
31 |     }
32 |     return config;
33 |   },
34 | };
35 | 
36 | export default nextConfig;
37 |
```

### File: `Frontend/package.json`

> 48 lines | 1.2 KB

```json
 1 | {
 2 |   "name": "ai-studio-applet",
 3 |   "version": "0.1.0",
 4 |   "private": true,
 5 |   "scripts": {
 6 |     "dev": "next dev",
 7 |     "build": "next build",
 8 |     "start": "next start",
 9 |     "lint": "eslint .",
10 |     "clean": "next clean"
11 |   },
12 |   "dependencies": {
13 |     "@google/genai": "^2.4.0",
14 |     "@hookform/resolvers": "^5.2.1",
15 |     "@types/dagre": "^0.7.54",
16 |     "@types/react-syntax-highlighter": "^15.5.13",
17 |     "@xyflow/react": "^12.10.2",
18 |     "autoprefixer": "^10.4.21",
19 |     "class-variance-authority": "^0.7.1",
20 |     "clsx": "^2.1.1",
21 |     "dagre": "^0.8.5",
22 |     "lucide-react": "^0.553.0",
23 |     "motion": "^12.23.24",
24 |     "next": "^15.4.9",
25 |     "postcss": "^8.5.6",
26 |     "react": "^19.2.1",
27 |     "react-dom": "^19.2.1",
28 |     "react-markdown": "^10.1.0",
29 |     "react-syntax-highlighter": "^16.1.1",
30 |     "remark-gfm": "^4.0.1",
31 |     "tailwind-merge": "^3.3.1",
32 |     "zustand": "^5.0.13"
33 |   },
34 |   "devDependencies": {
35 |     "@tailwindcss/postcss": "4.1.11",
36 |     "@tailwindcss/typography": "^0.5.19",
37 |     "@types/node": "^20",
38 |     "@types/react": "^19",
39 |     "@types/react-dom": "^19",
40 |     "eslint": "9.39.1",
41 |     "eslint-config-next": "15.4.9",
42 |     "firebase-tools": "^15.0.0",
43 |     "tailwindcss": "4.1.11",
44 |     "tw-animate-css": "^1.4.0",
45 |     "typescript": "5.9.3"
46 |   }
47 | }
48 |
```

### File: `Frontend/README.md`

> 21 lines | 0.5 KB

```markdown
 1 | <div align="center">
 2 | <img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
 3 | </div>
 4 | 
 5 | # Run and deploy your AI Studio app
 6 | 
 7 | This contains everything you need to run your app locally.
 8 | 
 9 | View your app in AI Studio: https://ai.studio/apps/626beadf-4e58-496b-a024-c2ac5aa91be2
10 | 
11 | ## Run Locally
12 | 
13 | **Prerequisites:**  Node.js
14 | 
15 | 
16 | 1. Install dependencies:
17 |    `npm install`
18 | 2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
19 | 3. Run the app:
20 |    `npm run dev`
21 |
```

### File: `Frontend/tsconfig.json`

> 29 lines | 0.6 KB

```json
 1 | {
 2 |   "compilerOptions": {
 3 |     "target": "ES2017",
 4 |     "lib": ["dom", "dom.iterable", "esnext"],
 5 |     "allowJs": true,
 6 |     "skipLibCheck": true,
 7 |     "strict": true,
 8 |     "noEmit": true,
 9 |     "esModuleInterop": true,
10 |     "module": "esnext",
11 |     "moduleResolution": "bundler",
12 |     "resolveJsonModule": true,
13 |     "isolatedModules": true,
14 |     "jsx": "preserve",
15 |     "incremental": true,
16 |     "plugins": [
17 |       {
18 |         "name": "next"
19 |       }
20 |     ],
21 |     "baseUrl": ".",
22 |     "paths": {
23 |       "@/*": ["./*"]
24 |     }
25 |   },
26 |   "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
27 |   "exclude": ["node_modules"]
28 | }
29 |
```

### File: `.gitignore`

> 49 lines | 0.6 KB

```text
 1 | # Dependencies
 2 | **/node_modules/
 3 | **/bower_components/
 4 | 
 5 | # Next.js build output
 6 | **/build/
 7 | **/.next/
 8 | **/out/
 9 | 
10 | # Debug logs
11 | npm-debug.log*
12 | yarn-debug.log*
13 | yarn-error.log*
14 | lerna-debug.log*
15 | 
16 | # Local env files
17 | **/.env
18 | **/.env.local
19 | **/.env.development.local
20 | **/.env.test.local
21 | **/.env.production.local
22 | **/env.local
23 | !**/.env.example
24 | 
25 | # IDEs and editors
26 | .idea/
27 | .vscode/
28 | *.suo
29 | *.ntvs*
30 | *.njsproj
31 | *.sln
32 | *.sw?
33 | 
34 | # OS files
35 | .DS_Store
36 | Thumbs.db
37 | 
38 | # TypeScript compilation info
39 | **/tsconfig.tsbuildinfo
40 | 
41 | # Python/Backend patterns
42 | **/venv/
43 | **/.venv/
44 | **/__pycache__/
45 | *.pyc
46 | **/solospace.db
47 | **/memory_store.json
48 | 
49 |
```

### File: `README.md`

> 2 lines | 0.0 KB

```markdown
1 | # solospace
2 |
```
