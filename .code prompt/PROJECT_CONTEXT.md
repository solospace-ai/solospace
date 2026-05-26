# Full Project Context

> Generated: 2026-05-26T12:56:37.143Z
> Mode: Full Project
> Files: 30
> Total Lines: 6,072
> Total Size: 236.9 KB
> Directories: 14

---

## 📁 Folder Structure

```
SoloSpace/
├── Backend/
│   ├── agent_messages.py
│   ├── db.py
│   ├── main.py
│   ├── memory_store.json
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

> 1508 lines | 62.5 KB

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
  21 | 
  22 | 
  23 | # Initialize database
  24 | db.init_db()
  25 | 
  26 | app = FastAPI(title="Solospace Python Orchestrator API")
  27 | 
  28 | # Allow Next.js frontend to reach this API (critical on Windows / localhost dev)
  29 | app.add_middleware(
  30 |     CORSMiddleware,
  31 |     allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
  32 |     allow_credentials=True,
  33 |     allow_methods=["*"],
  34 |     allow_headers=["*"],
  35 | )
  36 | 
  37 | # Track by IP for Rate Limiting
  38 | ip_rate_limits = {}
  39 | 
  40 | @app.middleware("http")
  41 | async def ip_rate_limit_middleware(request: Request, call_next):
  42 |     if request.method == "OPTIONS":
  43 |         return await call_next(request)
  44 |         
  45 |     client_ip = request.client.host if request.client else "unknown"
  46 |     
  47 |     if client_ip not in ip_rate_limits:
  48 |         ip_rate_limits[client_ip] = {"count": 0, "window_start": time.time()}
  49 |     
  50 |     info = ip_rate_limits[client_ip]
  51 |     now = time.time()
  52 |     
  53 |     # Reset window every 60 seconds
  54 |     if now - info["window_start"] > 60:
  55 |         info["count"] = 0
  56 |         info["window_start"] = now
  57 |     
  58 |     info["count"] += 1
  59 |     
  60 |     # Max 40 requests per minute per IP
  61 |     if info["count"] > 40:
  62 |         return JSONResponse(
  63 |             status_code=429,
  64 |             content={"detail": "Rate limit exceeded. Please wait before making more requests."}
  65 |         )
  66 |     
  67 |     return await call_next(request)
  68 | 
  69 | # Global coordination states
  70 | MEMORY_FILE = "memory_store.json"
  71 | 
  72 | class Message(BaseModel):
  73 |     sender: str
  74 |     text: str
  75 | 
  76 | class OrchestrateRequest(BaseModel):
  77 |     prompt: str
  78 |     history: Optional[List[Message]] = []
  79 |     api_key: Optional[str] = None
  80 |     session_id: Optional[str] = None
  81 |     execute_agents: bool = True
  82 | 
  83 | class ApprovalRequest(BaseModel):
  84 |     sessionId: str
  85 |     nodeId: str
  86 |     toolName: str
  87 |     action: str  # "approve" or "deny"
  88 | 
  89 | class ExecuteCustomRequest(BaseModel):
  90 |     session_id: str
  91 |     api_key: str
  92 |     nodes: List[Dict[str, Any]]
  93 |     edges: List[Dict[str, Any]]
  94 |     prompt: str
  95 |     history: Optional[List[Message]] = []
  96 | 
  97 | # ─── VECTOR DB MEMORY STORE (Gemini Embeddings + Local Cosine Similarity) ───
  98 | 
  99 | async def get_gemini_embedding(text: str, api_key: str) -> List[float]:
 100 |     url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={api_key}"
 101 |     payload = {
 102 |         "model": "models/text-embedding-004",
 103 |         "content": {
 104 |             "parts": [{"text": text}]
 105 |         }
 106 |     }
 107 |     async with httpx.AsyncClient() as client:
 108 |         try:
 109 |             r = await client.post(url, json=payload, timeout=15.0)
 110 |             if r.status_code == 200:
 111 |                 return r.json().get("embedding", {}).get("values", [])
 112 |         except Exception as e:
 113 |             print(f"[MEMORY ERROR] Embedding API failed: {e}")
 114 |     return []
 115 | 
 116 | def cosine_similarity(v1: List[float], v2: List[float]) -> float:
 117 |     if not v1 or not v2 or len(v1) != len(v2):
 118 |         return 0.0
 119 |     dot = sum(a * b for a, b in zip(v1, v2))
 120 |     norm1 = math.sqrt(sum(a * a for a in v1))
 121 |     norm2 = math.sqrt(sum(b * b for b in v2))
 122 |     if norm1 == 0.0 or norm2 == 0.0:
 123 |         return 0.0
 124 |     return dot / (norm1 * norm2)
 125 | 
 126 | # Bug 7: Thread-safe memory I/O lock
 127 | memory_lock = threading.Lock()
 128 | 
 129 | def load_memories() -> List[Dict[str, Any]]:
 130 |     with memory_lock:
 131 |         if os.path.exists(MEMORY_FILE):
 132 |             try:
 133 |                 with open(MEMORY_FILE, "r") as f:
 134 |                     return json.load(f)
 135 |             except Exception:
 136 |                 pass
 137 |     return []
 138 | 
 139 | def save_memories(memories: List[Dict[str, Any]]):
 140 |     with memory_lock:
 141 |         try:
 142 |             with open(MEMORY_FILE, "w") as f:
 143 |                 json.dump(memories, f, indent=2)
 144 |         except Exception as e:
 145 |             print(f"[MEMORY ERROR] Saving file failed: {e}")
 146 | 
 147 | MAX_MEMORIES = 200  # Bug 8: Cap total entries to prevent unbounded growth
 148 | 
 149 | async def store_memory(agent_id: str, text: str, api_key: str, session_id: str = None):
 150 |     embedding = await get_gemini_embedding(text, api_key)
 151 |     if not embedding:
 152 |         return
 153 |     memories = load_memories()
 154 |     entry = {
 155 |         "agent_id": agent_id,
 156 |         "text": text,
 157 |         "embedding": embedding,
 158 |         "timestamp": datetime.datetime.now().isoformat()
 159 |     }
 160 |     if session_id:
 161 |         entry["session_id"] = session_id
 162 |     memories.append(entry)
 163 | 
 164 |     # Bug 8: Evict oldest entries if over limit
 165 |     if len(memories) > MAX_MEMORIES:
 166 |         memories = memories[-MAX_MEMORIES:]
 167 | 
 168 |     save_memories(memories)
 169 | 
 170 | async def query_memory(query: str, api_key: str, top_k=2, agent_id: Optional[str] = None, session_id: Optional[str] = None) -> List[str]:
 171 |     embedding = await get_gemini_embedding(query, api_key)
 172 |     if not embedding:
 173 |         return []
 174 |     memories = load_memories()
 175 |     scored = []
 176 |     for m in memories:
 177 |         if agent_id is not None:
 178 |             # Match directly or by session prefix
 179 |             if m.get("agent_id") != agent_id and not (agent_id.startswith("session_") and m.get("session_id") == agent_id[8:]):
 180 |                 continue
 181 |         if session_id is not None and m.get("session_id") != session_id:
 182 |             continue
 183 |         sim = cosine_similarity(embedding, m["embedding"])
 184 |         scored.append((sim, m["text"]))
 185 |     
 186 |     scored.sort(key=lambda x: x[0], reverse=True)
 187 |     return [text for sim, text in scored[:top_k] if sim > 0.45]
 188 | 
 189 | 
 190 | # ─── REAL AGENT TOOLS ───
 191 | 
 192 | async def execute_web_search(query: str) -> str:
 193 |     headers = {
 194 |         "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
 195 |     }
 196 |     url = f"https://html.duckduckgo.com/html/?q={query}"
 197 |     async with httpx.AsyncClient() as client:
 198 |         try:
 199 |             r = await client.get(url, headers=headers, timeout=15.0)
 200 |             if r.status_code == 200:
 201 |                 soup = BeautifulSoup(r.text, "html.parser")
 202 |                 snippets = []
 203 |                 for div in soup.find_all("a", class_="result__snippet")[:3]:
 204 |                     snippets.append(div.get_text().strip())
 205 |                 if snippets:
 206 |                     return "\n".join(snippets)
 207 |         except Exception as e:
 208 |             return f"Search failed: {str(e)}"
 209 |     return f"No search results found for query: '{query}'."
 210 | 
 211 | async def execute_web_browse(url: str) -> str:
 212 |     """Fetch and extract text content from a URL."""
 213 |     headers = {
 214 |         "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
 215 |     }
 216 |     from urllib.parse import urlparse
 217 |     import socket
 218 |     BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254"}
 219 |     ALLOWED_SCHEMES = {"http", "https"}
 220 |     try:
 221 |         parsed = urlparse(url)
 222 |         if parsed.scheme not in ALLOWED_SCHEMES:
 223 |             return f"Error: Scheme '{parsed.scheme}' not allowed. Use http/https."
 224 |         hostname = parsed.hostname
 225 |         if not hostname:
 226 |             return "Error: Invalid URL provided."
 227 |         if hostname.lower() in BLOCKED_HOSTS:
 228 |             return "Error: Access to internal/local addresses is blocked."
 229 |         try:
 230 |             ip_str = socket.gethostbyname(hostname)
 231 |             # Bug 12: Use ipaddress module for complete private IP detection
 232 |             ip_obj = ipaddress.ip_address(ip_str)
 233 |             if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
 234 |                 return "Error: Access to internal/local addresses is blocked."
 235 |         except ValueError:
 236 |             pass  # Not a valid IP string after DNS resolve, allow
 237 |         except Exception:
 238 |             pass
 239 |     except Exception as e:
 240 |         return f"Error: Invalid URL - {str(e)}"
 241 | 
 242 |     async with httpx.AsyncClient() as client:
 243 |         try:
 244 |             r = await client.get(url, headers=headers, timeout=15.0, follow_redirects=True)
 245 |             if r.status_code == 200:
 246 |                 soup = BeautifulSoup(r.text, "html.parser")
 247 |                 for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
 248 |                     tag.decompose()
 249 |                 text = soup.get_text(separator="\n", strip=True)
 250 |                 return text[:3000]
 251 |             return f"Browse failed with status {r.status_code}"
 252 |         except Exception as e:
 253 |             return f"Browse error: {str(e)}"
 254 | 
 255 | async def execute_python_code(code: str) -> str:
 256 |     import tempfile
 257 |     
 258 |     SANDBOX_HEADER = """
 259 | import sys
 260 | import os
 261 | import tempfile
 262 | 
 263 | # Block network access
 264 | import socket
 265 | socket.socket = lambda *a, **k: None
 266 | 
 267 | # Restrict file access to temp dir only
 268 | _original_open = open
 269 | def _restricted_open(name, *args, **kwargs):
 270 |     temp_dir = os.path.abspath(tempfile.gettempdir())
 271 |     resolved_path = os.path.abspath(str(name))
 272 |     if not resolved_path.startswith(temp_dir):
 273 |         raise PermissionError(f"Access denied: {name}")
 274 |     return _original_open(name, *args, **kwargs)
 275 | 
 276 | # Keep restricted open and delete original dangerous builtins
 277 | __builtins__.open = _restricted_open
 278 | if 'eval' in __builtins__.__dict__:
 279 |     del __builtins__.__dict__['eval']
 280 | if 'exec' in __builtins__.__dict__:
 281 |     del __builtins__.__dict__['exec']
 282 | if 'compile' in __builtins__.__dict__:
 283 |     del __builtins__.__dict__['compile']
 284 | if '__import__' in __builtins__.__dict__:
 285 |     del __builtins__.__dict__['__import__']
 286 | """
 287 | 
 288 |     sandboxed_code = SANDBOX_HEADER + "\n" + code
 289 | 
 290 |     # Create a temp file to execute the code safely
 291 |     with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
 292 |         f.write(sandboxed_code)
 293 |         temp_path = f.name
 294 | 
 295 |     try:
 296 |         env = os.environ.copy()
 297 |         env.pop('GEMINI_API_KEY', None)  # Never expose API key
 298 |         env.pop('DATABASE_URL', None)
 299 | 
 300 |         p = subprocess.Popen(
 301 |             [sys.executable, temp_path],
 302 |             stdout=subprocess.PIPE,
 303 |             stderr=subprocess.PIPE,
 304 |             text=True,
 305 |             cwd=tempfile.gettempdir(),
 306 |             env=env
 307 |         )
 308 | 
 309 |         try:
 310 |             stdout, stderr = p.communicate(timeout=15.0)  # Reduced timeout
 311 |         except subprocess.TimeoutExpired:
 312 |             p.kill()
 313 |             return "Error: Code execution timed out (15s limit)."
 314 | 
 315 |         output = ""
 316 |         if stdout:
 317 |             output += f"STDOUT:\n{stdout[:2000]}\n"  # Limit output size
 318 |         if stderr:
 319 |             output += f"STDERR:\n{stderr[:1000]}\n"
 320 |         if not output:
 321 |             output = "Code executed successfully with no output."
 322 |         return output
 323 |     except Exception as e:
 324 |         return f"Execution error: {str(e)}"
 325 |     finally:
 326 |         try:
 327 |             os.unlink(temp_path)
 328 |         except Exception:
 329 |             pass
 330 | 
 331 | async def execute_api_call(url: str, method: str = "GET", payload_json: Optional[str] = None) -> str:
 332 |     from urllib.parse import urlparse
 333 |     import socket
 334 |     
 335 |     BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254"}
 336 |     ALLOWED_SCHEMES = {"http", "https"}
 337 |     
 338 |     try:
 339 |         parsed = urlparse(url)
 340 |         if parsed.scheme not in ALLOWED_SCHEMES:
 341 |             return f"Error: Scheme '{parsed.scheme}' not allowed. Use http/https."
 342 |         hostname = parsed.hostname
 343 |         if not hostname:
 344 |             return "Error: Invalid URL provided."
 345 |         
 346 |         # Prevent SSRF
 347 |         if hostname.lower() in BLOCKED_HOSTS:
 348 |             return "Error: Access to internal/local addresses is blocked."
 349 |             
 350 |         try:
 351 |             ip_str = socket.gethostbyname(hostname)
 352 |             # Bug 12: Use ipaddress module for complete private IP detection
 353 |             ip_obj = ipaddress.ip_address(ip_str)
 354 |             if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
 355 |                 return "Error: Access to internal/local addresses is blocked."
 356 |         except ValueError:
 357 |             pass  # Not a valid IP string, allow
 358 |         except Exception:
 359 |             pass
 360 |     except Exception as e:
 361 |         return f"Error: Invalid URL - {str(e)}"
 362 | 
 363 |     async with httpx.AsyncClient() as client:
 364 |         try:
 365 |             if method.upper() == "POST":
 366 |                 data = json.loads(payload_json) if payload_json else {}
 367 |                 r = await client.post(url, json=data, timeout=15.0)
 368 |             else:
 369 |                 r = await client.get(url, timeout=15.0)
 370 |             return f"Status: {r.status_code}\nResponse: {r.text[:1500]}"
 371 |         except Exception as e:
 372 |             return f"API call failed: {str(e)}"
 373 | 
 374 | # ─── AGENT COORDINATOR DAG SORT ───
 375 | 
 376 | def sort_nodes_topologically(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
 377 |     """Sort nodes using both explicit dependencies AND visual edges."""
 378 |     visited = set()
 379 |     sorted_nodes = []
 380 |     node_dict = {n["id"]: n for n in nodes}
 381 |     
 382 |     # Build dependency graph from both sources
 383 |     dep_graph = {n["id"]: set(n["data"].get("dependencies", [])) for n in nodes}
 384 |     
 385 |     # Also add edges as dependencies
 386 |     if edges:
 387 |         for edge in edges:
 388 |             target = edge.get("target")
 389 |             source = edge.get("source")
 390 |             if target in dep_graph and source in node_dict:
 391 |                 dep_graph[target].add(source)
 392 | 
 393 |     def visit(node_id):
 394 |         if node_id in visited:
 395 |             return
 396 |         visited.add(node_id)
 397 |         for dep in dep_graph.get(node_id, set()):
 398 |             if dep in node_dict:
 399 |                 visit(dep)
 400 |         if node_id in node_dict:
 401 |             sorted_nodes.append(node_dict[node_id])
 402 | 
 403 |     for node in nodes:
 404 |         visit(node["id"])
 405 |     return sorted_nodes
 406 | 
 407 | # ─── ORCHESTRATION SYSTEM INSTRUCTIONS ───
 408 | 
 409 | ORCHESTRATOR_SYSTEM_INSTRUCTION = """
 410 | You are Solospace, an elite workflow orchestrator. Your ONLY job is to analyze the user's request and output a JSON list of specialized agents.
 411 | 
 412 | CRITICAL RULES:
 413 | - For ANY request that involves building, designing, integrating, or researching a non‑trivial system, you MUST output at least 2 agents.
 414 | - For requests that mention multiple domains (e.g., frontend + backend + database), use 3‑6 agents.
 415 | - Only output a SINGLE agent ("general") for extremely simple questions like "Hello", "What is AI?", or one‑line explanations.
 416 | - Classify the complexity field in the JSON schema as "complex" if the user asks to build, design, integrate, or analyze a system with 2+ distinct components (frontend, backend, database, payments, auth, research). If in doubt, prefer "complex" over "simple".
 417 | 
 418 | AGENT CREATION:
 419 | You can use any senderId, not only the built‑in list. Define custom agents freely.
 420 | Every agent MUST have:
 421 | - senderId: a unique short identifier (e.g., "frontend_ui", "payment_gateway", "data_analyst").
 422 | - senderName: a human readable name.
 423 | - senderIcon: "code", "science", or "trending_up".
 424 | - text: what this agent will contribute.
 425 | - objective: specific goal for this agent.
 426 | - systemPrompt: detailed instructions for the agent.
 427 | - rules: 2‑3 specific constraints.
 428 | - dependencies: list of other agent ids this agent needs.
 429 | - tools: choose from ["Web Search", "Memory", "Code Executor", "Browser", "API Connector"].
 430 | 
 431 | EXAMPLES:
 432 | 1. User: "Build a full‑stack SaaS with Next.js, Stripe payments, and PostgreSQL"
 433 |    → Output agents: frontend_ui, backend_api, database_admin, payment_integrator (4 agents).
 434 | 
 435 | 2. User: "Explain how JWT works"
 436 |    → Output agents: general (1 agent).
 437 | 
 438 | 3. User: "Research AI trends and write a summary"
 439 |    → Output agents: researcher, writer (2 agents).
 440 | 
 441 | Respond ONLY with a valid JSON object matching the provided schema.
 442 | """
 443 | 
 444 | orchestration_schema = {
 445 |     "type": "OBJECT",
 446 |     "properties": {
 447 |         "complexity": {
 448 |             "type": "STRING",
 449 |             "enum": ["simple", "medium", "complex"]
 450 |         },
 451 |         "capabilities": {
 452 |             "type": "ARRAY",
 453 |             "items": {"type": "STRING"}
 454 |         },
 455 |         "thinking_summary": {
 456 |             "type": "STRING"
 457 |         },
 458 |         "follow_up_suggestions": {
 459 |             "type": "ARRAY",
 460 |             "items": {"type": "STRING"}
 461 |         },
 462 |         "agent_talk": {
 463 |             "type": "ARRAY",
 464 |             "items": {
 465 |                 "type": "OBJECT",
 466 |                 "properties": {
 467 |                     "senderId": {"type": "STRING"},
 468 |                     "senderName": {"type": "STRING"},
 469 |                     "senderIcon": {"type": "STRING"},
 470 |                     "text": {"type": "STRING"},
 471 |                     "objective": {"type": "STRING"},
 472 |                     "systemPrompt": {"type": "STRING"},
 473 |                     "rules": {
 474 |                         "type": "ARRAY",
 475 |                         "items": {"type": "STRING"}
 476 |                     },
 477 |                     "dependencies": {
 478 |                         "type": "ARRAY",
 479 |                         "items": {"type": "STRING"}
 480 |                     },
 481 |                     "tools": {
 482 |                         "type": "ARRAY",
 483 |                         "items": {"type": "STRING"}
 484 |                     },
 485 |                     "custom_template": {
 486 |                         "type": "OBJECT",
 487 |                         "properties": {
 488 |                             "name": {"type": "STRING"},
 489 |                             "icon": {"type": "STRING"},
 490 |                             "tag": {"type": "STRING"},
 491 |                             "temp": {"type": "NUMBER"},
 492 |                             "logic": {"type": "INTEGER"},
 493 |                             "col": {"type": "INTEGER"}
 494 |                         },
 495 |                         "required": ["name", "icon", "tag", "temp", "logic", "col"]
 496 |                     }
 497 |                 },
 498 |                 "required": ["senderId", "senderName", "senderIcon", "text", "objective", "systemPrompt", "rules", "dependencies", "tools"]
 499 |             }
 500 |         }
 501 |     },
 502 |     "required": ["complexity", "capabilities", "thinking_summary", "agent_talk", "follow_up_suggestions"]
 503 | }
 504 | 
 505 | # Real-time ReAct loop action schema for agents
 506 | agent_turn_schema = {
 507 |     "type": "OBJECT",
 508 |     "properties": {
 509 |         "thought": {"type": "STRING"},
 510 |         "action": {
 511 |             "type": "STRING",
 512 |             "enum": ["none", "web_search", "execute_code", "api_call", "query_memory", "store_memory", "send_message", "browse_web", "analyze_image", "read_file"]
 513 |         },
 514 |         "action_input": {"type": "STRING"},
 515 |         "final_answer": {"type": "STRING"}
 516 |     },
 517 |     "required": ["thought", "action"]
 518 | }
 519 | 
 520 | 
 521 | RESPONSE_SYSTEM_INSTRUCTION = """
 522 | You are Solospace, an elite assistant.
 523 | Your job is to produce a clean, direct response to the user's prompt using the provided context.
 524 | 
 525 | STRICT RULES — NEVER VIOLATE:
 526 | - Do NOT include any preamble, header, or status line such as "[Agent processing...]", "Synthesizing...", "From the agent team:", or similar.
 527 | - Do NOT mention agents, sub-tasks, specialists, orchestration, or internal workflow mechanics.
 528 | - Do NOT start your response with any markdown header that references processing steps.
 529 | - Begin your response immediately and directly with the answer.
 530 | - Use clean, well-structured markdown only when it genuinely helps the user.
 531 | - For conversational messages (e.g. greetings), reply naturally and concisely without any structure.
 532 | """
 533 | 
 534 | GEMINI_SAFETY_SETTINGS = [
 535 |     {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
 536 |     {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
 537 |     {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
 538 |     {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"}
 539 | ]
 540 | 
 541 | def check_guardrails(prompt: str) -> Optional[str]:
 542 |     jailbreak_keywords = [
 543 |         "ignore previous instructions", "ignore all instructions", "override system prompt",
 544 |         "you are now developer mode", "jailbreak"
 545 |     ]
 546 |     for keyword in jailbreak_keywords:
 547 |         if keyword in prompt.lower():
 548 |             return "Safety Alert: Input contains potential prompt injection or system instruction bypass."
 549 |     return None
 550 | 
 551 | MAX_TOKENS = 100000.0
 552 | REFILL_RATE = 100.0
 553 | 
 554 | def check_rate_limit(session_id: str, prompt_len: int) -> bool:
 555 |     limit_info = db.get_rate_limit(session_id)
 556 |     now = datetime.datetime.now()
 557 |     
 558 |     if not limit_info:
 559 |         tokens = MAX_TOKENS
 560 |     else:
 561 |         try:
 562 |             last_updated = datetime.datetime.fromisoformat(limit_info["last_updated"])
 563 |             elapsed = (now - last_updated).total_seconds()
 564 |             tokens = min(MAX_TOKENS, limit_info["tokens_remaining"] + elapsed * REFILL_RATE)
 565 |         except Exception:
 566 |             tokens = MAX_TOKENS
 567 |     
 568 |     estimated_tokens = prompt_len / 3.0
 569 |     
 570 |     if tokens < estimated_tokens:
 571 |         return False
 572 |         
 573 |     tokens -= estimated_tokens
 574 |     db.update_rate_limit(session_id, tokens)
 575 |     return True
 576 | 
 577 | @app.post("/approve")
 578 | async def approve_tool(req: ApprovalRequest):
 579 |     status = "approved" if req.action == "approve" else "denied"
 580 |     
 581 |     # Update SQLite database tool approvals
 582 |     db.update_tool_approval(req.sessionId, req.nodeId, req.toolName, "pending", status)
 583 |     # Database is the single source of truth; no in-memory fallback needed
 584 |     # Perform wildcard updates in database (if specific logId is not provided)
 585 |     conn = db.get_db_connection()
 586 |     cursor = conn.cursor()
 587 |     cursor.execute(
 588 |         "UPDATE tool_approvals SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND node_id = ? AND tool_name = ? AND status = 'pending'",
 589 |         (status, req.sessionId, req.nodeId, req.toolName)
 590 |     )
 591 |     conn.commit()
 592 |     conn.close()
 593 |     
 594 |     return {"status": "success", "state": status}
 595 | 
 596 | async def run_cached_flow(cached_data: Dict[str, Any]):
 597 |     metadata = cached_data.get("metadata")
 598 |     if metadata:
 599 |         yield f"event: metadata\ndata: {json.dumps(metadata)}\n\n"
 600 |     
 601 |     text = cached_data.get("text", "")
 602 |     chunk_size = 15
 603 |     for i in range(0, len(text), chunk_size):
 604 |         chunk = text[i:i+chunk_size]
 605 |         yield f"event: text\ndata: {json.dumps(chunk)}\n\n"
 606 |         await asyncio.sleep(0.02)
 607 |     yield "event: done\ndata: {}\n\n"
 608 | 
 609 | def compute_agent_layout(active_agents):
 610 |     """Compute non-overlapping positions for agent nodes using a proper grid layout."""
 611 |     col_groups = {1: [], 2: [], 3: []}
 612 |     for uid, agent, tpl in active_agents:
 613 |         col = tpl.get("col", 2)
 614 |         col_groups[col].append((uid, agent, tpl))
 615 | 
 616 |     COL_X = {1: 80, 2: 380, 3: 680}
 617 |     NODE_HEIGHT = 220
 618 |     VERTICAL_GAP = 40
 619 |     START_Y = 50
 620 | 
 621 |     positions = {}
 622 |     for col, agents_in_col in col_groups.items():
 623 |         x = COL_X[col]
 624 |         for idx, (uid, agent, tpl) in enumerate(agents_in_col):
 625 |             y = START_Y + idx * (NODE_HEIGHT + VERTICAL_GAP)
 626 |             positions[uid] = {"x": x, "y": y}
 627 | 
 628 |     return positions
 629 | 
 630 | @app.post("/orchestrate")
 631 | async def orchestrate(req: OrchestrateRequest):
 632 |     api_key = req.api_key or os.environ.get("GEMINI_API_KEY")
 633 |     if not api_key or api_key == "MY_GEMINI_API_KEY" or api_key == "":
 634 |         raise HTTPException(
 635 |             status_code=400,
 636 |             detail="Gemini API Key is missing. Please configure BYOK in Settings or set the GEMINI_API_KEY environment variable."
 637 |         )
 638 | 
 639 |     # 1. Guardrails check
 640 |     guardrail_err = check_guardrails(req.prompt)
 641 |     if guardrail_err:
 642 |         async def stream_guardrail_err():
 643 |             yield f"event: text\ndata: {json.dumps(guardrail_err)}\n\n"
 644 |             yield "event: done\ndata: {}\n\n"
 645 |         return StreamingResponse(stream_guardrail_err(), media_type="text/event-stream")
 646 | 
 647 |     # In-memory and persistent session id
 648 |     session_id = req.session_id or str(int(datetime.datetime.now().timestamp()))
 649 | 
 650 |     # 2. Rate limiting check
 651 |     if not check_rate_limit(session_id, len(req.prompt)):
 652 |         async def stream_rate_limit_err():
 653 |             yield f"event: text\ndata: {json.dumps('**Rate Limit Exceeded**: Please wait a minute before making more requests.')}\n\n"
 654 |             yield "event: done\ndata: {}\n\n"
 655 |         return StreamingResponse(stream_rate_limit_err(), media_type="text/event-stream")
 656 | 
 657 |     # 3. Semantic caching
 658 |     prompt_hash_overall = hashlib.sha256(req.prompt.encode('utf-8')).hexdigest()
 659 |     prompt_embedding = await get_gemini_embedding(req.prompt, api_key)
 660 |     if prompt_embedding:
 661 |         all_caches = db.load_all_cached_embeddings()
 662 |         for cache in all_caches:
 663 |             sim = cosine_similarity(prompt_embedding, cache["embedding"])
 664 |             if sim > 0.95:
 665 |                 print(f"[SEMANTIC CACHE] Cache hit for overall response. Similarity: {sim:.4f}")
 666 |                 return StreamingResponse(run_cached_flow(cache["response"]), media_type="text/event-stream")
 667 | 
 668 |     # 4. Map history and call planner
 669 |     contents = []
 670 |     if req.history:
 671 |         for msg in req.history:
 672 |             role = "user" if msg.sender == "user" else "model"
 673 |             contents.append({
 674 |                 "role": role,
 675 |                 "parts": [{"text": msg.text}]
 676 |             })
 677 |     
 678 |     contents.append({
 679 |         "role": "user",
 680 |         "parts": [{"text": req.prompt}]
 681 |     })
 682 | 
 683 |     url_orchestrate = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
 684 |     
 685 |     orchestrate_payload = {
 686 |         "contents": contents,
 687 |         "systemInstruction": {
 688 |             "parts": [{"text": ORCHESTRATOR_SYSTEM_INSTRUCTION}]
 689 |         },
 690 |         "generationConfig": {
 691 |             "responseMimeType": "application/json",
 692 |             "responseSchema": orchestration_schema,
 693 |             "temperature": 0.2,
 694 |             "thinkingConfig": {"thinkingBudget": 2048}
 695 |         },
 696 |         "safetySettings": GEMINI_SAFETY_SETTINGS
 697 |     }
 698 | 
 699 |     plan = {
 700 |         "complexity": "simple",
 701 |         "capabilities": [],
 702 |         "thinking_summary": "System defaulted to general mode.",
 703 |         "agent_talk": [{
 704 |             "senderId": "general",
 705 |             "senderName": "General Assistant",
 706 |             "senderIcon": "bot",
 707 |             "text": "Standing by to process your request.",
 708 |             "objective": "Process user requests with precise analysis.",
 709 |             "systemPrompt": "You are Solospace core.",
 710 |             "rules": ["Be descriptive"],
 711 |             "dependencies": []
 712 |         }],
 713 |         "follow_up_suggestions": ["Can you elaborate?", "Show me a detailed implementation example."]
 714 |     }
 715 | 
 716 |     async with httpx.AsyncClient() as client:
 717 |         try:
 718 |             plan_response = await client.post(url_orchestrate, json=orchestrate_payload, timeout=30.0)
 719 |             if plan_response.status_code == 200:
 720 |                 plan_data = plan_response.json()
 721 |                 if "candidates" in plan_data and len(plan_data["candidates"]) > 0:
 722 |                     raw_text = plan_data["candidates"][0]["content"]["parts"][-1]["text"].strip()
 723 |                     plan = json.loads(raw_text)
 724 |         except Exception as e:
 725 |             print(f"[ORCHESTRATION WARNING] Planning failed: {str(e)}")
 726 | 
 727 |     nodes = []
 728 |     edges = []
 729 |     complexity = plan.get("complexity", "simple")
 730 |     
 731 |     # Enforce minimum agents for non-simple tasks
 732 |     if complexity != "simple" and len(plan.get("agent_talk", [])) < 2:
 733 |         print("[WARN] Too few agents for complex/medium task, adding a default assistant agent.")
 734 |         plan.setdefault("agent_talk", []).append({
 735 |             "senderId": "assistant",
 736 |             "senderName": "General Assistant",
 737 |             "senderIcon": "code",
 738 |             "text": "Supports the primary agents with general assistance.",
 739 |             "objective": "Provide supplementary help and context.",
 740 |             "systemPrompt": "You are a helpful assistant that supports other agents.",
 741 |             "rules": ["Be concise", "Do not duplicate work"],
 742 |             "dependencies": [],
 743 |             "tools": ["Web Search", "Memory"]
 744 |         })
 745 | 
 746 |     if complexity == "simple":
 747 |         nodes.append({
 748 |             "id": "general",
 749 |             "type": "custom",
 750 |             "position": {"x": 0, "y": 0},  # Bug 3: dagre handles layout, backend sends zeros
 751 |             "data": {
 752 |                 "name": "General Assistant",
 753 |                 "tag": "GENERAL_CORE",
 754 |                 "status": "ACTIVE",
 755 |                 "metricLabel": "Logic Level",
 756 |                 "metricVal": "90%",
 757 |                 "icon": "bot",
 758 |                 "objective": "Address the user request with natural, accurate, and comprehensive insights.",
 759 |                 "personality": "Helpful, expert, clear-headed",
 760 |                 "systemPrompt": "You are Solospace, an elite assistant.",
 761 |                 "rules": ["Be helpful and concise", "Use rich markdown"],
 762 |                 "tools": ["Web Search", "Memory"],
 763 |                 "temp": 0.7,
 764 |                 "logic": 90,
 765 |                 "empathy": 80,
 766 |                 "context": "128k",
 767 |                 "enabled": True,
 768 |                 "priority": 5,
 769 |                 "toolPermissions": {"Web Search": "ALLOWED", "Memory": "ALLOWED"},
 770 |                 "toolLogs": [],
 771 |                 "dependencies": []
 772 |             }
 773 |         })
 774 |     else:
 775 |         col_mapping = {
 776 |             "research": 1,
 777 |             "auth": 2,
 778 |             "database": 2,
 779 |             "frontend": 2,
 780 |             "backend": 3,
 781 |             "payments": 3
 782 |         }
 783 | 
 784 |         # Built-in templates: provide defaults but agent can override tools via agent_talk
 785 |         AGENT_TEMPLATES = {
 786 |             "research": {"name": "Market Researcher", "tag": "RESEARCH_LEAD_01", "icon": "science", "default_tools": ["Web Search"], "temp": 0.3, "logic": 85, "empathy": 40, "priority": 5, "col": 1},
 787 |             "auth": {"name": "Security Architect", "tag": "AUTH_AUDIT_02", "icon": "science", "default_tools": ["Memory"], "temp": 0.1, "logic": 99, "empathy": 10, "priority": 8, "col": 2},
 788 |             "database": {"name": "Database Admin", "tag": "DB_SCHEMA_03", "icon": "science", "default_tools": ["Memory"], "temp": 0.2, "logic": 95, "empathy": 20, "priority": 7, "col": 2},
 789 |             "frontend": {"name": "UI Specialist", "tag": "UI_DESIGN_04", "icon": "code", "default_tools": ["Browser"], "temp": 0.7, "logic": 75, "empathy": 75, "priority": 6, "col": 2},
 790 |             "backend": {"name": "API Architect", "tag": "API_ENGINE_05", "icon": "code", "default_tools": ["Code Executor"], "temp": 0.2, "logic": 92, "empathy": 25, "priority": 8, "col": 3},
 791 |             "payments": {"name": "Stripe Integrator", "tag": "STRIPE_BILL_06", "icon": "trending_up", "default_tools": ["API Connector"], "temp": 0.4, "logic": 90, "empathy": 40, "priority": 7, "col": 3}
 792 |         }
 793 | 
 794 |         active_agents = []
 795 |         seen_ids = set()
 796 |         for agent in plan.get("agent_talk", []):
 797 |             cap = agent.get("senderId", "")
 798 |             # Deduplicate by senderId — if Gemini sends duplicate, suffix with index
 799 |             unique_id = cap
 800 |             if unique_id in seen_ids:
 801 |                 unique_id = f"{cap}_{len(seen_ids)}"
 802 |             seen_ids.add(unique_id)
 803 |             if cap in AGENT_TEMPLATES:
 804 |                 active_agents.append((unique_id, agent, AGENT_TEMPLATES[cap]))
 805 |             elif cap == "other" or cap not in AGENT_TEMPLATES:
 806 |                 # Dynamic / custom agent
 807 |                 ct = agent.get("custom_template", {})
 808 |                 dynamic_tpl = {
 809 |                     "name": ct.get("name", agent.get("senderName", "Custom Agent")),
 810 |                     "tag": ct.get("tag", f"CUSTOM_{unique_id.upper()[:8]}"),
 811 |                     "icon": ct.get("icon", agent.get("senderIcon", "science")),
 812 |                     "default_tools": ["Web Search", "Memory"],
 813 |                     "temp": ct.get("temp", 0.5),
 814 |                     "logic": ct.get("logic", 80),
 815 |                     "empathy": 50,
 816 |                     "priority": 5,
 817 |                     "col": ct.get("col", 2)
 818 |                 }
 819 |                 active_agents.append((unique_id, agent, dynamic_tpl))
 820 | 
 821 |         positions = compute_agent_layout(active_agents)
 822 |         for uid, agent, tpl in active_agents:
 823 |             pos = positions[uid]
 824 |             x = pos["x"]
 825 |             y = pos["y"]
 826 | 
 827 |             # Agent-defined tools override template defaults
 828 |             agent_tools = agent.get("tools", [])
 829 |             resolved_tools = agent_tools if agent_tools else tpl["default_tools"]
 830 |             # Filter to known tool names for safety
 831 |             valid_tools = {"Web Search", "Memory", "Code Executor", "Browser", "API Connector", "Vision", "Voice", "File Upload"}
 832 |             resolved_tools = [t for t in resolved_tools if t in valid_tools] or tpl["default_tools"]
 833 | 
 834 |             default_metrics = {
 835 |                 "research": ("Sources Scanned", "24 Pages"),
 836 |                 "auth": ("Audit Score", "99%"),
 837 |                 "database": ("Schema Status", "Normalized"),
 838 |                 "frontend": ("UI Score", "95%"),
 839 |                 "backend": ("Execution Rate", "98%"),
 840 |                 "payments": ("Stripe API Status", "Online")
 841 |             }.get(agent.get("senderId", ""), ("Logic Level", "90%"))
 842 | 
 843 |             nodes.append({
 844 |                 "id": uid,
 845 |                 "type": "custom",
 846 |                 "position": {"x": 0, "y": 0},  # Bug 3: dagre handles layout, backend sends zeros
 847 |                 "data": {
 848 |                     "name": agent.get("senderName", tpl["name"]),
 849 |                     "tag": tpl["tag"],
 850 |                     "status": "IDLE",
 851 |                     "metricLabel": default_metrics[0],
 852 |                     "metricVal": default_metrics[1],
 853 |                     "icon": agent.get("senderIcon", tpl["icon"]),
 854 |                     "objective": agent.get("objective", ""),
 855 |                     "personality": "Collaborative Specialist",
 856 |                     "systemPrompt": agent.get("systemPrompt", ""),
 857 |                     "rules": agent.get("rules", []),
 858 |                     "tools": resolved_tools,
 859 |                     "temp": tpl["temp"],
 860 |                     "logic": tpl["logic"],
 861 |                     "empathy": tpl["empathy"],
 862 |                     "context": "128k",
 863 |                     "enabled": True,
 864 |                     "priority": tpl["priority"],
 865 |                     "toolPermissions": {t: "ASK" if t in ["Code Executor", "API Connector"] else "ALLOWED" for t in resolved_tools},
 866 |                     "toolLogs": [],
 867 |                     "dependencies": agent.get("dependencies", [])
 868 |                 }
 869 |             })
 870 | 
 871 |         for node in nodes:
 872 |             for dep in node["data"].get("dependencies", []):
 873 |                 edges.append({
 874 |                     "id": f"e-{dep}-{node['id']}",
 875 |                     "source": dep,
 876 |                     "target": node["id"],
 877 |                     "animated": True,
 878 |                     "type": "custom",
 879 |                     "style": {"stroke": "#60a5fa", "strokeWidth": 2}
 880 |                 })
 881 | 
 882 |     # Decide whether to run full agent flow
 883 |     if not req.execute_agents:
 884 |         # Only planning mode: save session in DB with paused state and return planning metadata
 885 |         db.save_session(
 886 |             session_id=session_id,
 887 |             title=req.prompt[:40] + "..." if len(req.prompt) > 40 else req.prompt,
 888 |             prompt=req.prompt,
 889 |             mode=complexity,
 890 |             nodes=nodes,
 891 |             edges=edges,
 892 |             chat_messages=[
 893 |                 {"id": "user-prompt", "sender": "user", "text": req.prompt, "timestamp": datetime.datetime.now().strftime("%I:%M:%S %p")}
 894 |             ],
 895 |             agent_talk_logs=[],
 896 |             execution_state="paused",
 897 |             status_message="Agent team generated. Customize and proceed.",
 898 |             follow_up_suggestions=plan.get("follow_up_suggestions", [])
 899 |         )
 900 |         
 901 |         async def planning_only_flow():
 902 |             setup_metadata = {
 903 |                 "complexity": complexity,
 904 |                 "capabilities": plan.get("capabilities", []),
 905 |                 "thinking_summary": plan.get("thinking_summary", ""),
 906 |                 "nodes": nodes,
 907 |                 "edges": edges,
 908 |                 "agent_talk": [],
 909 |                 "follow_up_suggestions": plan.get("follow_up_suggestions", [])
 910 |             }
 911 |             yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
 912 |             yield f"event: text\ndata: {json.dumps('✅ Agent team generated. Go to the **Flow** tab to customize agents and click **Proceed** to run them.')}\n\n"
 913 |             yield "event: done\ndata: {}\n\n"
 914 |             
 915 |         return StreamingResponse(planning_only_flow(), media_type="text/event-stream")
 916 |     else:
 917 |         # Existing full execution flow
 918 |         return StreamingResponse(
 919 |             run_agent_execution_loop(
 920 |                 session_id=session_id,
 921 |                 prompt=req.prompt,
 922 |                 history=req.history or [],
 923 |                 api_key=api_key,
 924 |                 nodes=nodes,
 925 |                 edges=edges,
 926 |                 complexity=complexity,
 927 |                 capabilities=plan.get("capabilities", []),
 928 |                 thinking_summary=plan.get("thinking_summary", ""),
 929 |                 follow_up_suggestions=plan.get("follow_up_suggestions", [])
 930 |             ),
 931 |             media_type="text/event-stream"
 932 |         )
 933 | 
 934 | # Session persistence APIs
 935 | @app.get("/sessions")
 936 | async def get_sessions():
 937 |     return db.load_sessions()
 938 | 
 939 | @app.get("/sessions/{session_id}")
 940 | async def get_session(session_id: str):
 941 |     session = db.load_session(session_id)
 942 |     if not session:
 943 |         raise HTTPException(status_code=404, detail="Session not found")
 944 |     return session
 945 | 
 946 | @app.delete("/sessions/{session_id}")
 947 | async def delete_session(session_id: str):
 948 |     db.delete_session(session_id)
 949 |     return {"status": "success"}
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
 961 |     follow_up_suggestions: List[str]
 962 | ):
 963 |     now_str = lambda: datetime.datetime.now().strftime("%I:%M:%S %p")
 964 |     agent_results: Dict[str, str] = {}
 965 |     setup_metadata = {
 966 |         "complexity": complexity,
 967 |         "capabilities": capabilities,
 968 |         "thinking_summary": thinking_summary,
 969 |         "nodes": nodes,
 970 |         "edges": edges,
 971 |         "agent_talk": [],
 972 |         "follow_up_suggestions": follow_up_suggestions
 973 |     }
 974 |     
 975 |     # 1. Dependency Existence Check
 976 |     all_ids = {n["id"] for n in nodes}
 977 |     for node in nodes:
 978 |         if not node.get("data", {}).get("enabled", True):
 979 |             continue
 980 |         for dep in node.get("data", {}).get("dependencies", []):
 981 |             if dep not in all_ids:
 982 |                 error_msg = f"Agent {node['id']} depends on missing agent {dep}"
 983 |                 yield f"event: text\ndata: {json.dumps('**Validation Error**: ' + error_msg)}\n\n"
 984 |                 yield "event: done\ndata: {}\n\n"
 985 |                 return
 986 | 
 987 |     # 2. Cycle Detection Check
 988 |     def has_cycle(graph, current_node, visited, rec_stack):
 989 |         visited[current_node] = True
 990 |         rec_stack[current_node] = True
 991 |         for neighbor in graph.get(current_node, []):
 992 |             if not visited.get(neighbor, False):
 993 |                 if has_cycle(graph, neighbor, visited, rec_stack):
 994 |                     return True
 995 |             elif rec_stack.get(neighbor, False):
 996 |                 return True
 997 |         rec_stack[current_node] = False
 998 |         return False
 999 | 
1000 |     graph = {node["id"]: [d for d in node.get("data", {}).get("dependencies", []) if d in all_ids] for node in nodes}
1001 |     if edges:
1002 |         for edge in edges:
1003 |             target = edge.get("target")
1004 |             source = edge.get("source")
1005 |             if target in graph and source in all_ids:
1006 |                 graph[target].append(source)
1007 | 
1008 |     visited_nodes = {node["id"]: False for node in nodes}
1009 |     for node_id in graph:
1010 |         if not visited_nodes[node_id]:
1011 |             if has_cycle(graph, node_id, visited_nodes, {}):
1012 |                 error_msg = "Circular dependency detected in agent workflow."
1013 |                 yield f"event: text\ndata: {json.dumps('**Validation Error**: ' + error_msg)}\n\n"
1014 |                 yield "event: done\ndata: {}\n\n"
1015 |                 return
1016 | 
1017 |     # Save initial session in DB
1018 |     db.save_session(
1019 |         session_id=session_id,
1020 |         title=prompt[:40] + "..." if len(prompt) > 40 else prompt,
1021 |         prompt=prompt,
1022 |         mode=complexity,
1023 |         nodes=nodes,
1024 |         edges=edges,
1025 |         chat_messages=[],
1026 |         agent_talk_logs=[],
1027 |         execution_state="running",
1028 |         status_message="Running orchestration loop",
1029 |         follow_up_suggestions=follow_up_suggestions
1030 |     )
1031 |     
1032 |     yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1033 | 
1034 |     execution_order = sort_nodes_topologically(nodes, edges)
1035 |     
1036 |     for agent_node in execution_order:
1037 |         node_id = agent_node["id"]
1038 |         agent_data = agent_node["data"]
1039 |         agent_name = agent_data["name"]
1040 |         
1041 |         if not agent_data.get("enabled", True):
1042 |             continue
1043 | 
1044 |         try:
1045 |             # Checkpoint loading
1046 |             checkpoint_state = db.load_checkpoint(session_id, node_id)
1047 |             if checkpoint_state:
1048 |                 agent_results[node_id] = checkpoint_state.get("final_answer", "Completed.")
1049 |                 setup_metadata["agent_talk"].append({
1050 |                     "id": f"agent-log-{node_id}-{now_str()}",
1051 |                     "senderId": node_id,
1052 |                     "senderName": agent_name,
1053 |                     "senderIcon": agent_data["icon"],
1054 |                     "text": checkpoint_state.get("final_answer", "Completed.")[:180],
1055 |                     "timestamp": now_str()
1056 |                 })
1057 |                 continue
1058 | 
1059 |             for n in nodes:
1060 |                 if n["id"] == node_id:
1061 |                     n["data"]["status"] = "ACTIVE"
1062 |             yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1063 |             
1064 |             yield f"event: status\ndata: {json.dumps(f'[{agent_name}] processing...')}\n\n"
1065 |             await asyncio.sleep(0.5)
1066 | 
1067 |             dep_outputs = ""
1068 |             for dep_id in agent_data.get("dependencies", []):
1069 |                 if dep_id in agent_results:
1070 |                     dep_outputs += f"### Input from {dep_id.upper()}:\n{agent_results[dep_id]}\n"
1071 | 
1072 |             memories_context = ""
1073 |             try:
1074 |                 matched_memories = await query_memory(agent_data["objective"], api_key, session_id=session_id)
1075 |                 if matched_memories:
1076 |                     memories_context = "### Relevant Historical Memories:\n" + "\n".join(f"- {m}" for m in matched_memories)
1077 |             except Exception:
1078 |                 pass
1079 | 
1080 |             # Get messages addressed to this agent
1081 |             incoming_msgs = get_messages_for_agent(session_id, node_id)
1082 |             msg_block = ""
1083 |             if incoming_msgs:
1084 |                 msg_block = "### Messages from other agents:\n"
1085 |                 for msg in incoming_msgs:
1086 |                     msg_block += f"- From {msg['from']}: {msg['content']}\n"
1087 |                 # Clear after reading
1088 |                 clear_messages(session_id, node_id)
1089 | 
1090 |             resolved_tools_str = ", ".join(agent_data.get("tools", []))
1091 |             tools_instruction = f"Available tools: {resolved_tools_str}. To use a tool, specify the tool name in 'action' and input in 'action_input'. If you have enough information, set 'action' to 'none' and provide 'final_answer'."
1092 | 
1093 |             agent_history = [{
1094 |                 "role": "user",
1095 |                 "parts": [{"text": f"{tools_instruction}\n\nUser Request: {prompt}\n\n{dep_outputs}\n{memories_context}\n{msg_block}\n\nYour specific objective: {agent_data['objective']}\nPersonality: {agent_data.get('personality', 'Collaborative Specialist')}\nRules: {agent_data['rules']}"}]
1096 |             }]
1097 | 
1098 |             agent_final_answer = "Sub-task completed."
1099 |             url_gemini = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
1100 | 
1101 |             action_execution_history = []
1102 |             max_turns = 6 if complexity != "simple" else 3
1103 | 
1104 |             for turn in range(max_turns):
1105 |                 agent_payload = {
1106 |                     "contents": agent_history,
1107 |                     "systemInstruction": {"parts": [{"text": agent_data["systemPrompt"]}]},
1108 |                     "generationConfig": {
1109 |                         "responseMimeType": "application/json",
1110 |                         "responseSchema": agent_turn_schema,
1111 |                         "temperature": 0.2
1112 |                     },
1113 |                     "safetySettings": GEMINI_SAFETY_SETTINGS
1114 |                 }
1115 | 
1116 |                 action = "none"
1117 |                 observation = ""
1118 |                 try:
1119 |                     async with httpx.AsyncClient() as client:
1120 |                         resp = await client.post(url_gemini, json=agent_payload, timeout=30.0)
1121 |                         if resp.status_code == 200:
1122 |                             turn_text = resp.json()["candidates"][0]["content"]["parts"][-1]["text"].strip()
1123 |                             turn_data = json.loads(turn_text)
1124 |                             
1125 |                             thought = turn_data.get("thought", "")
1126 |                             action = turn_data.get("action", "none")
1127 |                             action_input = turn_data.get("action_input", "")
1128 |                             agent_final_answer = turn_data.get("final_answer", "")
1129 |                             
1130 |                             if thought:
1131 |                                 yield f"event: thinking\ndata: {json.dumps(f'[{agent_name}]: {thought}\\n')}\n\n"
1132 |                         else:
1133 |                             break
1134 |                 except Exception as e:
1135 |                     print(f"ReAct Turn fail: {e}")
1136 |                     break
1137 | 
1138 |                 if action == "none" or agent_final_answer:
1139 |                     break
1140 | 
1141 |                 # Circuit Breaker Check
1142 |                 action_execution_history.append((action, action_input))
1143 |                 if action_execution_history.count((action, action_input)) >= 3:
1144 |                     observation = "Circuit Breaker: Tool executed repeatedly with identical input. Halting loop to prevent infinite spend."
1145 |                     yield f"event: status\ndata: {json.dumps(f'[{agent_name}] circuit breaker halted')}\n\n"
1146 |                     agent_history.append({
1147 |                         "role": "model",
1148 |                         "parts": [{"text": json.dumps(turn_data)}]
1149 |                     })
1150 |                     agent_history.append({
1151 |                         "role": "user",
1152 |                         "parts": [{"text": f"Observation: {observation}"}]
1153 |                     })
1154 |                     continue
1155 | 
1156 |                 t_log_id = f"t-log-{int(datetime.datetime.now().timestamp())}"
1157 |                 t_timestamp = now_str()
1158 |                 
1159 |                 permission = agent_data.get("toolPermissions", {}).get(action, "ALLOWED")
1160 |                 
1161 |                 if permission == "ASK":
1162 |                     new_log = {
1163 |                         "id": t_log_id,
1164 |                         "timestamp": t_timestamp,
1165 |                         "tool": action,
1166 |                         "action": "Execution Request",
1167 |                         "status": "PENDING",
1168 |                         "detail": f"Waiting for user to approve execution of '{action_input[:50]}...'"
1169 |                     }
1170 |                     for n in nodes:
1171 |                         if n["id"] == node_id:
1172 |                             n["data"]["toolLogs"] = [new_log] + n["data"].get("toolLogs", [])
1173 |                     yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1174 |                     
1175 |                     db.create_tool_approval(session_id, node_id, action, action_input, t_log_id)
1176 |                     
1177 |                     yield f"event: tool_approval\ndata: {json.dumps({'sessionId': session_id, 'nodeId': node_id, 'toolName': action, 'action': 'Execution Approval Required', 'detail': action_input[:100], 'logId': t_log_id})}\n\n"
1178 |                     yield f"event: status\ndata: {json.dumps(f'[{agent_name}] waiting for approval to run [{action}]')}\n\n"
1179 | 
1180 |                     # Poll database for verdict (with 120s timeout)
1181 |                     approval_start = time.time()
1182 |                     APPROVAL_TIMEOUT = 120
1183 |                     while True:
1184 |                         approval_status = db.get_tool_approval(session_id, node_id, action, t_log_id)
1185 |                         if approval_status in ["approved", "denied"]:
1186 |                             permission = "ALLOWED" if approval_status == "approved" else "DENIED"
1187 |                             break
1188 |                         if time.time() - approval_start > APPROVAL_TIMEOUT:
1189 |                             permission = "DENIED"
1190 |                             db.update_tool_approval(session_id, node_id, action, t_log_id, "denied")
1191 |                             yield f"event: status\ndata: {json.dumps(f'[{agent_name}] approval timed out, auto-denied')}\n\n"
1192 |                             break
1193 |                         await asyncio.sleep(0.5)
1194 |                     
1195 |                     if permission == "ALLOWED":
1196 |                         for n in nodes:
1197 |                             if n["id"] == node_id:
1198 |                                 n["data"]["toolLogs"] = [{**new_log, "status": "SUCCESS", "detail": f"Approved: {action_input[:50]}"}] + n["data"].get("toolLogs", [])[1:]
1199 |                     else:
1200 |                         for n in nodes:
1201 |                             if n["id"] == node_id:
1202 |                                 n["data"]["toolLogs"] = [{**new_log, "status": "BLOCKED", "detail": "Blocked by user."}] + n["data"].get("toolLogs", [])[1:]
1203 | 
1204 |                 if permission == "ALLOWED":
1205 |                     yield f"event: status\ndata: {json.dumps(f'[{agent_name}] executing [{action}]')}\n\n"
1206 |                     
1207 |                     if action == "web_search":
1208 |                         observation = await execute_web_search(action_input)
1209 |                     elif action == "browse_web":
1210 |                         observation = await execute_web_browse(action_input)
1211 |                     elif action == "execute_code":
1212 |                         observation = await execute_python_code(action_input)
1213 |                     elif action == "api_call":
1214 |                         observation = await execute_api_call(action_input)
1215 |                     elif action == "query_memory":
1216 |                         mem_res = await query_memory(action_input, api_key, session_id=session_id)
1217 |                         observation = "\n".join(mem_res) if mem_res else "No matches found."
1218 |                     elif action == "store_memory":
1219 |                         await store_memory(node_id, action_input, api_key, session_id)
1220 |                         observation = "Saved successfully."
1221 |                     elif action == "send_message":
1222 |                         parts = action_input.split("|", 1)
1223 |                         if len(parts) == 2:
1224 |                             target_agent, content = parts
1225 |                             post_message(session_id, node_id, target_agent, content)
1226 |                             observation = f"Message sent to {target_agent}."
1227 |                         else:
1228 |                             observation = "Invalid send_message format. Use 'target|content'."
1229 |                     elif action in ["analyze_image", "read_file"]:
1230 |                         observation = f"{action} is not yet available in this deployment."
1231 |                     else:
1232 |                         observation = "Mock tool result."
1233 |                     
1234 |                     success_log = {
1235 |                         "id": t_log_id,
1236 |                         "timestamp": now_str(),
1237 |                         "tool": action,
1238 |                         "action": "Call",
1239 |                         "status": "SUCCESS",
1240 |                         "detail": f"Ran tool with inputs: '{action_input[:50]}' -> Output: {observation[:100]}..."
1241 |                     }
1242 |                     for n in nodes:
1243 |                         if n["id"] == node_id:
1244 |                             logs_filtered = [l for l in n["data"].get("toolLogs", []) if l["id"] != t_log_id]
1245 |                             n["data"]["toolLogs"] = [success_log] + logs_filtered
1246 |                 else:
1247 |                     observation = "Execution Blocked: Permission Denied."
1248 |                 
1249 |                 yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1250 |                 
1251 |                 agent_history.append({
1252 |                     "role": "model",
1253 |                     "parts": [{"text": json.dumps(turn_data)}]
1254 |                 })
1255 |                 agent_history.append({
1256 |                     "role": "user",
1257 |                     "parts": [{"text": f"Observation: {observation}"}]
1258 |                 })
1259 | 
1260 |             # Check if agent outcome is default / empty
1261 |             if not agent_final_answer or agent_final_answer.strip() in ["Sub-task completed.", ""]:
1262 |                 synthesis_prompt = f"Based on your objective '{agent_data['objective']}' and the ReAct steps executed, write a concise summary/result of your sub-task."
1263 |                 agent_history.append({"role": "user", "parts": [{"text": synthesis_prompt}]})
1264 |                 try:
1265 |                     async with httpx.AsyncClient() as client:
1266 |                         synth_payload = {
1267 |                             "contents": agent_history,
1268 |                             "systemInstruction": {"parts": [{"text": agent_data["systemPrompt"]}]},
1269 |                             "generationConfig": {"temperature": 0.3},
1270 |                             "safetySettings": GEMINI_SAFETY_SETTINGS
1271 |                         }
1272 |                         synth_resp = await client.post(url_gemini, json=synth_payload, timeout=15.0)
1273 |                         if synth_resp.status_code == 200:
1274 |                             synth_text = synth_resp.json()["candidates"][0]["content"]["parts"][-1]["text"].strip()
1275 |                             if synth_text:
1276 |                                 agent_final_answer = synth_text
1277 |                 except Exception:
1278 |                     pass
1279 | 
1280 |             agent_results[node_id] = agent_final_answer or "Sub-task completed."
1281 |             
1282 |             # Save state checkpoint
1283 |             db.save_checkpoint(session_id, node_id, {"final_answer": agent_final_answer})
1284 |             
1285 |             for n in nodes:
1286 |                 if n["id"] == node_id:
1287 |                     n["data"]["status"] = "IDLE"
1288 |             
1289 |             setup_metadata["agent_talk"].append({
1290 |                 "id": f"agent-log-{node_id}-{now_str()}",
1291 |                 "senderId": node_id,
1292 |                 "senderName": agent_name,
1293 |                 "senderIcon": agent_data["icon"],
1294 |                 "text": agent_final_answer[:180] + "..." if len(agent_final_answer) > 180 else agent_final_answer,
1295 |                 "timestamp": now_str()
1296 |             })
1297 |             yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1298 |             
1299 |             # Only store outcome memory if meaningful
1300 |             if agent_final_answer and len(agent_final_answer) > 40 and agent_final_answer != "Sub-task completed.":
1301 |                 try:
1302 |                     memory_text = f"Objective: {agent_data['objective']}\nOutcome: {agent_final_answer[:500]}"
1303 |                     await store_memory(node_id, memory_text, api_key, session_id)
1304 |                 except Exception:
1305 |                     pass
1306 |         except Exception as e:
1307 |             print(f"[AGENT ERROR] {agent_name} failed: {e}")
1308 |             agent_results[node_id] = f"Agent encountered an error: {str(e)[:200]}"
1309 |             for n in nodes:
1310 |                 if n["id"] == node_id:
1311 |                     n["data"]["status"] = "ERROR"
1312 |             setup_metadata["agent_talk"].append({
1313 |                 "id": f"agent-log-{node_id}-error-{now_str()}",
1314 |                 "senderId": node_id,
1315 |                 "senderName": agent_name,
1316 |                 "senderIcon": agent_data["icon"],
1317 |                 "text": f"⚠ Failed: {str(e)[:150]}",
1318 |                 "timestamp": now_str()
1319 |             })
1320 |             yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1321 |             continue
1322 | 
1323 |     if complexity == "simple" and not agent_results:
1324 |         agent_results["general"] = "Processed the request, but no specific output was generated."
1325 | 
1326 |     yield f"event: status\ndata: {json.dumps('Synthesizing final response...')}\n\n"
1327 | 
1328 |     # Build aggregator prompt — inject relevant memory + agent results
1329 |     aggregator_prompt = ""
1330 |     try:
1331 |         memory_hits = await query_memory(prompt, api_key, top_k=3, agent_id=None, session_id=session_id)
1332 |         if memory_hits:
1333 |             aggregator_prompt += "### Relevant context from past conversation:\n" + "\n".join(f"- {m}" for m in memory_hits) + "\n\n"
1334 |     except Exception:
1335 |         pass
1336 | 
1337 |     if agent_results:
1338 |         aggregator_prompt += "### Analysis context:\n"
1339 |         for _nid, result in agent_results.items():
1340 |             aggregator_prompt += f"{result}\n\n"
1341 | 
1342 |     aggregator_prompt += f"\nUser's current message: {prompt}"
1343 | 
1344 |     # Fallback if aggregator prompt is empty
1345 |     if not aggregator_prompt.strip():
1346 |         aggregator_prompt = f"Answer the following user request concisely and helpfully:\n\n{prompt}"
1347 | 
1348 |     # Build full conversation history for aggregator so it has cross-turn context
1349 |     aggregator_contents = []
1350 |     if history:
1351 |         for msg in history:
1352 |             role = "user" if msg.sender == "user" else "model"
1353 |             aggregator_contents.append({"role": role, "parts": [{"text": msg.text}]})
1354 |     aggregator_contents.append({"role": "user", "parts": [{"text": aggregator_prompt}]})
1355 | 
1356 |     url_stream = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key={api_key}"
1357 |     stream_payload = {
1358 |         "contents": aggregator_contents,
1359 |         "systemInstruction": {
1360 |             "parts": [{"text": RESPONSE_SYSTEM_INSTRUCTION}]
1361 |         },
1362 |         "generationConfig": {
1363 |             "temperature": 0.7
1364 |         },
1365 |         "safetySettings": GEMINI_SAFETY_SETTINGS
1366 |     }
1367 |     
1368 |     line_buf = ""
1369 |     final_synthesis_text = ""
1370 |     async with httpx.AsyncClient() as client:
1371 |         try:
1372 |             async with client.stream("POST", url_stream, json=stream_payload, timeout=90.0) as r:
1373 |                 if r.status_code == 200:
1374 |                     async for chunk in r.aiter_text():
1375 |                         line_buf += chunk
1376 |                         while "\n" in line_buf:
1377 |                             line, line_buf = line_buf.split("\n", 1)
1378 |                             line = line.strip()
1379 |                             if not line:
1380 |                                 continue
1381 |                             if line.startswith("data:"):
1382 |                                 json_str = line[5:].strip()
1383 |                                 if not json_str:
1384 |                                     continue
1385 |                                 try:
1386 |                                     obj = json.loads(json_str)
1387 |                                     for cand in obj.get("candidates", []):
1388 |                                         for part in cand.get("content", {}).get("parts", []):
1389 |                                             if "text" in part:
1390 |                                                 token = part["text"]
1391 |                                                 final_synthesis_text += token
1392 |                                                 yield f"event: text\ndata: {json.dumps(token)}\n\n"
1393 |                                 except Exception:
1394 |                                     pass
1395 |                     # Process trailing buffer content
1396 |                     if line_buf.strip():
1397 |                         line = line_buf.strip()
1398 |                         if line.startswith("data:"):
1399 |                             json_str = line[5:].strip()
1400 |                             if json_str:
1401 |                                 try:
1402 |                                     obj = json.loads(json_str)
1403 |                                     for cand in obj.get("candidates", []):
1404 |                                         for part in cand.get("content", {}).get("parts", []):
1405 |                                             if "text" in part:
1406 |                                                 token = part["text"]
1407 |                                                 final_synthesis_text += token
1408 |                                                 yield f"event: text\ndata: {json.dumps(token)}\n\n"
1409 |                                 except Exception:
1410 |                                     pass
1411 |                 else:
1412 |                     err_bytes = await r.aread()
1413 |                     err_msg = f"**Synthesis error ({r.status_code})**: {err_bytes.decode()}"
1414 |                     yield f"event: text\ndata: {json.dumps(err_msg)}\n\n"
1415 |                     final_synthesis_text = err_msg
1416 |         except Exception as exc:
1417 |             err_msg = f"\n\n*Stream Synthesis Error: {str(exc)}*\n\n"
1418 |             yield f"event: text\ndata: {json.dumps(err_msg)}\n\n"
1419 |             final_synthesis_text = err_msg
1420 | 
1421 |     print(f"[DEBUG] final_synthesis_text length: {len(final_synthesis_text)}")
1422 |     if not final_synthesis_text:
1423 |         print("[ERROR] Aggregator produced empty response")
1424 | 
1425 |     # Save complete session data
1426 |     final_chat_messages = []
1427 |     if history:
1428 |         for msg in history:
1429 |             final_chat_messages.append({"id": f"msg-{id(msg)}", "sender": msg.sender, "text": msg.text, "timestamp": ""})
1430 |     final_chat_messages.append({"id": "user-prompt", "sender": "user", "text": prompt, "timestamp": now_str()})
1431 |     final_chat_messages.append({"id": "ai-response", "sender": "ai", "text": final_synthesis_text, "timestamp": now_str()})
1432 | 
1433 |     db.save_session(
1434 |         session_id=session_id,
1435 |         title=prompt[:40] + "..." if len(prompt) > 40 else prompt,
1436 |         prompt=prompt,
1437 |         mode=complexity,
1438 |         nodes=nodes,
1439 |         edges=edges,
1440 |         chat_messages=final_chat_messages,
1441 |         agent_talk_logs=setup_metadata["agent_talk"],
1442 |         execution_state="setup",
1443 |         status_message="Execution completed",
1444 |         follow_up_suggestions=follow_up_suggestions
1445 |     )
1446 | 
1447 |     # Cache final response
1448 |     cached_val = {
1449 |         "metadata": {
1450 |             "complexity": complexity,
1451 |             "capabilities": capabilities,
1452 |             "thinking_summary": thinking_summary,
1453 |             "nodes": nodes,
1454 |             "edges": edges,
1455 |             "agent_talk": setup_metadata["agent_talk"],
1456 |             "follow_up_suggestions": follow_up_suggestions
1457 |         },
1458 |         "text": final_synthesis_text
1459 |     }
1460 |     
1461 |     # Compute embeddings inside
1462 |     try:
1463 |         prompt_embedding = await get_gemini_embedding(prompt, api_key)
1464 |         if prompt_embedding:
1465 |             prompt_hash_overall = hashlib.sha256(prompt.encode('utf-8')).hexdigest()
1466 |             db.save_cached_response(prompt_hash_overall, prompt, prompt_embedding, cached_val)
1467 |     except Exception:
1468 |         pass
1469 | 
1470 |     # Auto-store this full conversation turn in vector memory for cross-turn recall
1471 |     if final_synthesis_text:
1472 |         try:
1473 |             convo_memory = f"User: {prompt}\nAssistant: {final_synthesis_text[:800]}"
1474 |             await store_memory(f"session_{session_id}", convo_memory, api_key, session_id)
1475 |         except Exception:
1476 |             pass
1477 | 
1478 |     yield "event: done\ndata: {}\n\n"
1479 | 
1480 | @app.post("/execute_custom")
1481 | async def execute_custom(req: ExecuteCustomRequest):
1482 |     api_key = req.api_key or os.environ.get("GEMINI_API_KEY")
1483 |     if not api_key or api_key == "MY_GEMINI_API_KEY" or api_key == "":
1484 |         raise HTTPException(
1485 |             status_code=400,
1486 |             detail="Gemini API Key is missing. Please configure BYOK in Settings."
1487 |         )
1488 | 
1489 |     complexity = "simple" if len(req.nodes) == 1 and req.nodes[0]["id"] == "general" else "custom"
1490 |     capabilities = [n["data"].get("tag", "CUSTOM") for n in req.nodes]
1491 |     
1492 |     return StreamingResponse(
1493 |         run_agent_execution_loop(
1494 |             session_id=req.session_id,
1495 |             prompt=req.prompt,
1496 |             history=req.history or [],
1497 |             api_key=api_key,
1498 |             nodes=req.nodes,
1499 |             edges=req.edges,
1500 |             complexity=complexity,
1501 |             capabilities=capabilities,
1502 |             thinking_summary="Running customized agent workflow",
1503 |             follow_up_suggestions=["Can you explain the agent collaboration?"]
1504 |         ),
1505 |         media_type="text/event-stream"
1506 |     )
1507 | 
1508 |
```

### File: `Backend/memory_store.json`

> 1 lines | 0.0 KB

```json
1 | []
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

> 1484 lines | 77.0 KB

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
  71 | 
  72 |   const triggerSteerOrchestration = useWorkflowStore((s) => s.triggerSteerOrchestration);
  73 |   const setChatMessages = useWorkflowStore((s) => s.setChatMessages);
  74 |   const createSession = useWorkflowStore((s) => s.createSession);
  75 |   const switchSession = useWorkflowStore((s) => s.switchSession);
  76 |   const cancelOrchestration = useWorkflowStore((s) => s.cancelOrchestration);
  77 |   const followUpSuggestions = useWorkflowStore((s) => s.followUpSuggestions);
  78 |   const fetchSessions = useWorkflowStore((s) => s.fetchSessions);
  79 |   const loadSessionFromDb = useWorkflowStore((s) => s.loadSessionFromDb);
  80 |   const deleteSessionFromDb = useWorkflowStore((s) => s.deleteSessionFromDb);
  81 | 
  82 |   const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  83 |   const copyToClipboard = (text: string, msgId: string) => {
  84 |     navigator.clipboard.writeText(text);
  85 |     setCopiedMsgId(msgId);
  86 |     setTimeout(() => setCopiedMsgId(null), 2000);
  87 |   };
  88 | 
  89 |   const chatContainerRef = useRef<HTMLDivElement>(null);
  90 |   const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  91 | 
  92 |   const handleScroll = () => {
  93 |     const container = chatContainerRef.current;
  94 |     if (!container) return;
  95 |     const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
  96 |     setShouldAutoScroll(isAtBottom);
  97 |   };
  98 | 
  99 |   const textareaRef = useRef<HTMLTextAreaElement>(null);
 100 |   const adjustTextareaHeight = () => {
 101 |     const tx = textareaRef.current;
 102 |     if (tx) {
 103 |       tx.style.height = "auto";
 104 |       tx.style.height = `${Math.min(tx.scrollHeight, 200)}px`;
 105 |     }
 106 |   };
 107 | 
 108 |   // Screen and Tab States
 109 |   const [workspaceState, setWorkspaceState] = useState<"home" | "active">("home");
 110 |   const [currentTab, setCurrentTab] = useState<"chat" | "arena">("chat");
 111 |   const [isAutoMode, setIsAutoMode] = useState<boolean>(true);
 112 |   const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(true);
 113 |   const [isLoadingSession, setIsLoadingSession] = useState<boolean>(false);
 114 | 
 115 |   // Input fields
 116 |   const [userQuery, setUserQuery] = useState<string>("");
 117 |   const activeSession = activeSessionId ? sessions[activeSessionId] : null;
 118 |   const activePrompt = activeSession ? activeSession.prompt : "";
 119 | 
 120 |   useEffect(() => {
 121 |     adjustTextareaHeight();
 122 |   }, [userQuery]);
 123 | 
 124 |   // API key — read directly from Zustand (not local state, to avoid disconnect)
 125 |   const [isSecretOpen, setIsSecretOpen] = useState<boolean>(false);
 126 |   const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
 127 | 
 128 |   // Tooltip helper state for collapsed sidebar
 129 |   const [hoveredSidebarItem, setHoveredSidebarItem] = useState<string | null>(null);
 130 | 
 131 |   // Node Configuration Panel
 132 |   const [isConfigPanelOpen, setIsConfigPanelOpen] = useState<boolean>(false);
 133 |   const [newRuleText, setNewRuleText] = useState<string>("");
 134 | 
 135 |   // Chat scroll ref
 136 |   const chatEndRef = useRef<HTMLDivElement>(null);
 137 | 
 138 |   // List of available tools in the Arena tool panel
 139 |   const toolsList = [
 140 |     { name: "Web Search", icon: <Globe className="w-4 h-4" />, desc: "Real-time Google search indices" },
 141 |     { name: "Memory", icon: <Database className="w-4 h-4" />, desc: "Persistent memory vector vault" },
 142 |     { name: "Browser", icon: <Eye className="w-4 h-4" />, desc: "Headless browser sandbox access" },
 143 |     { name: "File Upload", icon: <UploadCloud className="w-4 h-4" />, desc: "Parsing spreadsheet/code datasets" },
 144 |     { name: "Vision", icon: <Eye className="w-4 h-4" />, desc: "Image recognition & layout review" },
 145 |     { name: "Voice", icon: <Mic className="w-4 h-4" />, desc: "Acoustic synthesis & recognition" },
 146 |     { name: "Code Executor", icon: <Terminal className="w-4 h-4" />, desc: "Sandboxed node/python runs" },
 147 |     { name: "API Connector", icon: <GitFork className="w-4 h-4" />, desc: "Synchronize external webhooks" }
 148 |   ];
 149 | 
 150 |   // Sync config panel with selectedNodeId
 151 |   useEffect(() => {
 152 |     if (selectedNodeId) {
 153 |       setIsConfigPanelOpen(true);
 154 |     } else {
 155 |       setIsConfigPanelOpen(false);
 156 |     }
 157 |   }, [selectedNodeId]);
 158 | 
 159 |   // Synchronize modal's local display state when it opens
 160 |   const [apiKeyInput, setApiKeyInput] = useState<string>("");
 161 |   useEffect(() => {
 162 |     if (isSecretOpen) {
 163 |       setApiKeyInput(apiKey || "");
 164 |     }
 165 |   }, [isSecretOpen, apiKey]);
 166 | 
 167 |   // Auto-scroll chat to bottom if enabled
 168 |   useEffect(() => {
 169 |     if (shouldAutoScroll) {
 170 |       chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
 171 |     }
 172 |   }, [chatMessages, isThinking, shouldAutoScroll]);
 173 | 
 174 |   // Load sessions from DB on mount
 175 |   useEffect(() => {
 176 |     fetchSessions().catch(e => console.error("Failed to load sessions:", e));
 177 |   }, []);
 178 | 
 179 |   const handleCloseConfigPanel = () => {
 180 |     setIsConfigPanelOpen(false);
 181 |     setSelectedNodeId(null);
 182 |   };
 183 | 
 184 |   // Orchestrator — always stays in chat first
 185 |   const startOrchestration = (promptText: string) => {
 186 |     if (!promptText.trim()) return;
 187 |     setWorkspaceState("active");
 188 |     setCurrentTab("chat"); // ALWAYS stay in chat
 189 | 
 190 |     let sessionId = activeSessionId;
 191 |     if (!sessionId) {
 192 |       sessionId = createSession(promptText, isAutoMode ? "auto" : "custom");
 193 |     }
 194 | 
 195 |     setExecutionState("running");
 196 |     triggerSteerOrchestration(promptText, isAutoMode);
 197 |     setUserQuery("");
 198 |   };
 199 | 
 200 |   // Node editing actions
 201 |   const handleAddRule = () => {
 202 |     if (!newRuleText.trim() || !selectedNodeId) return;
 203 |     addRule(selectedNodeId, newRuleText.trim());
 204 |     setNewRuleText("");
 205 |   };
 206 | 
 207 |   const handleDeleteRule = (ruleIndex: number) => {
 208 |     if (!selectedNodeId) return;
 209 |     deleteRule(selectedNodeId, ruleIndex);
 210 |   };
 211 | 
 212 |   const activeNodeDetail = nodes.find(n => n.id === selectedNodeId) as any;
 213 | 
 214 |   // ── Thinking indicator bubble
 215 |   const ThinkingBubble = () => (
 216 |     <motion.div
 217 |       initial={{ opacity: 0, y: 8 }}
 218 |       animate={{ opacity: 1, y: 0 }}
 219 |       exit={{ opacity: 0, y: -4 }}
 220 |       className="flex flex-col gap-1.5 py-2 px-1"
 221 |     >
 222 |       <div className="flex items-center gap-2">
 223 |         <span className="text-xs text-neutral-500 italic">Thinking</span>
 224 |         <span className="flex gap-1">
 225 |           {[0, 1, 2].map(i => (
 226 |             <span
 227 |               key={i}
 228 |               className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce"
 229 |               style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
 230 |             />
 231 |           ))}
 232 |         </span>
 233 |       </div>
 234 |       {statusMessage && (
 235 |         <span className="text-[10px] font-mono text-neutral-600 pl-0.5 truncate max-w-sm">
 236 |           {statusMessage}
 237 |         </span>
 238 |       )}
 239 |       {liveThoughts && (
 240 |         <div className="mt-1 text-[10px] text-neutral-500 font-sans leading-relaxed max-w-lg whitespace-pre-wrap border-l-2 border-neutral-800 pl-2">
 241 |           {liveThoughts.slice(-400)}
 242 |         </div>
 243 |       )}
 244 |     </motion.div>
 245 |   );
 246 | 
 247 |   // ── Collapsible agent trace (real data from backend)
 248 |   const AgentTraceBlock = ({ logs, thinkingSummary }: { logs: AgentTalkLog[], thinkingSummary?: string }) => {
 249 |     if (logs.length === 0 && !thinkingSummary) return null;
 250 |     return (
 251 |       <div className="border border-[#1f1f1f] rounded-xl overflow-hidden bg-[#050505] mt-3 max-w-2xl w-full">
 252 |         <details className="group" open>
 253 |           <summary className="flex items-center justify-between p-3 cursor-pointer select-none text-[11px] font-semibold text-neutral-500 hover:text-white hover:bg-neutral-900/40 transition-colors">
 254 |             <div className="flex items-center gap-2">
 255 |               <Sparkles className="w-3 h-3 text-neutral-500 group-hover:text-cyan-400 transition-colors" />
 256 |               <span className="font-mono text-[10px] tracking-wider uppercase">Agent Trace & Thinking</span>
 257 |             </div>
 258 |             <div className="flex items-center gap-2">
 259 |               {logs.length > 0 && <span className="text-[9px] text-neutral-600 font-mono">{logs.length} specialist{logs.length !== 1 ? "s" : ""}</span>}
 260 |               <ChevronRight className="w-3.5 h-3.5 text-neutral-600 group-open:rotate-90 transition-transform" />
 261 |             </div>
 262 |           </summary>
 263 |           <div className="border-t border-[#1f1f1f] p-3 space-y-3 bg-[#030303]">
 264 |             {thinkingSummary && (
 265 |               <div className="space-y-1.5 pb-2 border-b border-[#0d0d0d] last:border-0 last:pb-0">
 266 |                 <span className="text-[9px] font-mono text-neutral-500 font-bold uppercase tracking-wider">Reasoning Process</span>
 267 |                 <p className="text-[11px] text-neutral-400 leading-relaxed font-sans whitespace-pre-wrap">
 268 |                   {thinkingSummary}
 269 |                 </p>
 270 |               </div>
 271 |             )}
 272 |             {logs.map((log) => (
 273 |               <div key={log.id} className="flex gap-2 items-start text-[10.5px] leading-relaxed border-b border-[#0d0d0d] pb-2 last:border-0 last:pb-0">
 274 |                 <div className="w-5 h-5 rounded-md bg-neutral-900 flex items-center justify-center border border-white/5 shrink-0 select-none text-[10px] font-mono text-neutral-400">
 275 |                   {log.senderIcon === "science" ? "[S]" : log.senderIcon === "code" ? "[C]" : log.senderIcon === "trending_up" ? "[T]" : log.senderIcon === "present_to_all" ? "[U]" : "[G]"}
 276 |                 </div>
 277 |                 <div className="flex-1 min-w-0">
 278 |                   <div className="flex justify-between items-baseline select-none">
 279 |                     <span className="font-bold text-white uppercase tracking-wider text-[8.5px] leading-none">{log.senderName}</span>
 280 |                     <span className="text-[7.5px] text-neutral-600 font-mono leading-none">{log.timestamp}</span>
 281 |                   </div>
 282 |                   <p className="text-neutral-400 mt-0.5 font-sans leading-relaxed">{log.text}</p>
 283 |                 </div>
 284 |               </div>
 285 |             ))}
 286 |           </div>
 287 |         </details>
 288 |       </div>
 289 |     );
 290 |   };
 291 | 
 292 |   return (
 293 |     <div className="flex h-screen w-full bg-black text-[#f5f5f5] overflow-hidden font-sans">
 294 | 
 295 |       <aside
 296 |         className={`flex flex-col h-full bg-[#0d0d0d] border-r border-[#1f1f1f] shrink-0 transition-all duration-300 z-30 select-none ${
 297 |           isSidebarExpanded ? "w-64" : "w-[60px]"
 298 |         }`}
 299 |         onClick={(e) => {
 300 |           if (!isSidebarExpanded) {
 301 |             const target = e.target as HTMLElement;
 302 |             if (!target.closest('button, a, input')) {
 303 |               setIsSidebarExpanded(true);
 304 |             }
 305 |           }
 306 |         }}
 307 |       >
 308 |         {/* Top Header Area */}
 309 |         <div className="flex items-center gap-3 h-16 border-b border-[#1f1f1f] px-4 justify-between">
 310 |           {isSidebarExpanded ? (
 311 |             <div className="flex items-center gap-2.5">
 312 |               <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
 313 |                 <Bot className="w-4 h-4 text-black stroke-[2.5]" />
 314 |               </div>
 315 |               <div>
 316 |                 <h1 className="text-sm font-bold text-white tracking-tight leading-none">Solospace</h1>
 317 |               </div>
 318 |             </div>
 319 |           ) : (
 320 |             <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center mx-auto">
 321 |               <Bot className="w-4 h-4 text-black stroke-[2.5]" />
 322 |             </div>
 323 |           )}
 324 |           {isSidebarExpanded && (
 325 |             <button
 326 |               onClick={() => setIsSidebarExpanded(false)}
 327 |               className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 transition-colors cursor-pointer"
 328 |               title="Collapse sidebar"
 329 |             >
 330 |               <ChevronLeft className="w-4 h-4" />
 331 |             </button>
 332 |           )}
 333 |         </div>
 334 | 
 335 |         {/* Sidebar Nav Buttons */}
 336 |         <nav className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto custom-scrollbar">
 337 | 
 338 | 
 339 | 
 340 |           {/* New Chat Button */}
 341 |           <button
 342 |             id="new-chat-btn"
 343 |             onClick={() => {
 344 |               const ctrl = useWorkflowStore.getState().abortController;
 345 |               if (ctrl) ctrl.abort();
 346 | 
 347 |               setWorkspaceState("home");
 348 |               setUserQuery("");
 349 |               useWorkflowStore.setState({
 350 |                 activeSessionId: null,
 351 |                 nodes: [],
 352 |                 edges: [],
 353 |                 chatMessages: [],
 354 |                 agentTalkLogs: [],
 355 |                 executionState: "setup",
 356 |                 statusMessage: "",
 357 |                 isThinking: false,
 358 |                 isOrchestrating: false,
 359 |                 liveThoughts: "",
 360 |                 pendingApproval: null,
 361 |                 followUpSuggestions: [],
 362 |                 abortController: null
 363 |               });
 364 |             }}
 365 |             onMouseEnter={() => setHoveredSidebarItem("New Chat")}
 366 |             onMouseLeave={() => setHoveredSidebarItem(null)}
 367 |             className={`w-full flex items-center rounded-lg transition-all duration-150 py-2.5 cursor-pointer relative ${
 368 |               isSidebarExpanded ? "px-3 gap-3 hover:bg-neutral-900 text-neutral-200" : "justify-center text-neutral-400 hover:bg-neutral-900"
 369 |             }`}
 370 |           >
 371 |             <SquarePlus className="w-5 h-5 stroke-[1.8]" />
 372 |             {isSidebarExpanded && <span className="text-xs font-semibold">New Chat</span>}
 373 |             {!isSidebarExpanded && hoveredSidebarItem === "New Chat" && (
 374 |               <div className="absolute left-[64px] bg-[#1a1a1a] border border-[#2d2d2d] py-1 px-2.5 rounded text-[10px] text-white whitespace-nowrap z-50 pointer-events-none shadow-md">
 375 |                 New Chat
 376 |               </div>
 377 |             )}
 378 |           </button>
 379 | 
 380 |           {/* BYOK Button */}
 381 |           <button
 382 |             id="byok-sidebar-btn"
 383 |             onClick={() => setIsSecretOpen(true)}
 384 |             onMouseEnter={() => setHoveredSidebarItem("BYOK")}
 385 |             onMouseLeave={() => setHoveredSidebarItem(null)}
 386 |             className={`w-full flex items-center rounded-lg transition-all duration-150 py-2.5 cursor-pointer relative ${
 387 |               isSidebarExpanded ? "px-3 gap-3 hover:bg-neutral-900 text-neutral-200" : "justify-center text-neutral-400 hover:bg-neutral-900"
 388 |             }`}
 389 |           >
 390 |             <Key className="w-5 h-5 stroke-[1.8]" />
 391 |             {isSidebarExpanded && <span className="text-xs font-semibold">API Keys</span>}
 392 |             {!isSidebarExpanded && hoveredSidebarItem === "BYOK" && (
 393 |               <div className="absolute left-[64px] bg-[#1a1a1a] border border-[#2d2d2d] py-1 px-2.5 rounded text-[10px] text-white whitespace-nowrap z-50 pointer-events-none shadow-md">
 394 |                 Bring Your Own Key
 395 |               </div>
 396 |             )}
 397 |           </button>
 398 | 
 399 |           {/* Recents Log */}
 400 |           {isSidebarExpanded && (
 401 |             <div className="pt-6 space-y-2 select-none">
 402 |               <div className="flex items-center gap-1.5 px-3">
 403 |                 <History className="w-3.5 h-3.5 text-neutral-600" />
 404 |                 <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest font-mono">Recents</span>
 405 |               </div>
 406 |               <div className="space-y-1 max-h-[220px] overflow-y-auto custom-scrollbar">
 407 |                 {Object.values(sessions).length === 0 ? (
 408 |                   <span className="text-[10px] text-neutral-600 italic px-3 block pt-1">No chats yet.</span>
 409 |                 ) : (
 410 |                   Object.values(sessions).reverse().map((s) => (
 411 |                     <div key={s.id} className="group/session flex items-center justify-between px-2 py-1 rounded-md hover:bg-neutral-900 transition-colors">
 412 |                       <button
 413 |                         disabled={isLoadingSession}
 414 |                         onClick={async () => {
 415 |                           setIsLoadingSession(true);
 416 |                           try {
 417 |                             await loadSessionFromDb(s.id);
 418 |                             setWorkspaceState("active");
 419 |                             setCurrentTab("chat");
 420 |                           } catch (err) {
 421 |                             console.error(err);
 422 |                           } finally {
 423 |                             setIsLoadingSession(false);
 424 |                           }
 425 |                         }}
 426 |                         className={`text-left text-xs truncate font-medium flex-1 cursor-pointer transition-colors ${
 427 |                           activeSessionId === s.id
 428 |                             ? "text-white font-bold"
 429 |                             : "text-neutral-500 hover:text-white"
 430 |                         }`}
 431 |                         title={s.prompt}
 432 |                       >
 433 |                         {s.title}
 434 |                       </button>
 435 |                       <button
 436 |                         onClick={async (e) => {
 437 |                           e.stopPropagation();
 438 |                           if (confirm(`Are you sure you want to delete "${s.title}"?`)) {
 439 |                             await deleteSessionFromDb(s.id);
 440 |                           }
 441 |                         }}
 442 |                         className="opacity-0 group-hover/session:opacity-100 p-1 text-neutral-600 hover:text-rose-400 rounded transition-opacity cursor-pointer"
 443 |                         title="Delete Chat"
 444 |                       >
 445 |                         <Trash2 className="w-3.5 h-3.5" />
 446 |                       </button>
 447 |                     </div>
 448 |                   ))
 449 |                 )}
 450 |               </div>
 451 |             </div>
 452 |           )}
 453 |         </nav>
 454 | 
 455 |         {/* Sidebar Footer */}
 456 |         <div className="p-2 border-t border-[#1f1f1f] space-y-1 select-none">
 457 |           <button
 458 |             onClick={() => alert("Settings panel coming soon.")}
 459 |             className={`w-full flex items-center rounded-lg hover:bg-neutral-900 transition-colors py-2 cursor-pointer ${
 460 |               isSidebarExpanded ? "px-3 gap-3 text-neutral-400 hover:text-white" : "justify-center text-neutral-400 hover:text-white"
 461 |             }`}
 462 |           >
 463 |             <Settings className="w-4 h-4" />
 464 |             {isSidebarExpanded && <span className="text-xs">Settings</span>}
 465 |           </button>
 466 |           <button
 467 |             onClick={() => setIsProfileOpen(true)}
 468 |             className={`w-full flex items-center rounded-lg hover:bg-neutral-900 transition-colors py-2 cursor-pointer ${
 469 |               isSidebarExpanded ? "px-3 gap-3 text-neutral-400 hover:text-white" : "justify-center text-neutral-400 hover:text-white"
 470 |             }`}
 471 |           >
 472 |             <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center shrink-0 border border-neutral-700">
 473 |               <User className="w-3.5 h-3.5 text-neutral-300" />
 474 |             </div>
 475 |             {isSidebarExpanded && <span className="text-xs truncate font-medium">Profile</span>}
 476 |           </button>
 477 |         </div>
 478 |       </aside>
 479 | 
 480 |       <main className="flex-1 flex flex-col min-w-0 bg-[#000000] relative transition-all duration-300">
 481 | 
 482 |         {/* Header */}
 483 |         <header className="flex justify-between items-center w-full px-6 h-16 border-b border-[#141414] shrink-0 z-10 bg-black/85 backdrop-blur-md">
 484 |           <div className="flex items-center gap-2">
 485 |           </div>
 486 | 
 487 |           {/* Tab Switcher — Chat always left, Flow/Arena only visible when complex task ran */}
 488 |           <div className="flex items-center bg-[#0d0d0d] border border-[#1f1f1f] p-[2px] rounded-full select-none">
 489 |             <button
 490 |               id="tab-chat"
 491 |               onClick={() => {
 492 |                 if (workspaceState === "home") return;
 493 |                 setCurrentTab("chat");
 494 |               }}
 495 |               className={`px-6 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
 496 |                 currentTab === "chat" || workspaceState === "home"
 497 |                   ? "bg-neutral-800 text-white"
 498 |                   : "text-neutral-400 hover:text-white"
 499 |               }`}
 500 |             >
 501 |               Chat
 502 |             </button>
 503 |             {/* Flow tab only shown when complex task (nodes exist) */}
 504 |             {workspaceState === "active" && (
 505 |               <button
 506 |                 id="tab-flow"
 507 |                 onClick={() => setCurrentTab("arena")}
 508 |                 className={`px-6 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
 509 |                   currentTab === "arena"
 510 |                     ? "bg-neutral-800 text-white"
 511 |                     : "text-neutral-400 hover:text-white"
 512 |                 }`}
 513 |               >
 514 |                 <GitFork className="w-3 h-3" />
 515 |                 Flow
 516 |                 {nodes.length > 0 && (
 517 |                   <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse ml-0.5" />
 518 |                 )}
 519 |               </button>
 520 |             )}
 521 |           </div>
 522 | 
 523 |           {/* Right Header Controls */}
 524 |           <div className="flex items-center gap-4 select-none">
 525 |             <button
 526 |               onClick={() => alert("Solospace — AI-powered assistant. Enter any prompt to get a complete, detailed response. For complex tasks, use the Flow tab to inspect the multi-agent pipeline.")}
 527 |               className="text-neutral-400 hover:text-white p-1.5 rounded-md hover:bg-neutral-900 transition-colors cursor-pointer"
 528 |             >
 529 |               <HelpCircle className="w-4 h-4 stroke-[1.8]" />
 530 |             </button>
 531 |           </div>
 532 |         </header>
 533 | 
 534 |         {/* View Layout */}
 535 |         <div className="flex-1 relative overflow-hidden">
 536 | 
 537 |           {/* A. HOME SCREEN */}
 538 |           {workspaceState === "home" && (
 539 |             <div className="absolute inset-0 flex flex-col justify-between overflow-y-auto custom-scrollbar">
 540 |               <div />
 541 |               <div className="w-full max-w-2xl mx-auto px-6 py-12 flex flex-col items-center">
 542 |                 <div className="text-center mb-10 space-y-2 select-none">
 543 |                   <h1 className="text-4xl font-extrabold tracking-tight text-white antialiased">
 544 |                     What&apos;s on your mind?
 545 |                   </h1>
 546 |                   <p className="text-sm text-neutral-400 font-sans">
 547 |                     Ask anything. Get a real, complete answer instantly.
 548 |                   </p>
 549 |                 </div>
 550 | 
 551 |                 {/* Search Bar */}
 552 |                 <div className="w-full chatgpt-input-box rounded-[24px] p-2 flex flex-col gap-2">
 553 |                   <div className="flex items-center gap-3">
 554 |                     <button
 555 |                       onClick={() => alert("File attachment coming soon.")}
 556 |                       className="p-2 text-neutral-500 hover:text-neutral-300 rounded-full hover:bg-neutral-900 transition-colors shrink-0 cursor-pointer"
 557 |                       title="Attach File"
 558 |                     >
 559 |                       <UploadCloud className="w-5 h-5 stroke-[1.8]" />
 560 |                     </button>
 561 |                     <textarea
 562 |                       id="home-prompt-input"
 563 |                       rows={1}
 564 |                       value={userQuery}
 565 |                       onChange={(e) => setUserQuery(e.target.value)}
 566 |                       onKeyDown={(e) => {
 567 |                         if (e.key === "Enter" && !e.shiftKey) {
 568 |                           e.preventDefault();
 569 |                           if (userQuery.trim()) startOrchestration(userQuery);
 570 |                         }
 571 |                       }}
 572 |                       placeholder="Describe your idea, problem, or question..."
 573 |                       className="flex-1 bg-transparent text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-0 resize-none py-1.5 custom-scrollbar"
 574 |                       style={{ maxHeight: "150px" }}
 575 |                     />
 576 |                     <div className="flex items-center gap-1.5 shrink-0">
 577 |                       <button
 578 |                         onClick={() => alert("Voice input coming soon.")}
 579 |                         className="p-2 text-neutral-500 hover:text-neutral-300 rounded-full hover:bg-neutral-900 transition-colors cursor-pointer"
 580 |                         title="Voice Input"
 581 |                       >
 582 |                         <Mic className="w-5 h-5 stroke-[1.8]" />
 583 |                       </button>
 584 |                       <button
 585 |                         id="home-send-btn"
 586 |                         onClick={() => startOrchestration(userQuery)}
 587 |                         disabled={!userQuery.trim()}
 588 |                         className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-neutral-200 active:scale-95 disabled:opacity-20 disabled:scale-100 transition-all font-semibold cursor-pointer"
 589 |                         title="Send prompt"
 590 |                       >
 591 |                         <ArrowRight className="w-4 h-4 text-black stroke-[3]" />
 592 |                       </button>
 593 |                     </div>
 594 |                   </div>
 595 |                 </div>
 596 | 
 597 |                 {/* Mode Selector */}
 598 |                 <div className="flex items-center gap-3 mt-5 select-none">
 599 |                   <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Mode:</span>
 600 |                   <button
 601 |                     onClick={() => setIsAutoMode(true)}
 602 |                     className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono border transition-all cursor-pointer ${
 603 |                       isAutoMode
 604 |                         ? "bg-white text-black border-white font-bold"
 605 |                         : "bg-neutral-950 text-neutral-400 border-[#1f1f1f] hover:text-white"
 606 |                     }`}
 607 |                   >
 608 |                     <Zap className="w-3 h-3 stroke-[2]" />
 609 |                     <span>Auto Agent</span>
 610 |                   </button>
 611 |                   <button
 612 |                     onClick={() => setIsAutoMode(false)}
 613 |                     className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono border transition-all cursor-pointer ${
 614 |                       !isAutoMode
 615 |                         ? "bg-white text-black border-white font-bold"
 616 |                         : "bg-neutral-950 text-neutral-400 border-[#1f1f1f] hover:text-white"
 617 |                     }`}
 618 |                   >
 619 |                     <Sliders className="w-3 h-3" />
 620 |                     <span>Custom Agent</span>
 621 |                   </button>
 622 |                 </div>
 623 |               </div>
 624 |               <div />
 625 |             </div>
 626 |           )}
 627 | 
 628 |           {/* B. ACTIVE WORKSPACE */}
 629 |           {workspaceState === "active" && (
 630 |             <div className="absolute inset-0 flex">
 631 | 
 632 |               {/* VIEW 1: CHAT (Primary — always shown first) */}
 633 |               {currentTab === "chat" && (
 634 |                 <div className="flex-1 flex flex-col justify-between overflow-hidden bg-black">
 635 | 
 636 |                   {/* Chat messages */}
 637 |                   <div
 638 |                     ref={chatContainerRef}
 639 |                     onScroll={handleScroll}
 640 |                     className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4"
 641 |                   >
 642 |                     {isLoadingSession ? (
 643 |                       <div className="flex items-center justify-center h-full">
 644 |                         <div className="flex flex-col items-center gap-3 text-neutral-500">
 645 |                           <div className="w-6 h-6 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
 646 |                           <span className="text-xs font-semibold">Loading Session...</span>
 647 |                         </div>
 648 |                       </div>
 649 |                     ) : (
 650 |                       <div className="max-w-5xl mx-auto space-y-4 select-text">
 651 | 
 652 |                       {chatMessages.map((msg, msgIdx) => (
 653 |                         <motion.div
 654 |                           key={msg.id}
 655 |                           initial={{ opacity: 0, y: 12 }}
 656 |                           animate={{ opacity: 1, y: 0 }}
 657 |                           transition={{ duration: 0.3 }}
 658 |                           className={`flex w-full ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
 659 |                         >
 660 |                           {msg.sender === "user" ? (
 661 |                             <div className="max-w-[72%] rounded-3xl px-5 py-3 bg-[#2f2f2f] text-neutral-100 text-sm leading-relaxed">
 662 |                               <p className="whitespace-pre-wrap">{msg.text}</p>
 663 |                             </div>
 664 |                           ) : (
 665 |                             <div className="flex-1 max-w-[88%] flex flex-col items-start space-y-1">
 666 |                               <div className="w-full text-neutral-100 text-sm leading-relaxed px-1 py-2">
 667 |                                 <MarkdownRenderer content={msg.text || "*Streaming response...*"} />
 668 |                                 
 669 |                                 {/* Action Buttons for AI Response */}
 670 |                                 {msg.text && (
 671 |                                   <div className="flex items-center gap-3 mt-4 text-neutral-500 select-none">
 672 |                                     <button
 673 |                                       onClick={() => copyToClipboard(msg.text, msg.id)}
 674 |                                       className="flex items-center gap-1.5 text-[11px] hover:text-neutral-200 transition-colors cursor-pointer p-1 rounded-md hover:bg-neutral-800"
 675 |                                       title="Copy response"
 676 |                                     >
 677 |                                       {copiedMsgId === msg.id ? (
 678 |                                         <>
 679 |                                           <Check className="w-3.5 h-3.5 text-emerald-400" />
 680 |                                           <span className="text-emerald-400 font-medium">Copied</span>
 681 |                                         </>
 682 |                                       ) : (
 683 |                                         <>
 684 |                                           <Copy className="w-3.5 h-3.5" />
 685 |                                           <span>Copy</span>
 686 |                                         </>
 687 |                                       )}
 688 |                                     </button>
 689 |                                     {msgIdx === chatMessages.length - 1 && !isThinking && !isOrchestrating && (
 690 |                                       <button
 691 |                                         onClick={() => {
 692 |                                           const lastUser = chatMessages.slice().reverse().find(m => m.sender === "user");
 693 |                                           if (lastUser) {
 694 |                                             setChatMessages(prev => {
 695 |                                               const lastAiIdx = prev.map((m, i) => m.sender === 'ai' ? i : -1).filter(i => i >= 0).pop();
 696 |                                               if (lastAiIdx !== undefined) {
 697 |                                                 return prev.filter((_, i) => i !== lastAiIdx);
 698 |                                               }
 699 |                                               return prev;
 700 |                                             });
 701 |                                             startOrchestration(lastUser.text);
 702 |                                           }
 703 |                                         }}
 704 |                                         className="flex items-center gap-1.5 text-[11px] hover:text-neutral-200 transition-colors cursor-pointer p-1 rounded-md hover:bg-neutral-800"
 705 |                                         title="Regenerate response"
 706 |                                       >
 707 |                                         <Zap className="w-3.5 h-3.5" />
 708 |                                         <span>Regenerate</span>
 709 |                                       </button>
 710 |                                     )}
 711 |                                   </div>
 712 |                                 )}
 713 |                               </div>
 714 | 
 715 |                               {/* Collapsible trace block and see flow buttons outside bubble */}
 716 |                               {msgIdx === chatMessages.length - 1 && (
 717 |                                 <div className="space-y-3 pt-1 w-full">
 718 |                                   <AgentTraceBlock
 719 |                                     logs={agentTalkLogs}
 720 |                                     thinkingSummary={msg.thinkingSummary}
 721 |                                   />
 722 |                                   
 723 |                                   {!isThinking && !isOrchestrating && nodes.length > 0 && (
 724 |                                     <div className="flex flex-wrap gap-2 pt-1">
 725 |                                       <button
 726 |                                         id="see-flow-btn"
 727 |                                         onClick={() => setCurrentTab("arena")}
 728 |                                         className="px-4 py-2 bg-neutral-950 hover:bg-neutral-900 border border-[#1f1f1f] hover:border-cyan-500/40 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer max-w-max select-none"
 729 |                                       >
 730 |                                         <GitFork className="w-3.5 h-3.5 text-cyan-400" />
 731 |                                         <span>See Agent Flow</span>
 732 |                                         <span className="text-[9px] font-mono text-neutral-600">({nodes.length} agents)</span>
 733 |                                       </button>
 734 | 
 735 |                                       {!isAutoMode && (
 736 |                                         <button
 737 |                                           onClick={() => setCurrentTab("arena")}
 738 |                                           className="px-4 py-2 bg-neutral-950 hover:bg-neutral-900 border border-[#1f1f1f] hover:border-neutral-500 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer max-w-max select-none"
 739 |                                         >
 740 |                                           <Sliders className="w-3.5 h-3.5" />
 741 |                                           <span>Customize Agents</span>
 742 |                                         </button>
 743 |                                       )}
 744 |                                     </div>
 745 |                                   )}
 746 | 
 747 |                                   {!isThinking && !isOrchestrating && followUpSuggestions && followUpSuggestions.length > 0 && (
 748 |                                     <div className="flex flex-wrap gap-2 pt-2 select-none">
 749 |                                       <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-wider self-center">Suggestions:</span>
 750 |                                       {followUpSuggestions.map((suggestion, idx) => (
 751 |                                         <button
 752 |                                           key={idx}
 753 |                                           onClick={() => {
 754 |                                             setUserQuery(suggestion);
 755 |                                             startOrchestration(suggestion);
 756 |                                           }}
 757 |                                           className="px-3 py-1.5 bg-neutral-950 hover:bg-neutral-900 border border-[#1f1f1f] hover:border-cyan-500/30 rounded-full text-[10px] text-neutral-400 hover:text-white transition-all cursor-pointer animate-fade-in"
 758 |                                         >
 759 |                                           {suggestion}
 760 |                                         </button>
 761 |                                       ))}
 762 |                                     </div>
 763 |                                   )}
 764 |                                 </div>
 765 |                               )}
 766 |                             </div>
 767 |                           )}
 768 |                         </motion.div>
 769 |                       ))}
 770 | 
 771 |                       {/* Thinking indicator */}
 772 |                       <AnimatePresence>
 773 |                         {isThinking && <ThinkingBubble />}
 774 |                       </AnimatePresence>
 775 | 
 776 |                       {/* Auto-scroll anchor */}
 777 |                       <div ref={chatEndRef} />
 778 |                     </div>
 779 |                     )}
 780 |                   </div>
 781 | 
 782 |                   {/* Bottom input bar */}
 783 |                   <div className="px-6 py-4 bg-black/60 border-t border-[#141414] backdrop-blur-xl shrink-0 flex flex-col gap-2">
 784 |                     {!isAutoMode && workspaceState === "active" && (
 785 |                       <div className="text-[10px] font-mono text-amber-400 bg-amber-950/30 px-3 py-1 rounded-full self-center border border-amber-500/20 max-w-max select-none">
 786 |                         Planning Mode – Edit agents in Flow, then click Proceed
 787 |                       </div>
 788 |                     )}
 789 |                     <div className="max-w-3xl mx-auto w-full chatgpt-input-box rounded-[24px] p-1.5 flex items-center gap-2">
 790 |                       <textarea
 791 |                         ref={textareaRef}
 792 |                         id="chat-prompt-input"
 793 |                         rows={1}
 794 |                         value={userQuery}
 795 |                         onChange={(e) => setUserQuery(e.target.value)}
 796 |                         onKeyDown={(e) => {
 797 |                           if (e.key === "Enter" && !e.shiftKey) {
 798 |                             e.preventDefault();
 799 |                             if (!isOrchestrating && userQuery.trim()) startOrchestration(userQuery);
 800 |                           }
 801 |                         }}
 802 |                         placeholder={isOrchestrating ? "Streaming response..." : (isAutoMode ? "Ask a follow-up or new question..." : "Enter a new idea to generate agents (no auto-run)...")}
 803 |                         disabled={isOrchestrating}
 804 |                         className="flex-1 bg-transparent text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-0 px-3 py-1.5 disabled:opacity-50 resize-none max-h-40 custom-scrollbar"
 805 |                       />
 806 |                       {isOrchestrating ? (
 807 |                         <button
 808 |                           onClick={cancelOrchestration}
 809 |                           className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-500 active:scale-95 transition-all font-semibold cursor-pointer shrink-0"
 810 |                           title="Stop generating"
 811 |                         >
 812 |                           <Square className="w-3.5 h-3.5 text-white fill-white" />
 813 |                         </button>
 814 |                       ) : (
 815 |                         <button
 816 |                           id="chat-send-btn"
 817 |                           onClick={() => startOrchestration(userQuery)}
 818 |                           disabled={!userQuery.trim() || isThinking}
 819 |                           className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-neutral-200 active:scale-95 disabled:opacity-20 disabled:scale-100 transition-all font-semibold cursor-pointer shrink-0"
 820 |                           title="Send message"
 821 |                         >
 822 |                           <ArrowRight className="w-4 h-4 text-black stroke-[3]" />
 823 |                         </button>
 824 |                       )}
 825 |                     </div>
 826 |                   </div>
 827 |                 </div>
 828 |               )}
 829 | 
 830 |               {/* VIEW 2: ARENA CANVAS (Optional — Flow inspection/editing) */}
 831 |               {currentTab === "arena" && (
 832 |                 <div className="flex-1 relative overflow-hidden bg-[#000000] flex">
 833 | 
 834 |                   {/* Back to chat bar at top */}
 835 |                   <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#0d0d0d]/90 border border-[#1f1f1f] rounded-full px-4 py-2 backdrop-blur-md shadow-xl pointer-events-auto">
 836 |                     <button
 837 |                       onClick={() => setCurrentTab("chat")}
 838 |                       className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer font-mono"
 839 |                     >
 840 |                       <ChevronLeft className="w-3.5 h-3.5" />
 841 |                       Back to Chat
 842 |                     </button>
 843 |                     <span className="text-neutral-700 text-xs">|</span>
 844 |                     <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
 845 |                       Agent Flow — {nodes.length} active
 846 |                     </span>
 847 |                   </div>
 848 | 
 849 |                   {/* FLOATING LEFT SIDE Arena Tools Panel */}
 850 |                   <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col bg-[#0d0d0d]/80 border border-[#1f1f1f] p-1.5 rounded-xl z-20 backdrop-blur-md shadow-2xl">
 851 |                     <div className="text-[8px] font-mono text-neutral-600 uppercase tracking-widest px-2 pb-2 text-center select-none border-b border-[#141414] mb-2 font-bold">
 852 |                       Tools
 853 |                     </div>
 854 |                     {toolsList.map((tool) => (
 855 |                       <div
 856 |                         key={tool.name}
 857 |                         draggable
 858 |                         onDragStart={(e) => e.dataTransfer.setData("toolName", tool.name)}
 859 |                         className="p-2.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-900 transition-all cursor-grab active:cursor-grabbing flex items-center justify-center relative group"
 860 |                       >
 861 |                         {tool.icon}
 862 |                         <div className="absolute left-12 bg-[#0c0c0c] border border-[#1f1f1f] p-2.5 rounded-lg text-left hidden group-hover:block w-40 z-30 shadow-2xl pointer-events-none">
 863 |                           <h4 className="text-[10px] font-bold text-white">{tool.name}</h4>
 864 |                           <p className="text-[9px] text-neutral-400 mt-0.5 leading-relaxed">{tool.desc}</p>
 865 |                           <span className="text-[8px] font-mono text-neutral-600 block mt-1.5 italic">Drag onto agent node</span>
 866 |                         </div>
 867 |                       </div>
 868 |                     ))}
 869 |                   </div>
 870 | 
 871 |                   {/* Flow Arena */}
 872 |                   <FlowArena />
 873 | 
 874 |                   {/* Bottom controls — Proceed & Return to Chat */}
 875 |                   <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center gap-3 font-semibold select-none">
 876 |                     <button
 877 |                       disabled={isOrchestrating}
 878 |                       onClick={async () => {
 879 |                         if (isOrchestrating) return;
 880 |                         // Bug 11: Immediately set orchestrating to prevent double-fire before async fn sets it
 881 |                         useWorkflowStore.setState({ isOrchestrating: true });
 882 |                         setCurrentTab("chat"); // Switch back to chat to see the output stream
 883 |                         const triggerCustomExecution = useWorkflowStore.getState().triggerCustomExecution;
 884 |                         await triggerCustomExecution();
 885 |                       }}
 886 |                       className="bg-white hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-500 text-black font-bold text-xs h-10 px-6 rounded-[24px] shadow-2xl flex items-center gap-1.5 cursor-pointer shrink-0 transition-all active:scale-95 disabled:scale-100 disabled:cursor-not-allowed"
 887 |                     >
 888 |                       {isOrchestrating ? (
 889 |                         <>
 890 |                           <div className="w-3.5 h-3.5 border-2 border-neutral-500 border-t-neutral-200 rounded-full animate-spin" />
 891 |                           <span>Running Flow...</span>
 892 |                         </>
 893 |                       ) : (
 894 |                         <>
 895 |                           <Zap className="w-3.5 h-3.5 text-black fill-black" />
 896 |                           <span>Proceed with Agents</span>
 897 |                         </>
 898 |                       )}
 899 |                     </button>
 900 |                     <button
 901 |                       onClick={() => setCurrentTab("chat")}
 902 |                       className="h-10 px-4 rounded-[24px] border border-[#1f1f1f] hover:border-neutral-600 bg-black/80 backdrop-blur-md text-neutral-400 hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-2xl"
 903 |                     >
 904 |                       Return to Chat
 905 |                     </button>
 906 |                   </div>
 907 |                 </div>
 908 |               )}
 909 |             </div>
 910 |           )}
 911 |         </div>
 912 |       </main>
 913 | 
 914 |       {/* 3. RIGHT Sliding Configuration Edit Panel */}
 915 |       {currentTab === "arena" && (
 916 |         <div
 917 |           className={`fixed top-0 right-0 h-full w-80 bg-[#0c0c0c]/95 border-l border-[#1f1f1f] z-40 flex flex-col justify-between shadow-2xl transition-transform duration-300 right-panel select-none ${
 918 |             isConfigPanelOpen ? "translate-x-0" : "translate-x-full"
 919 |           }`}
 920 |         >
 921 |         <button
 922 |           onClick={handleCloseConfigPanel}
 923 |           className="absolute -left-8 top-1/2 -translate-y-1/2 w-8 h-16 bg-[#0c0c0c]/95 border border-[#1f1f1f] border-r-0 rounded-l-xl flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer"
 924 |         >
 925 |           {isConfigPanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
 926 |         </button>
 927 | 
 928 |         {activeNodeDetail ? (
 929 |           <div className="flex-1 flex flex-col h-full overflow-hidden">
 930 |             <div className="p-5 border-b border-[#1f1f1f] flex justify-between items-center bg-[#0d0d0d]">
 931 |               <div>
 932 |                 <h3 className="text-sm font-bold text-white uppercase tracking-wider">{activeNodeDetail.data.name}</h3>
 933 |                 <span className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest block mt-0.5">{activeNodeDetail.data.tag}</span>
 934 |               </div>
 935 |               <button onClick={handleCloseConfigPanel} className="text-neutral-500 hover:text-white cursor-pointer">
 936 |                 <X className="w-4 h-4" />
 937 |               </button>
 938 |             </div>
 939 | 
 940 |             <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
 941 |               {/* Enable/Disable toggle */}
 942 |               <div className="flex items-center justify-between bg-[#070707] border border-[#1f1f1f] p-3 rounded-xl">
 943 |                 <div className="flex flex-col">
 944 |                   <span className="text-[10px] font-bold text-white uppercase tracking-wider">Active</span>
 945 |                   <span className="text-[9px] text-neutral-500 mt-0.5">Disable to exclude from pipeline</span>
 946 |                 </div>
 947 |                 <button
 948 |                   onClick={() => updateNodeField(activeNodeDetail.id, { enabled: !activeNodeDetail.data.enabled })}
 949 |                   className={`w-10 h-5 rounded-full p-0.5 transition-all duration-200 cursor-pointer ${activeNodeDetail.data.enabled ? "bg-white" : "bg-neutral-800"}`}
 950 |                 >
 951 |                   <div className={`w-4 h-4 rounded-full transition-transform ${activeNodeDetail.data.enabled ? "bg-black translate-x-5" : "bg-neutral-600 translate-x-0"}`} />
 952 |                 </button>
 953 |               </div>
 954 | 
 955 |               {/* Priority Slider */}
 956 |               <div className="space-y-1 bg-[#070707] border border-[#1f1f1f] p-3 rounded-xl">
 957 |                 <div className="flex justify-between items-center text-[9px] font-mono uppercase text-neutral-400 font-bold">
 958 |                   <span>Priority</span>
 959 |                   <span className="text-white">Level {activeNodeDetail.data.priority}</span>
 960 |                 </div>
 961 |                 <input
 962 |                   type="range" min="1" max="10" step="1"
 963 |                   value={activeNodeDetail.data.priority}
 964 |                   onChange={(e) => updateNodeField(activeNodeDetail.id, { priority: parseInt(e.target.value) })}
 965 |                   className="w-full accent-white h-1 bg-[#1f1f1f] rounded-lg appearance-none cursor-pointer mt-2"
 966 |                 />
 967 |               </div>
 968 | 
 969 |               {/* Name */}
 970 |               <div className="space-y-1.5">
 971 |                 <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Agent Name</label>
 972 |                 <input
 973 |                   type="text" value={activeNodeDetail.data.name}
 974 |                   onChange={(e) => updateNodeField(activeNodeDetail.id, { name: e.target.value })}
 975 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-3 py-2 text-xs text-white focus:border-neutral-500 outline-none"
 976 |                 />
 977 |               </div>
 978 | 
 979 |               {/* Personality */}
 980 |               <div className="space-y-1.5">
 981 |                 <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Personality</label>
 982 |                 <input
 983 |                   type="text" value={activeNodeDetail.data.personality}
 984 |                   onChange={(e) => updateNodeField(activeNodeDetail.id, { personality: e.target.value })}
 985 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-3 py-2 text-xs text-white focus:border-neutral-500 outline-none"
 986 |                 />
 987 |               </div>
 988 | 
 989 |               {/* System Prompt */}
 990 |               <div className="space-y-1.5">
 991 |                 <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">System Prompt</label>
 992 |                 <textarea
 993 |                   value={activeNodeDetail.data.systemPrompt}
 994 |                   onChange={(e) => updateNodeField(activeNodeDetail.id, { systemPrompt: e.target.value })}
 995 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg p-3 text-xs text-white focus:border-neutral-500 outline-none min-h-[80px] resize-none leading-relaxed"
 996 |                 />
 997 |               </div>
 998 | 
 999 |               {/* Goal Objective */}
1000 |               <div className="space-y-1.5">
1001 |                 <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Objective</label>
1002 |                 <textarea
1003 |                   value={activeNodeDetail.data.objective}
1004 |                   onChange={(e) => updateNodeField(activeNodeDetail.id, { objective: e.target.value })}
1005 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg p-3 text-xs text-white focus:border-neutral-500 outline-none min-h-[60px] resize-none leading-relaxed"
1006 |                 />
1007 |               </div>
1008 | 
1009 |               {/* Rules */}
1010 |               <div className="space-y-2">
1011 |                 <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold block">Rules</label>
1012 |                 <div className="space-y-1.5">
1013 |                   {activeNodeDetail.data.rules && activeNodeDetail.data.rules.map((rule: any, idx: number) => (
1014 |                     <div key={idx} className="flex gap-2 items-center bg-[#050505] border border-[#1f1f1f] p-2 rounded-lg justify-between">
1015 |                       <span className="text-[10px] text-neutral-300 leading-normal flex-1 pr-2">{rule}</span>
1016 |                       <button onClick={() => handleDeleteRule(idx)} className="text-neutral-500 hover:text-red-400 transition-colors shrink-0 cursor-pointer">
1017 |                         <Trash2 className="w-3.5 h-3.5" />
1018 |                       </button>
1019 |                     </div>
1020 |                   ))}
1021 |                 </div>
1022 |                 <div className="flex gap-2">
1023 |                   <input
1024 |                     type="text" value={newRuleText}
1025 |                     onChange={(e) => setNewRuleText(e.target.value)}
1026 |                     placeholder="Add constraint..."
1027 |                     className="flex-1 bg-[#050505] border border-[#1f1f1f] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-neutral-500"
1028 |                   />
1029 |                   <button onClick={handleAddRule} className="bg-white text-black font-bold text-xs px-3 rounded-lg hover:bg-neutral-200 cursor-pointer">Add</button>
1030 |                 </div>
1031 |               </div>
1032 | 
1033 |               {/* Sliders */}
1034 |               <div className="space-y-4 pt-3 border-t border-[#141414]">
1035 |                 {[
1036 |                   { label: "Creativity", key: "temp", min: 0, max: 1, step: 0.05, display: (v: number) => v.toString() },
1037 |                   { label: "Logic / Depth", key: "logic", min: 10, max: 100, step: 5, display: (v: number) => `${v}%` },
1038 |                   { label: "Empathy", key: "empathy", min: 0, max: 100, step: 5, display: (v: number) => `${v}%` }
1039 |                 ].map(({ label, key, min, max, step, display }) => (
1040 |                   <div key={key} className="space-y-1">
1041 |                     <div className="flex justify-between items-center text-[9px] font-mono uppercase text-neutral-400 font-bold">
1042 |                       <span>{label}</span>
1043 |                       <span className="text-white">{display(activeNodeDetail.data[key])}</span>
1044 |                     </div>
1045 |                     <input
1046 |                       type="range" min={min} max={max} step={step}
1047 |                       value={activeNodeDetail.data[key]}
1048 |                       onChange={(e) => updateNodeField(activeNodeDetail.id, { [key]: key === "temp" ? parseFloat(e.target.value) : parseInt(e.target.value) })}
1049 |                       className="w-full accent-white h-1 bg-[#1f1f1f] rounded-lg appearance-none cursor-pointer"
1050 |                     />
1051 |                   </div>
1052 |                 ))}
1053 |               </div>
1054 | 
1055 |               {/* Tool Integrations */}
1056 |               <div className="pt-5 border-t border-[#141414] space-y-4">
1057 |                 <div className="flex justify-between items-center">
1058 |                   <label className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Tools</label>
1059 |                   <span className="text-[8px] font-mono text-neutral-500 uppercase">Attached: {activeNodeDetail.data.tools?.length || 0}</span>
1060 |                 </div>
1061 |                 <select
1062 |                   id="tool-selector-dropdown"
1063 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 outline-none focus:border-neutral-500"
1064 |                   defaultValue=""
1065 |                   onChange={(e) => {
1066 |                     const toolName = e.target.value;
1067 |                     if (!toolName) return;
1068 |                     const currentTools = activeNodeDetail.data.tools || [];
1069 |                     if (!currentTools.includes(toolName)) {
1070 |                       const updatedTools = [...currentTools, toolName];
1071 |                       const permissions = activeNodeDetail.data.toolPermissions || {};
1072 |                       const updatedPerms = { ...permissions, [toolName]: permissions[toolName] || "ALLOWED" };
1073 |                       updateNodeField(activeNodeDetail.id, { tools: updatedTools, toolPermissions: updatedPerms });
1074 |                     }
1075 |                     e.target.value = "";
1076 |                   }}
1077 |                 >
1078 |                   <option value="" disabled>+ Attach tool...</option>
1079 |                   {["Web Search", "Browser", "Memory", "File Upload", "Code Executor", "Vision", "Voice", "API Connector"]
1080 |                     .filter(tool => !(activeNodeDetail.data.tools || []).includes(tool))
1081 |                     .map((tool: string) => (
1082 |                       <option key={tool} value={tool}>{tool}</option>
1083 |                     ))}
1084 |                 </select>
1085 | 
1086 |                 <div className="space-y-3">
1087 |                   {(!activeNodeDetail.data.tools || activeNodeDetail.data.tools.length === 0) ? (
1088 |                     <div className="bg-[#050505] border border-dashed border-[#1f1f1f] p-4 text-center rounded-xl">
1089 |                       <p className="text-[10px] text-neutral-500">No tools attached.</p>
1090 |                     </div>
1091 |                   ) : (
1092 |                     activeNodeDetail.data.tools.map((tool: any) => {
1093 |                       const currentPermissions = activeNodeDetail.data.toolPermissions || {};
1094 |                       const permission = currentPermissions[tool] || "ALLOWED";
1095 |                       return (
1096 |                         <div key={tool} className="bg-[#050505] border border-[#1f1f1f] p-3 rounded-xl space-y-2">
1097 |                           <div className="flex justify-between items-center">
1098 |                             <span className="text-xs font-bold text-white flex items-center gap-1.5">
1099 |                               <span className={`w-1.5 h-1.5 rounded-full ${permission === "ALLOWED" ? "bg-emerald-500 animate-pulse" : permission === "ASK" ? "bg-amber-500" : "bg-rose-500"}`} />
1100 |                               {tool}
1101 |                             </span>
1102 |                             <button
1103 |                               onClick={() => {
1104 |                                 const updatedTools = (activeNodeDetail.data.tools || []).filter((t: string) => t !== tool);
1105 |                                 const updatedPerms = { ...(activeNodeDetail.data.toolPermissions || {}) };
1106 |                                 delete updatedPerms[tool];
1107 |                                 updateNodeField(activeNodeDetail.id, { tools: updatedTools, toolPermissions: updatedPerms });
1108 |                               }}
1109 |                               className="text-neutral-500 hover:text-red-400 p-1 transition-colors cursor-pointer"
1110 |                             >
1111 |                               <Trash2 className="w-3.5 h-3.5" />
1112 |                             </button>
1113 |                           </div>
1114 |                           <div className="grid grid-cols-3 gap-1 pt-1">
1115 |                             {(["ALLOWED", "ASK", "DENIED"] as const).map((level) => (
1116 |                               <button
1117 |                                 key={level}
1118 |                                 onClick={() => {
1119 |                                   const updatedPerms = { ...(activeNodeDetail.data.toolPermissions || {}), [tool]: level };
1120 |                                   updateNodeField(activeNodeDetail.id, { toolPermissions: updatedPerms });
1121 |                                 }}
1122 |                                 className={`py-1 text-[9px] font-mono font-bold rounded-md border transition-all cursor-pointer ${
1123 |                                   permission === level
1124 |                                     ? level === "ALLOWED" ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/50"
1125 |                                     : level === "ASK" ? "bg-amber-950/40 text-amber-400 border-amber-500/50"
1126 |                                     : "bg-rose-950/40 text-rose-400 border-rose-500/50"
1127 |                                     : "bg-transparent text-neutral-500 border-[#1f1f1f] hover:text-neutral-300"
1128 |                                 }`}
1129 |                               >
1130 |                                 {level === "ALLOWED" ? "ALLOW" : level === "ASK" ? "ASK" : "DENY"}
1131 |                               </button>
1132 |                             ))}
1133 |                           </div>
1134 |                         </div>
1135 |                       );
1136 |                     })
1137 |                   )}
1138 |                 </div>
1139 |               </div>
1140 | 
1141 |               {/* Connections */}
1142 |               <div className="pt-5 border-t border-[#141414] space-y-4">
1143 |                 <div className="flex justify-between items-center">
1144 |                   <label className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Connections</label>
1145 |                   <span className="text-[8px] font-mono text-neutral-500 uppercase">
1146 |                     Links: {edges.filter(c => c.source === activeNodeDetail.id || c.target === activeNodeDetail.id).length}
1147 |                   </span>
1148 |                 </div>
1149 |                 <select
1150 |                   id="connection-selector-dropdown"
1151 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 outline-none focus:border-neutral-500"
1152 |                   defaultValue=""
1153 |                   onChange={(e) => {
1154 |                     const targetId = e.target.value;
1155 |                     if (!targetId) return;
1156 |                     const exists = edges.some(c =>
1157 |                       (c.source === activeNodeDetail.id && c.target === targetId) ||
1158 |                       (c.source === targetId && c.target === activeNodeDetail.id)
1159 |                     );
1160 |                     if (!exists) {
1161 |                       setEdges(prev => [...prev, {
1162 |                         id: `e-${activeNodeDetail.id}-${targetId}`,
1163 |                         source: activeNodeDetail.id,
1164 |                         target: targetId,
1165 |                         animated: true,
1166 |                         type: 'custom'
1167 |                       }]);
1168 |                       // Bug 1: Sync dependency — the target node now depends on this (source) node
1169 |                       const targetNode = nodes.find(n => n.id === targetId);
1170 |                       if (targetNode) {
1171 |                         const currentDeps = (targetNode.data as any).dependencies || [];
1172 |                         if (!currentDeps.includes(activeNodeDetail.id)) {
1173 |                           updateNodeField(targetId, {
1174 |                             dependencies: [...currentDeps, activeNodeDetail.id]
1175 |                           });
1176 |                         }
1177 |                       }
1178 |                     }
1179 |                     e.target.value = "";
1180 |                   }}
1181 |                 >
1182 |                   <option value="" disabled>+ Connect to agent...</option>
1183 |                   {nodes.filter(n => n.id !== activeNodeDetail.id && n.type === 'custom').map(node => (
1184 |                     <option key={node.id} value={node.id}>{(node.data as any).name}</option>
1185 |                   ))}
1186 |                 </select>
1187 |                 <div className="space-y-1.5">
1188 |                   {(() => {
1189 |                     const linkedConns = edges.filter(c => c.source === activeNodeDetail.id || c.target === activeNodeDetail.id);
1190 |                     if (linkedConns.length === 0) {
1191 |                       return (
1192 |                         <div className="bg-[#050505] border border-dashed border-[#1f1f1f] p-3 text-center rounded-xl">
1193 |                           <p className="text-[10px] text-neutral-500">No connections.</p>
1194 |                         </div>
1195 |                       );
1196 |                     }
1197 |                     return linkedConns.map((conn, index) => {
1198 |                       const otherNodeId = conn.source === activeNodeDetail.id ? conn.target : conn.source;
1199 |                       const otherNode = nodes.find(n => n.id === otherNodeId);
1200 |                       return (
1201 |                         <div key={index} className="flex gap-2 items-center bg-[#050505] border border-[#1f1f1f] p-2 rounded-lg justify-between">
1202 |                           <span className="text-[10px] text-neutral-300 leading-normal flex-1 pr-2">
1203 |                             {otherNode ? (otherNode.data as any).name : otherNodeId}
1204 |                           </span>
1205 |                           <button onClick={() => deleteEdge(conn.id)} className="text-neutral-500 hover:text-red-400 transition-colors shrink-0 cursor-pointer">
1206 |                             <Trash2 className="w-3.5 h-3.5" />
1207 |                           </button>
1208 |                         </div>
1209 |                       );
1210 |                     });
1211 |                   })()}
1212 |                 </div>
1213 |               </div>
1214 | 
1215 |               {/* Execution Logs */}
1216 |               <div className="pt-5 border-t border-[#141414] space-y-3">
1217 |                 <div className="flex justify-between items-center">
1218 |                   <label className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Execution Log</label>
1219 |                   <button
1220 |                     onClick={() => updateNodeField(activeNodeDetail.id, { toolLogs: [] })}
1221 |                     className="text-[8px] font-mono text-neutral-500 hover:text-white uppercase transition-colors cursor-pointer"
1222 |                   >
1223 |                     Clear
1224 |                   </button>
1225 |                 </div>
1226 |                 <div className="bg-black border border-[#1f1f1f] rounded-xl p-3 h-44 overflow-y-auto font-mono text-[9px] space-y-1.5 custom-scrollbar">
1227 |                   {(!activeNodeDetail.data.toolLogs || activeNodeDetail.data.toolLogs.length === 0) ? (
1228 |                     <div className="h-full flex items-center justify-center text-neutral-600 text-center">
1229 |                       <span>No logs recorded.</span>
1230 |                     </div>
1231 |                   ) : (
1232 |                     activeNodeDetail.data.toolLogs.map((log: any) => (
1233 |                       <div key={log.id} className="flex gap-1.5 items-start leading-normal text-neutral-300">
1234 |                         <span className="text-neutral-500 shrink-0 select-none">[{log.timestamp}]</span>
1235 |                         <div className="flex-1">
1236 |                           <span className="font-bold text-white uppercase mr-1">[{log.tool}]</span>
1237 |                           <span>{log.detail}</span>
1238 |                         </div>
1239 |                         <span className={`shrink-0 font-bold px-1 rounded-sm text-[8px] ${
1240 |                           log.status === "SUCCESS" ? "bg-emerald-950 text-emerald-400" :
1241 |                           log.status === "PENDING" ? "bg-amber-950 text-amber-400 animate-pulse" :
1242 |                           log.status === "BLOCKED" ? "bg-rose-950 text-rose-400" : "bg-neutral-800 text-neutral-400"
1243 |                         }`}>
1244 |                           {log.status}
1245 |                         </span>
1246 |                       </div>
1247 |                     ))
1248 |                   )}
1249 |                 </div>
1250 | 
1251 |               </div>
1252 |             </div>
1253 | 
1254 |             {/* Footer */}
1255 |             <div className="p-4 border-t border-[#1f1f1f] bg-[#0d0d0d] grid grid-cols-2 gap-3">
1256 |               <button
1257 |                 onClick={() => { handleCloseConfigPanel(); }}
1258 |                 className="py-2.5 border border-[#1f1f1f] text-xs font-semibold text-neutral-400 hover:text-white rounded-lg transition-colors font-mono cursor-pointer"
1259 |               >
1260 |                 Close
1261 |               </button>
1262 |               <button
1263 |                 onClick={() => {
1264 |                   alert("Agent configuration saved.");
1265 |                   handleCloseConfigPanel();
1266 |                 }}
1267 |                 className="py-2.5 bg-white hover:bg-neutral-100 text-black text-xs font-bold rounded-lg transition-all font-mono cursor-pointer"
1268 |               >
1269 |                 Save Config
1270 |               </button>
1271 |             </div>
1272 |           </div>
1273 |         ) : (
1274 |           <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
1275 |             <Bot className="w-12 h-12 text-neutral-700 mb-3 animate-pulse" />
1276 |             <p className="text-xs text-neutral-500">Click any agent node in the Flow to edit its configuration.</p>
1277 |           </div>
1278 |         )}
1279 |         </div>
1280 |       )}
1281 | 
1282 |       {/* 4. Modals & Overlays */}
1283 |       <AnimatePresence>
1284 | 
1285 |         {/* BYOK MODAL */}
1286 |         {isSecretOpen && (
1287 |           <motion.div
1288 |             initial={{ opacity: 0 }}
1289 |             animate={{ opacity: 1 }}
1290 |             exit={{ opacity: 0 }}
1291 |             className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-6 select-none"
1292 |           >
1293 |             <motion.div
1294 |               initial={{ scale: 0.95 }}
1295 |               animate={{ scale: 1 }}
1296 |               exit={{ scale: 0.95 }}
1297 |               className="w-full max-w-md bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl p-6 relative shadow-2xl"
1298 |             >
1299 |               <button onClick={() => setIsSecretOpen(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white cursor-pointer">
1300 |                 <X className="w-5 h-5" />
1301 |               </button>
1302 |               <div className="flex gap-4 items-center mb-6">
1303 |                 <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
1304 |                   <Key className="w-6 h-6 text-white" />
1305 |                 </div>
1306 |                 <div>
1307 |                   <h3 className="text-sm font-bold text-white">API Key Settings</h3>
1308 |                   <p className="text-xs text-neutral-400 font-sans mt-0.5">Connect your Gemini API key to power the AI.</p>
1309 |                 </div>
1310 |               </div>
1311 |               <div className="space-y-4">
1312 |                 <div className="space-y-1.5">
1313 |                   <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">GEMINI_API_KEY</label>
1314 |                   <input
1315 |                     id="api-key-input"
1316 |                     type="password"
1317 |                     placeholder="Enter AIzaSy... key from Google AI Studio"
1318 |                     value={apiKeyInput}
1319 |                     onChange={(e) => setApiKeyInput(e.target.value)}
1320 |                     className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500"
1321 |                   />
1322 |                   <p className="text-[9px] text-neutral-500 font-mono leading-normal">
1323 |                     Get a free key at <span className="text-cyan-400">aistudio.google.com</span>. Your key is stored locally only.
1324 |                   </p>
1325 |                 </div>
1326 |                 <div className="pt-4 flex gap-3">
1327 |                   <button
1328 |                     id="save-api-key-btn"
1329 |                     onClick={() => {
1330 |                       setApiKey(apiKeyInput.trim());
1331 |                       setIsSecretOpen(false);
1332 |                     }}
1333 |                     className="flex-1 py-2.5 bg-white hover:bg-neutral-100 text-black font-bold rounded-xl text-xs font-mono transition-colors cursor-pointer"
1334 |                   >
1335 |                     Save Key
1336 |                   </button>
1337 |                   <button
1338 |                     onClick={() => setIsSecretOpen(false)}
1339 |                     className="px-5 py-2.5 border border-[#1f1f1f] text-neutral-400 hover:text-white rounded-xl text-xs font-mono transition-colors cursor-pointer"
1340 |                   >
1341 |                     Cancel
1342 |                   </button>
1343 |                 </div>
1344 |               </div>
1345 |             </motion.div>
1346 |           </motion.div>
1347 |         )}
1348 | 
1349 |         {/* USER PROFILE MODAL */}
1350 |         {isProfileOpen && (
1351 |           <motion.div
1352 |             initial={{ opacity: 0 }}
1353 |             animate={{ opacity: 1 }}
1354 |             exit={{ opacity: 0 }}
1355 |             className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-6 select-none"
1356 |           >
1357 |             <motion.div
1358 |               initial={{ scale: 0.95 }}
1359 |               animate={{ scale: 1 }}
1360 |               exit={{ scale: 0.95 }}
1361 |               className="w-full max-w-sm bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl p-6 relative shadow-2xl"
1362 |             >
1363 |               <button onClick={() => setIsProfileOpen(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white cursor-pointer">
1364 |                 <X className="w-5 h-5" />
1365 |               </button>
1366 |               <div className="flex flex-col items-center text-center space-y-4 py-4">
1367 |                 <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#1f1f1f] flex items-center justify-center bg-neutral-900">
1368 |                   <User className="w-8 h-8 text-neutral-500" />
1369 |                 </div>
1370 |                 <div>
1371 |                   <h3 className="text-sm font-bold text-white uppercase tracking-wider">User Profile</h3>
1372 |                   <span className="text-xs text-neutral-400 font-mono">solospace_user@gmail.com</span>
1373 |                 </div>
1374 |                 <div className="w-full pt-4 space-y-2 border-t border-[#141414]">
1375 |                   <div className="flex justify-between items-center bg-black py-2 px-3 rounded text-[10px] border border-[#141414] font-mono">
1376 |                     <span className="text-neutral-500">Plan:</span>
1377 |                     <span className="text-white font-bold">Pro</span>
1378 |                   </div>
1379 |                   <div className="flex justify-between items-center bg-black py-2 px-3 rounded text-[10px] border border-[#141414] font-mono">
1380 |                     <span className="text-neutral-500">Sessions:</span>
1381 |                     <span className="text-white font-bold">{Object.values(sessions).length}</span>
1382 |                   </div>
1383 |                 </div>
1384 |                 <button
1385 |                   onClick={() => setIsProfileOpen(false)}
1386 |                   className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-[#1f1f1f] text-neutral-300 hover:text-white font-bold rounded-xl text-xs font-mono transition-colors cursor-pointer"
1387 |                 >
1388 |                   Close
1389 |                 </button>
1390 |               </div>
1391 |             </motion.div>
1392 |           </motion.div>
1393 |         )}
1394 | 
1395 |         {/* TOOL APPROVAL TOAST */}
1396 |         {pendingApproval && (
1397 |           <div className="fixed bottom-6 right-6 w-96 bg-[#0d0d0d] border border-amber-500/50 shadow-[0_0_50px_rgba(245,158,11,0.15)] rounded-2xl p-5 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 select-none">
1398 |             <div className="flex gap-4 items-start">
1399 |               <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 shrink-0">
1400 |                 <Sliders className="w-5 h-5 animate-pulse" />
1401 |               </div>
1402 |               <div className="flex-1 space-y-2">
1403 |                 <div className="flex justify-between items-center">
1404 |                   <span className="text-[10px] font-bold text-amber-500 font-mono tracking-widest uppercase">Permission Required</span>
1405 |                   <span className="text-[9px] text-neutral-500 font-mono">Agent Tool</span>
1406 |                 </div>
1407 |                 <h4 className="text-xs font-bold text-white">
1408 |                   &apos;{(nodes.find(n => n.id === pendingApproval.nodeId)?.data as any)?.name}&apos; wants to use <span className="text-amber-400 font-mono">[{pendingApproval.toolName}]</span>
1409 |                 </h4>
1410 |                 <p className="text-[10px] text-neutral-400 leading-normal">
1411 |                   Action: <span className="text-white font-semibold">{pendingApproval.action}</span> — {pendingApproval.detail}
1412 |                 </p>
1413 |                 <div className="pt-3 flex gap-2">
1414 |                   <button
1415 |                     onClick={() => {
1416 |                       const sessId = pendingApproval.sessionId || activeSessionId || "";
1417 |                       fetch("/api/gemini/approve", {
1418 |                         method: "POST",
1419 |                         headers: { "Content-Type": "application/json" },
1420 |                         body: JSON.stringify({
1421 |                           sessionId: sessId,
1422 |                           nodeId: pendingApproval.nodeId,
1423 |                           toolName: pendingApproval.toolName,
1424 |                           action: "approve"
1425 |                         })
1426 |                       }).catch(e => console.error("Failed to approve tool:", e));
1427 | 
1428 |                       const node = nodes.find(n => n.id === pendingApproval.nodeId);
1429 |                       if (node) {
1430 |                         const updatedLogs = ((node.data as any).toolLogs || []).map((log: any) => {
1431 |                           if (log.id === pendingApproval.logId) {
1432 |                             return { ...log, status: "SUCCESS" as const, detail: `Approved: ${pendingApproval.detail}` };
1433 |                           }
1434 |                           return log;
1435 |                         });
1436 |                         updateNodeField(pendingApproval.nodeId, { toolLogs: updatedLogs });
1437 |                       }
1438 |                       useWorkflowStore.setState({ pendingApproval: null });
1439 |                     }}
1440 |                     className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-lg text-[10px] font-mono transition-colors cursor-pointer"
1441 |                   >
1442 |                     Approve
1443 |                   </button>
1444 |                   <button
1445 |                     onClick={() => {
1446 |                       const sessId = pendingApproval.sessionId || activeSessionId || "";
1447 |                       fetch("/api/gemini/approve", {
1448 |                         method: "POST",
1449 |                         headers: { "Content-Type": "application/json" },
1450 |                         body: JSON.stringify({
1451 |                           sessionId: sessId,
1452 |                           nodeId: pendingApproval.nodeId,
1453 |                           toolName: pendingApproval.toolName,
1454 |                           action: "deny"
1455 |                         })
1456 |                       }).catch(e => console.error("Failed to deny tool:", e));
1457 | 
1458 |                       const node = nodes.find(n => n.id === pendingApproval.nodeId);
1459 |                       if (node) {
1460 |                         const updatedLogs = ((node.data as any).toolLogs || []).map((log: any) => {
1461 |                           if (log.id === pendingApproval.logId) {
1462 |                             return { ...log, status: "BLOCKED" as const, detail: `Denied: ${pendingApproval.detail}` };
1463 |                           }
1464 |                           return log;
1465 |                         });
1466 |                         updateNodeField(pendingApproval.nodeId, { toolLogs: updatedLogs });
1467 |                       }
1468 |                       useWorkflowStore.setState({ pendingApproval: null });
1469 |                     }}
1470 |                     className="px-4 py-2 border border-[#1f1f1f] text-neutral-400 hover:text-white rounded-lg text-[10px] font-mono transition-colors cursor-pointer"
1471 |                   >
1472 |                     Deny
1473 |                   </button>
1474 |                 </div>
1475 |               </div>
1476 |             </div>
1477 |           </div>
1478 |         )}
1479 | 
1480 |       </AnimatePresence>
1481 |     </div>
1482 |   );
1483 | }
1484 |
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

> 939 lines | 29.1 KB

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
101 |   followUpSuggestions: string[];
102 |   liveThoughts: string;
103 |   abortController: AbortController | null;
104 |   cancelOrchestration: () => void;
105 | 
106 |   // Actions
107 |   setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
108 |   setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;
109 |   onNodesChange: OnNodesChange<Node>;
110 |   onEdgesChange: OnEdgesChange;
111 |   onConnect: OnConnect;
112 |   setSelectedNodeId: (id: string | null) => void;
113 |   updateNodeField: (nodeId: string, updates: Partial<CanvasNodeData>) => void;
114 |   addNode: (node: Node) => void;
115 |   deleteNode: (nodeId: string) => void;
116 |   deleteEdge: (edgeId: string) => void;
117 |   addRule: (nodeId: string, rule: string) => void;
118 |   deleteRule: (nodeId: string, ruleIndex: number) => void;
119 |   simulateToolExecution?: never;
120 |   setExecutionState: (state: 'setup' | 'running' | 'paused') => void;
121 |   setIsOrchestrating: (val: boolean) => void;
122 |   setIsThinking: (val: boolean) => void;
123 |   setStatusMessage: (msg: string) => void;
124 |   setChatMessages: (msgs: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
125 |   setAgentTalkLogs: (logs: AgentTalkLog[] | ((prev: AgentTalkLog[]) => AgentTalkLog[])) => void;
126 |   setPendingApproval: (val: PendingApproval | null) => void;
127 | 
128 |   // Session Actions
129 |   createSession: (prompt: string, mode: 'auto' | 'custom') => string;
130 |   switchSession: (sessionId: string) => void;
131 |   saveCurrentSession: () => void;
132 |   fetchSessions: () => Promise<void>;
133 |   loadSessionFromDb: (sessionId: string) => Promise<void>;
134 |   deleteSessionFromDb: (sessionId: string) => Promise<void>;
135 | 
136 |   triggerSteerOrchestration: (promptText: string, execute?: boolean) => void;
137 |   triggerCustomExecution: () => Promise<void>;
138 | }
139 | 
140 | let saveTimeout: any = null;
141 | const debounceSave = (currentSessionId: string, get: any, set: any) => {
142 |   if (saveTimeout) clearTimeout(saveTimeout);
143 |   saveTimeout = setTimeout(() => {
144 |     // Re-verify the session is still active before saving to prevent stale writes
145 |     const activeId = get().activeSessionId;
146 |     if (activeId !== currentSessionId) return;
147 | 
148 |     set((state: any) => {
149 |       // Only save if the session still exists
150 |       if (!state.sessions[currentSessionId]) return state;
151 | 
152 |       const currentSession = {
153 |         id: currentSessionId,
154 |         title: state.sessions[currentSessionId]?.title || "Chat",
155 |         prompt: state.sessions[currentSessionId]?.prompt || "",
156 |         mode: state.sessions[currentSessionId]?.mode || "auto",
157 |         nodes: state.nodes,
158 |         edges: state.edges,
159 |         chatMessages: state.chatMessages,
160 |         agentTalkLogs: state.agentTalkLogs,
161 |         executionState: state.executionState,
162 |         statusMessage: state.statusMessage,
163 |         followUpSuggestions: state.followUpSuggestions
164 |       };
165 |       return { sessions: { ...state.sessions, [currentSessionId]: currentSession } };
166 |     });
167 |   }, 500);
168 | };
169 | 
170 | export const useWorkflowStore = create<WorkflowState>((set, get) => ({
171 |   sessions: {},
172 |   activeSessionId: null,
173 |   nodes: [],
174 |   edges: [],
175 |   selectedNodeId: null,
176 |   executionState: 'setup',
177 |   isOrchestrating: false,
178 |   isThinking: false,
179 |   statusMessage: '',
180 |   chatMessages: [],
181 |   agentTalkLogs: [],
182 |   pendingApproval: null,
183 |   apiKey: null,
184 |   setApiKey: (key) => set({ apiKey: key }),
185 |   followUpSuggestions: [],
186 |   liveThoughts: '',
187 |   abortController: null,
188 |   cancelOrchestration: () => {
189 |     const controller = get().abortController;
190 |     if (controller) {
191 |       controller.abort();
192 |       set({ abortController: null, isOrchestrating: false, isThinking: false });
193 |     }
194 |   },
195 | 
196 |   setNodes: (newNodes) => {
197 |     set((state) => ({
198 |       nodes: typeof newNodes === 'function' ? newNodes(state.nodes) : newNodes
199 |     }));
200 |     get().saveCurrentSession();
201 |   },
202 | 
203 |   setEdges: (newEdges) => {
204 |     set((state) => ({
205 |       edges: typeof newEdges === 'function' ? newEdges(state.edges) : newEdges
206 |     }));
207 |     get().saveCurrentSession();
208 |   },
209 | 
210 |   onNodesChange: (changes) => {
211 |     set((state) => ({
212 |       nodes: applyNodeChanges(changes, state.nodes)
213 |     }));
214 |     get().saveCurrentSession();
215 |   },
216 | 
217 |   onEdgesChange: (changes) => {
218 |     set((state) => ({
219 |       edges: applyEdgeChanges(changes, state.edges)
220 |     }));
221 |     get().saveCurrentSession();
222 |   },
223 | 
224 |   onConnect: (connection) => {
225 |     set((state) => {
226 |       const edge: Edge = {
227 |         ...connection,
228 |         id: `e-${connection.source}-${connection.target}`,
229 |         animated: true,
230 |         type: 'custom',
231 |         style: { stroke: '#06b6d4', strokeWidth: 2 }
232 |       };
233 | 
234 |       // Sync dependency: target node depends on source node
235 |       const updatedNodes = state.nodes.map(node => {
236 |         if (node.id === connection.target) {
237 |           const currentDeps = (node.data as any).dependencies || [];
238 |           if (!currentDeps.includes(connection.source)) {
239 |             return {
240 |               ...node,
241 |               data: { ...node.data, dependencies: [...currentDeps, connection.source] }
242 |             };
243 |           }
244 |         }
245 |         return node;
246 |       });
247 | 
248 |       return { edges: addEdge(edge, state.edges), nodes: updatedNodes };
249 |     });
250 |     get().saveCurrentSession();
251 |   },
252 | 
253 |   setSelectedNodeId: (id) => set({ selectedNodeId: id }),
254 | 
255 |   updateNodeField: (nodeId, updates) => {
256 |     set((state) => ({
257 |       nodes: state.nodes.map((node) => {
258 |         if (node.id === nodeId) {
259 |           return { ...node, data: { ...node.data, ...updates } };
260 |         }
261 |         return node;
262 |       })
263 |     }));
264 |     get().saveCurrentSession();
265 |   },
266 | 
267 |   addNode: (node) => {
268 |     set((state) => ({ nodes: [...state.nodes, node] }));
269 |     get().saveCurrentSession();
270 |   },
271 | 
272 |   deleteNode: (nodeId) => {
273 |     set((state) => ({
274 |       nodes: state.nodes.filter((node) => node.id !== nodeId),
275 |       edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
276 |       selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId
277 |     }));
278 |     get().saveCurrentSession();
279 |   },
280 | 
281 |   deleteEdge: (edgeId) => {
282 |     set((state) => {
283 |       const edge = state.edges.find(e => e.id === edgeId);
284 |       let updatedNodes = state.nodes;
285 | 
286 |       // Sync dependency: remove source from target's dependencies when edge deleted
287 |       if (edge) {
288 |         updatedNodes = state.nodes.map(node => {
289 |           if (node.id === edge.target) {
290 |             const currentDeps = (node.data as any).dependencies || [];
291 |             return {
292 |               ...node,
293 |               data: { ...node.data, dependencies: currentDeps.filter((d: string) => d !== edge.source) }
294 |             };
295 |           }
296 |           return node;
297 |         });
298 |       }
299 | 
300 |       return {
301 |         edges: state.edges.filter(e => e.id !== edgeId),
302 |         nodes: updatedNodes
303 |       };
304 |     });
305 |     get().saveCurrentSession();
306 |   },
307 | 
308 |   addRule: (nodeId, rule) => {
309 |     set((state) => ({
310 |       nodes: state.nodes.map((node) => {
311 |         if (node.id === nodeId) {
312 |           return {
313 |             ...node,
314 |             data: { ...node.data, rules: [...((node.data as any).rules || []), rule] }
315 |           };
316 |         }
317 |         return node;
318 |       })
319 |     }));
320 |     get().saveCurrentSession();
321 |   },
322 | 
323 |   deleteRule: (nodeId, ruleIndex) => {
324 |     set((state) => ({
325 |       nodes: state.nodes.map((node) => {
326 |         if (node.id === nodeId) {
327 |           return {
328 |             ...node,
329 |             data: {
330 |               ...node.data,
331 |               rules: ((node.data as any).rules || []).filter((_: any, idx: number) => idx !== ruleIndex)
332 |             }
333 |           };
334 |         }
335 |         return node;
336 |       })
337 |     }));
338 |     get().saveCurrentSession();
339 |   },
340 | 
341 |   // (simulateToolExecution removed — backend runs real tools)
342 | 
343 |   // State modifiers
344 |   setExecutionState: (state) => {
345 |     set({ executionState: state });
346 |     get().saveCurrentSession();
347 |   },
348 |   setIsOrchestrating: (val) => set({ isOrchestrating: val }),
349 |   setIsThinking: (val) => set({ isThinking: val }),
350 |   setStatusMessage: (msg) => {
351 |     set({ statusMessage: msg });
352 |     get().saveCurrentSession();
353 |   },
354 |   setChatMessages: (msgs) => {
355 |     set((state) => ({
356 |       chatMessages: typeof msgs === 'function' ? msgs(state.chatMessages) : msgs
357 |     }));
358 |     get().saveCurrentSession();
359 |   },
360 |   setAgentTalkLogs: (logs) => {
361 |     set((state) => ({
362 |       agentTalkLogs: typeof logs === 'function' ? logs(state.agentTalkLogs) : logs
363 |     }));
364 |     get().saveCurrentSession();
365 |   },
366 |   setPendingApproval: (val) => set({ pendingApproval: val }),
367 | 
368 |   // Session Actions
369 |   createSession: (prompt, mode) => {
370 |     const sessionId = Date.now().toString();
371 |     const newSession: ChatSession = {
372 |       id: sessionId,
373 |       title: prompt.length > 40 ? prompt.substring(0, 40) + "..." : prompt,
374 |       prompt: prompt,
375 |       mode: mode,
376 |       nodes: [],
377 |       edges: [],
378 |       chatMessages: [],
379 |       agentTalkLogs: [],
380 |       executionState: "setup",
381 |       statusMessage: "",
382 |       followUpSuggestions: []
383 |     };
384 | 
385 |     set((state) => ({
386 |       sessions: { ...state.sessions, [sessionId]: newSession },
387 |       activeSessionId: sessionId,
388 |       nodes: [],
389 |       edges: [],
390 |       chatMessages: [],
391 |       agentTalkLogs: [],
392 |       executionState: "setup",
393 |       statusMessage: "",
394 |       followUpSuggestions: []
395 |     }));
396 | 
397 |     return sessionId;
398 |   },
399 | 
400 |   switchSession: (sessionId) => {
401 |     const currentSessionId = get().activeSessionId;
402 |     if (currentSessionId) {
403 |       const currentSession: ChatSession = {
404 |         id: currentSessionId,
405 |         title: get().sessions[currentSessionId]?.title || "Chat",
406 |         prompt: get().sessions[currentSessionId]?.prompt || "",
407 |         mode: get().sessions[currentSessionId]?.mode || "auto",
408 |         nodes: get().nodes,
409 |         edges: get().edges,
410 |         chatMessages: get().chatMessages,
411 |         agentTalkLogs: get().agentTalkLogs,
412 |         executionState: get().executionState,
413 |         statusMessage: get().statusMessage,
414 |         followUpSuggestions: get().followUpSuggestions
415 |       };
416 |       set((state) => ({
417 |         sessions: { ...state.sessions, [currentSessionId]: currentSession }
418 |       }));
419 |     }
420 | 
421 |     const newSession = get().sessions[sessionId];
422 |     if (newSession) {
423 |       set({
424 |         activeSessionId: sessionId,
425 |         nodes: newSession.nodes,
426 |         edges: newSession.edges,
427 |         chatMessages: newSession.chatMessages,
428 |         agentTalkLogs: newSession.agentTalkLogs,
429 |         executionState: newSession.executionState,
430 |         statusMessage: newSession.statusMessage,
431 |         followUpSuggestions: newSession.followUpSuggestions || [],
432 |         selectedNodeId: null
433 |       });
434 |     }
435 |   },
436 | 
437 |   saveCurrentSession: () => {
438 |     const currentSessionId = get().activeSessionId;
439 |     if (!currentSessionId) return;
440 |     debounceSave(currentSessionId, get, set);
441 |   },
442 | 
443 |   fetchSessions: async () => {
444 |     try {
445 |       const response = await fetch("/api/gemini/sessions");
446 |       if (response.ok) {
447 |         const list = await response.json();
448 |         const updatedSessions: Record<string, ChatSession> = { ...get().sessions };
449 |         for (const s of list) {
450 |           if (!updatedSessions[s.session_id]) {
451 |             updatedSessions[s.session_id] = {
452 |               id: s.session_id,
453 |               title: s.title,
454 |               prompt: s.prompt,
455 |               mode: s.mode,
456 |               nodes: [],
457 |               edges: [],
458 |               chatMessages: [],
459 |               agentTalkLogs: [],
460 |               executionState: s.execution_state,
461 |               statusMessage: s.status_message,
462 |               followUpSuggestions: []
463 |             };
464 |           }
465 |         }
466 |         set({ sessions: updatedSessions });
467 |       }
468 |     } catch (e) {
469 |       console.error("Failed to fetch sessions from DB", e);
470 |     }
471 |   },
472 | 
473 |   loadSessionFromDb: async (sessionId: string) => {
474 |     try {
475 |       const response = await fetch(`/api/gemini/sessions?id=${sessionId}`);
476 |       if (response.ok) {
477 |         const fullSession = await response.json();
478 |         const session: ChatSession = {
479 |           id: fullSession.session_id,
480 |           title: fullSession.title,
481 |           prompt: fullSession.prompt,
482 |           mode: fullSession.mode,
483 |           nodes: fullSession.nodes,
484 |           edges: fullSession.edges,
485 |           chatMessages: fullSession.chat_messages,
486 |           agentTalkLogs: fullSession.agent_talk_logs,
487 |           executionState: fullSession.execution_state,
488 |           statusMessage: fullSession.status_message,
489 |           followUpSuggestions: fullSession.follow_up_suggestions
490 |         };
491 |         
492 |         set((state) => ({
493 |           sessions: { ...state.sessions, [sessionId]: session },
494 |           activeSessionId: sessionId,
495 |           nodes: session.nodes,
496 |           edges: session.edges,
497 |           chatMessages: session.chatMessages,
498 |           agentTalkLogs: session.agentTalkLogs,
499 |           executionState: session.executionState,
500 |           statusMessage: session.statusMessage,
501 |           followUpSuggestions: session.followUpSuggestions || [],
502 |           selectedNodeId: null
503 |         }));
504 |       }
505 |     } catch (e) {
506 |       console.error("Failed to load session from DB", e);
507 |     }
508 |   },
509 | 
510 |   deleteSessionFromDb: async (sessionId: string) => {
511 |     // Abort orchestration if deleting the currently active session
512 |     if (get().activeSessionId === sessionId) {
513 |       const ctrl = get().abortController;
514 |       if (ctrl) ctrl.abort();
515 |     }
516 | 
517 |     try {
518 |       const response = await fetch(`/api/gemini/sessions?id=${sessionId}`, {
519 |         method: "DELETE"
520 |       });
521 |       if (response.ok) {
522 |         set((state) => {
523 |           const updated = { ...state.sessions };
524 |           delete updated[sessionId];
525 |           const newActiveId = state.activeSessionId === sessionId ? null : state.activeSessionId;
526 |           return {
527 |             sessions: updated,
528 |             activeSessionId: newActiveId,
529 |             abortController: state.activeSessionId === sessionId ? null : state.abortController,
530 |             isOrchestrating: state.activeSessionId === sessionId ? false : state.isOrchestrating,
531 |             isThinking: state.activeSessionId === sessionId ? false : state.isThinking,
532 |             ...(newActiveId ? {} : {
533 |               nodes: [],
534 |               edges: [],
535 |               chatMessages: [],
536 |               agentTalkLogs: [],
537 |               executionState: "setup",
538 |               statusMessage: "",
539 |               followUpSuggestions: []
540 |             })
541 |           };
542 |         });
543 |       }
544 |     } catch (e) {
545 |       console.error("Failed to delete session", e);
546 |     }
547 |   },
548 | 
549 |   triggerSteerOrchestration: async (promptText, execute = true) => {
550 |     if (!promptText.trim()) return;
551 | 
552 |     // Abort any active orchestration
553 |     const currentController = get().abortController;
554 |     if (currentController) {
555 |       currentController.abort();
556 |     }
557 | 
558 |     const controller = new AbortController();
559 | 
560 |     const userMsg: ChatMessage = {
561 |       id: Date.now().toString(),
562 |       sender: "user",
563 |       text: promptText,
564 |       timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
565 |     };
566 | 
567 |     set((state) => ({
568 |       chatMessages: [...state.chatMessages, userMsg],
569 |       isOrchestrating: true,
570 |       isThinking: true,
571 |       statusMessage: "",
572 |       liveThoughts: "",
573 |       agentTalkLogs: [],
574 |       followUpSuggestions: [],
575 |       abortController: controller
576 |     }));
577 |     get().saveCurrentSession();
578 | 
579 |     // Create target AI message placeholder
580 |     const aiMsgId = (Date.now() + 1).toString();
581 |     set((state) => ({
582 |       chatMessages: [
583 |         ...state.chatMessages,
584 |         {
585 |           id: aiMsgId,
586 |           sender: "ai",
587 |           text: "",
588 |           thinkingSummary: "",
589 |           timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
590 |         }
591 |       ]
592 |     }));
593 |     get().saveCurrentSession();
594 | 
595 |     try {
596 |       const response = await fetch("/api/gemini/orchestrate", {
597 |         method: "POST",
598 |         headers: { "Content-Type": "application/json" },
599 |         body: JSON.stringify({
600 |           prompt: promptText,
601 |           history: get().chatMessages
602 |             .filter(m => m.id !== aiMsgId) // Exclude current empty prompt placeholder
603 |             .map(m => ({ sender: m.sender, text: m.text })),
604 |           api_key: get().apiKey || "",
605 |           session_id: get().activeSessionId || "",
606 |           execute_agents: execute
607 |         }),
608 |         signal: controller.signal
609 |       });
610 | 
611 |       if (!response.ok) {
612 |         const errData = await response.json().catch(() => ({ detail: "Orchestration failed." }));
613 |         throw new Error(errData.detail || `Server status error: ${response.status}`);
614 |       }
615 | 
616 |       const reader = response.body?.getReader();
617 |       const decoder = new TextDecoder();
618 |       if (!reader) throw new Error("No response stream body reader.");
619 | 
620 |       let assistantResponse = "";
621 |       let thinkingSummary = "";
622 |       let buffer = "";
623 | 
624 |       while (true) {
625 |         const { done, value } = await reader.read();
626 |         if (done) break;
627 | 
628 |         buffer += decoder.decode(value, { stream: true });
629 |         
630 |         const parts = buffer.split("\n\n");
631 |         buffer = parts.pop() || "";
632 | 
633 |         for (const part of parts) {
634 |           if (!part.trim()) continue;
635 | 
636 |           const lines = part.split("\n");
637 |           let eventType = "text";
638 |           let dataLines: string[] = [];
639 | 
640 |           for (const line of lines) {
641 |             if (line.startsWith("event: ")) {
642 |               eventType = line.slice(7);
643 |             } else if (line.startsWith("data: ")) {
644 |               dataLines.push(line.slice(6));
645 |             } else if (line.startsWith("data:")) {
646 |               dataLines.push(line.slice(5));
647 |             }
648 |           }
649 | 
650 |           const dataContent = dataLines.join("\n");
651 | 
652 |           if (eventType === "text") {
653 |             try {
654 |               const textVal = JSON.parse(dataContent);
655 |               assistantResponse += textVal;
656 |               set((state) => ({
657 |                 isThinking: false, // Turn off thinking dots on first text token
658 |                 chatMessages: state.chatMessages.map(m =>
659 |                   m.id === aiMsgId ? { ...m, text: assistantResponse } : m
660 |                 )
661 |               }));
662 |             } catch (e) {
663 |               console.error("Text SSE parse error", e);
664 |             }
665 |           } else if (eventType === "thinking") {
666 |             try {
667 |               const thoughtVal = JSON.parse(dataContent);
668 |               thinkingSummary += thoughtVal;
669 |               set((state) => ({
670 |                 liveThoughts: thinkingSummary,
671 |                 chatMessages: state.chatMessages.map(m =>
672 |                   m.id === aiMsgId ? { ...m, thinkingSummary: thinkingSummary } : m
673 |                 )
674 |               }));
675 |             } catch (e) {
676 |               console.error("Thinking SSE parse error", e);
677 |             }
678 |           } else if (eventType === "status") {
679 |             try {
680 |               const statusVal = JSON.parse(dataContent);
681 |               set({ statusMessage: typeof statusVal === "string" ? statusVal : "" });
682 |             } catch (e) {
683 |               console.error("Status SSE parse error", e);
684 |             }
685 |           } else if (eventType === "metadata") {
686 |             try {
687 |               const meta = JSON.parse(dataContent);
688 |               set({
689 |                 nodes: meta.nodes || [],
690 |                 edges: meta.edges || [],
691 |                 agentTalkLogs: meta.agent_talk || [],
692 |                 followUpSuggestions: meta.follow_up_suggestions || []  // Bug 2: populate suggestions
693 |               });
694 |             } catch (e) {
695 |               console.error("Metadata SSE parse error", e);
696 |             }
697 |           } else if (eventType === "tool_approval") {
698 |             try {
699 |               const approval = JSON.parse(dataContent);
700 |               set({ pendingApproval: approval });
701 |             } catch (e) {
702 |               console.error("Tool approval SSE parse error", e);
703 |             }
704 |           }
705 |         }
706 |       }
707 | 
708 |       if (!assistantResponse) {
709 |         const fallbackMsg = "I'm sorry, I couldn't generate a response. This might be due to a temporary issue with the AI service or an invalid API key. Please check your API key in Settings and try again.";
710 |         set((state) => ({
711 |           chatMessages: state.chatMessages.map(m =>
712 |             m.id === aiMsgId ? { ...m, text: fallbackMsg } : m
713 |           )
714 |         }));
715 |       }
716 | 
717 |       set({ abortController: null });
718 |       get().saveCurrentSession();
719 |     } catch (err: any) {
720 |       if (err.name === 'AbortError') {
721 |         console.log("Steer Orchestration manually aborted.");
722 |         set((state) => ({
723 |           chatMessages: state.chatMessages.map(m =>
724 |             m.id === aiMsgId && !m.text ? { ...m, text: "*Generation stopped by user.*" } : m
725 |           )
726 |         }));
727 |       } else {
728 |         console.error("Steer Orchestration stream error:", err);
729 |         const errorMsg = `**Connection Error.**\n\n${err.message || "Failed to parse stream event source. Check backend logs."}`;
730 |         set((state) => ({
731 |           chatMessages: state.chatMessages.map(m =>
732 |             m.id === aiMsgId ? { ...m, text: errorMsg } : m
733 |           ),
734 |           nodes: [],
735 |           edges: [],
736 |           followUpSuggestions: []
737 |         }));
738 |       }
739 |       set({ abortController: null, isThinking: false, isOrchestrating: false });
740 |       get().saveCurrentSession();
741 |     } finally {
742 |       set({ isOrchestrating: false, isThinking: false, statusMessage: '', liveThoughts: '' });
743 |       get().saveCurrentSession();
744 |     }
745 |   },
746 | 
747 |   triggerCustomExecution: async () => {
748 |     const currentController = get().abortController;
749 |     if (currentController) {
750 |       currentController.abort();
751 |     }
752 | 
753 |     const controller = new AbortController();
754 | 
755 |     const sessionId = get().activeSessionId;
756 |     if (!sessionId) return;
757 | 
758 |     const prompt = get().chatMessages.findLast(m => m.sender === 'user')?.text || "";
759 | 
760 |     set((state) => ({
761 |       isOrchestrating: true,
762 |       isThinking: true,
763 |       statusMessage: "Running custom orchestration loop...",
764 |       liveThoughts: "",
765 |       agentTalkLogs: [],
766 |       followUpSuggestions: [],
767 |       abortController: controller
768 |     }));
769 |     get().saveCurrentSession();
770 | 
771 |     const aiMsgId = Date.now().toString();
772 |     set((state) => ({
773 |       chatMessages: [
774 |         ...state.chatMessages,
775 |         {
776 |           id: aiMsgId,
777 |           sender: "ai",
778 |           text: "",
779 |           thinkingSummary: "",
780 |           timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
781 |         }
782 |       ]
783 |     }));
784 |     get().saveCurrentSession();
785 | 
786 |     try {
787 |       const response = await fetch("/api/gemini/execute_custom", {
788 |         method: "POST",
789 |         headers: { "Content-Type": "application/json" },
790 |         body: JSON.stringify({
791 |           session_id: sessionId,
792 |           prompt: prompt,
793 |           history: get().chatMessages
794 |             .filter(m => m.id !== aiMsgId)
795 |             .map(m => ({ sender: m.sender, text: m.text })),
796 |           api_key: get().apiKey || "",
797 |           nodes: get().nodes,
798 |           edges: get().edges
799 |         }),
800 |         signal: controller.signal
801 |       });
802 | 
803 |       if (!response.ok) {
804 |         const errData = await response.json().catch(() => ({ detail: "Execution failed." }));
805 |         throw new Error(errData.detail || `Server status error: ${response.status}`);
806 |       }
807 | 
808 |       const reader = response.body?.getReader();
809 |       const decoder = new TextDecoder();
810 |       if (!reader) throw new Error("No response stream body reader.");
811 | 
812 |       let assistantResponse = "";
813 |       let thinkingSummary = "";
814 |       let buffer = "";
815 | 
816 |       while (true) {
817 |         const { done, value } = await reader.read();
818 |         if (done) break;
819 | 
820 |         buffer += decoder.decode(value, { stream: true });
821 |         
822 |         const parts = buffer.split("\n\n");
823 |         buffer = parts.pop() || "";
824 | 
825 |         for (const part of parts) {
826 |           if (!part.trim()) continue;
827 | 
828 |           const lines = part.split("\n");
829 |           let eventType = "text";
830 |           let dataLines: string[] = [];
831 | 
832 |           for (const line of lines) {
833 |             if (line.startsWith("event: ")) {
834 |               eventType = line.slice(7);
835 |             } else if (line.startsWith("data: ")) {
836 |               dataLines.push(line.slice(6));
837 |             } else if (line.startsWith("data:")) {
838 |               dataLines.push(line.slice(5));
839 |             }
840 |           }
841 | 
842 |           const dataContent = dataLines.join("\n");
843 | 
844 |           if (eventType === "text") {
845 |             try {
846 |               const textVal = JSON.parse(dataContent);
847 |               assistantResponse += textVal;
848 |               set((state) => ({
849 |                 isThinking: false,
850 |                 chatMessages: state.chatMessages.map(m =>
851 |                   m.id === aiMsgId ? { ...m, text: assistantResponse } : m
852 |                 )
853 |               }));
854 |             } catch (e) {
855 |               console.error("Text SSE parse error", e);
856 |             }
857 |           } else if (eventType === "thinking") {
858 |             try {
859 |               const thoughtVal = JSON.parse(dataContent);
860 |               thinkingSummary += thoughtVal;
861 |               set((state) => ({
862 |                 liveThoughts: thinkingSummary,
863 |                 chatMessages: state.chatMessages.map(m =>
864 |                   m.id === aiMsgId ? { ...m, thinkingSummary: thinkingSummary } : m
865 |                 )
866 |               }));
867 |             } catch (e) {
868 |               console.error("Thinking SSE parse error", e);
869 |             }
870 |           } else if (eventType === "status") {
871 |             try {
872 |               const statusVal = JSON.parse(dataContent);
873 |               set({ statusMessage: typeof statusVal === "string" ? statusVal : "" });
874 |             } catch (e) {
875 |               console.error("Status SSE parse error", e);
876 |             }
877 |           } else if (eventType === "metadata") {
878 |             try {
879 |               const meta = JSON.parse(dataContent);
880 |               set({
881 |                 nodes: meta.nodes || [],
882 |                 edges: meta.edges || [],
883 |                 agentTalkLogs: meta.agent_talk || [],
884 |                 followUpSuggestions: meta.follow_up_suggestions || []  // Bug 2: populate suggestions
885 |               });
886 |             } catch (e) {
887 |               console.error("Metadata SSE parse error", e);
888 |             }
889 |           } else if (eventType === "tool_approval") {
890 |             try {
891 |               const approval = JSON.parse(dataContent);
892 |               set({ pendingApproval: approval });
893 |             } catch (e) {
894 |               console.error("Tool approval SSE parse error", e);
895 |             }
896 |           }
897 |         }
898 |       }
899 | 
900 |       if (!assistantResponse) {
901 |         const fallbackMsg = "I'm sorry, I couldn't generate a response. This might be due to a temporary issue with the AI service or an invalid API key. Please check your API key in Settings and try again.";
902 |         set((state) => ({
903 |           chatMessages: state.chatMessages.map(m =>
904 |             m.id === aiMsgId ? { ...m, text: fallbackMsg } : m
905 |           )
906 |         }));
907 |       }
908 | 
909 |       set({ abortController: null });
910 |       get().saveCurrentSession();
911 |     } catch (err: any) {
912 |       if (err.name === 'AbortError') {
913 |         console.log("Steer Orchestration manually aborted.");
914 |         set((state) => ({
915 |           chatMessages: state.chatMessages.map(m =>
916 |             m.id === aiMsgId && !m.text ? { ...m, text: "*Generation stopped by user.*" } : m
917 |           )
918 |         }));
919 |       } else {
920 |         console.error("Steer Orchestration stream error:", err);
921 |         const errorMsg = `**Connection Error.**\n\n${err.message || "Failed to parse stream event source. Check backend logs."}`;
922 |         set((state) => ({
923 |           chatMessages: state.chatMessages.map(m =>
924 |             m.id === aiMsgId ? { ...m, text: errorMsg } : m
925 |           ),
926 |           nodes: [],
927 |           edges: [],
928 |           followUpSuggestions: []
929 |         }));
930 |       }
931 |       set({ abortController: null, isThinking: false, isOrchestrating: false });
932 |       get().saveCurrentSession();
933 |     } finally {
934 |       set({ isOrchestrating: false, isThinking: false, statusMessage: '', liveThoughts: '' });
935 |       get().saveCurrentSession();
936 |     }
937 |   }
938 | }));
939 |
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
