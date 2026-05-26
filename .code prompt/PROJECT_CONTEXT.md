# Full Project Context

> Generated: 2026-05-26T09:35:23.918Z
> Mode: Full Project
> Files: 30
> Total Lines: 5,585
> Total Size: 213.5 KB
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

> 1208 lines | 49.2 KB

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
  10 | from fastapi import FastAPI, HTTPException
  11 | from fastapi.middleware.cors import CORSMiddleware
  12 | from fastapi.responses import StreamingResponse
  13 | from pydantic import BaseModel
  14 | from typing import Optional, List, Dict, Any
  15 | from bs4 import BeautifulSoup
  16 | import db
  17 | from agent_messages import post_message, get_messages_for_agent, clear_messages
  18 | 
  19 | 
  20 | # Initialize database
  21 | db.init_db()
  22 | 
  23 | app = FastAPI(title="Solospace Python Orchestrator API")
  24 | 
  25 | # Allow Next.js frontend to reach this API (critical on Windows / localhost dev)
  26 | app.add_middleware(
  27 |     CORSMiddleware,
  28 |     allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
  29 |     allow_credentials=True,
  30 |     allow_methods=["*"],
  31 |     allow_headers=["*"],
  32 | )
  33 | 
  34 | # Global coordination states
  35 | MEMORY_FILE = "memory_store.json"
  36 | 
  37 | class Message(BaseModel):
  38 |     sender: str
  39 |     text: str
  40 | 
  41 | class OrchestrateRequest(BaseModel):
  42 |     prompt: str
  43 |     history: Optional[List[Message]] = []
  44 |     api_key: Optional[str] = None
  45 |     session_id: Optional[str] = None
  46 |     execute_agents: bool = True
  47 | 
  48 | class ApprovalRequest(BaseModel):
  49 |     sessionId: str
  50 |     nodeId: str
  51 |     toolName: str
  52 |     action: str  # "approve" or "deny"
  53 | 
  54 | class ExecuteCustomRequest(BaseModel):
  55 |     session_id: str
  56 |     api_key: str
  57 |     nodes: List[Dict[str, Any]]
  58 |     edges: List[Dict[str, Any]]
  59 |     prompt: str
  60 |     history: Optional[List[Message]] = []
  61 | 
  62 | # ─── VECTOR DB MEMORY STORE (Gemini Embeddings + Local Cosine Similarity) ───
  63 | 
  64 | async def get_gemini_embedding(text: str, api_key: str) -> List[float]:
  65 |     url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={api_key}"
  66 |     payload = {
  67 |         "model": "models/text-embedding-004",
  68 |         "content": {
  69 |             "parts": [{"text": text}]
  70 |         }
  71 |     }
  72 |     async with httpx.AsyncClient() as client:
  73 |         try:
  74 |             r = await client.post(url, json=payload, timeout=15.0)
  75 |             if r.status_code == 200:
  76 |                 return r.json().get("embedding", {}).get("values", [])
  77 |         except Exception as e:
  78 |             print(f"[MEMORY ERROR] Embedding API failed: {e}")
  79 |     return []
  80 | 
  81 | def cosine_similarity(v1: List[float], v2: List[float]) -> float:
  82 |     if not v1 or not v2 or len(v1) != len(v2):
  83 |         return 0.0
  84 |     dot = sum(a * b for a, b in zip(v1, v2))
  85 |     norm1 = math.sqrt(sum(a * a for a in v1))
  86 |     norm2 = math.sqrt(sum(b * b for b in v2))
  87 |     if norm1 == 0.0 or norm2 == 0.0:
  88 |         return 0.0
  89 |     return dot / (norm1 * norm2)
  90 | 
  91 | def load_memories() -> List[Dict[str, Any]]:
  92 |     if os.path.exists(MEMORY_FILE):
  93 |         try:
  94 |             with open(MEMORY_FILE, "r") as f:
  95 |                 return json.load(f)
  96 |         except Exception:
  97 |             pass
  98 |     return []
  99 | 
 100 | def save_memories(memories: List[Dict[str, Any]]):
 101 |     try:
 102 |         with open(MEMORY_FILE, "w") as f:
 103 |             json.dump(memories, f, indent=2)
 104 |     except Exception as e:
 105 |         print(f"[MEMORY ERROR] Saving file failed: {e}")
 106 | 
 107 | async def store_memory(agent_id: str, text: str, api_key: str, session_id: str = None):
 108 |     embedding = await get_gemini_embedding(text, api_key)
 109 |     if not embedding:
 110 |         return
 111 |     memories = load_memories()
 112 |     memories.append({
 113 |         "agent_id": agent_id,
 114 |         "text": text,
 115 |         "embedding": embedding,
 116 |         "timestamp": datetime.datetime.now().isoformat()
 117 |     })
 118 |     if session_id:
 119 |         memories.append({
 120 |             "agent_id": f"session_{session_id}",
 121 |             "text": text,
 122 |             "embedding": embedding,
 123 |             "timestamp": datetime.datetime.now().isoformat()
 124 |         })
 125 |     save_memories(memories)
 126 | 
 127 | async def query_memory(query: str, api_key: str, top_k=2, agent_id: Optional[str] = None) -> List[str]:
 128 |     embedding = await get_gemini_embedding(query, api_key)
 129 |     if not embedding:
 130 |         return []
 131 |     memories = load_memories()
 132 |     scored = []
 133 |     for m in memories:
 134 |         if agent_id is not None and m.get("agent_id") != agent_id:
 135 |             continue
 136 |         sim = cosine_similarity(embedding, m["embedding"])
 137 |         scored.append((sim, m["text"]))
 138 |     
 139 |     scored.sort(key=lambda x: x[0], reverse=True)
 140 |     return [text for sim, text in scored[:top_k] if sim > 0.45]
 141 | 
 142 | 
 143 | # ─── REAL AGENT TOOLS ───
 144 | 
 145 | async def execute_web_search(query: str) -> str:
 146 |     headers = {
 147 |         "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
 148 |     }
 149 |     url = f"https://html.duckduckgo.com/html/?q={query}"
 150 |     async with httpx.AsyncClient() as client:
 151 |         try:
 152 |             r = await client.get(url, headers=headers, timeout=15.0)
 153 |             if r.status_code == 200:
 154 |                 soup = BeautifulSoup(r.text, "html.parser")
 155 |                 snippets = []
 156 |                 for div in soup.find_all("a", class_="result__snippet")[:3]:
 157 |                     snippets.append(div.get_text().strip())
 158 |                 if snippets:
 159 |                     return "\n".join(snippets)
 160 |         except Exception as e:
 161 |             return f"Search failed: {str(e)}"
 162 |     return f"No search results found for query: '{query}'."
 163 | 
 164 | async def execute_python_code(code: str) -> str:
 165 |     try:
 166 |         p = subprocess.Popen(
 167 |             [sys.executable, "-c", code],
 168 |             stdout=subprocess.PIPE,
 169 |             stderr=subprocess.PIPE,
 170 |             text=True
 171 |         )
 172 |         stdout, stderr = p.communicate(timeout=20.0)
 173 |         output = ""
 174 |         if stdout:
 175 |             output += f"STDOUT:\n{stdout}\n"
 176 |         if stderr:
 177 |             output += f"STDERR:\n{stderr}\n"
 178 |         if not output:
 179 |             output = "Code executed successfully with no output."
 180 |         return output
 181 |     except subprocess.TimeoutExpired:
 182 |         p.kill()
 183 |         return "Error: Code execution timed out (20.0s limit)."
 184 |     except Exception as e:
 185 |         return f"Execution error: {str(e)}"
 186 | 
 187 | async def execute_api_call(url: str, method: str = "GET", payload_json: Optional[str] = None) -> str:
 188 |     async with httpx.AsyncClient() as client:
 189 |         try:
 190 |             if method.upper() == "POST":
 191 |                 data = json.loads(payload_json) if payload_json else {}
 192 |                 r = await client.post(url, json=data, timeout=15.0)
 193 |             else:
 194 |                 r = await client.get(url, timeout=15.0)
 195 |             return f"Status: {r.status_code}\nResponse: {r.text[:1500]}"
 196 |         except Exception as e:
 197 |             return f"API call failed: {str(e)}"
 198 | 
 199 | # ─── AGENT COORDINATOR DAG SORT ───
 200 | 
 201 | def sort_nodes_topologically(nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
 202 |     visited = set()
 203 |     sorted_nodes = []
 204 |     node_dict = {n["id"]: n for n in nodes}
 205 | 
 206 |     def visit(node_id):
 207 |         if node_id in visited:
 208 |             return
 209 |         visited.add(node_id)
 210 |         node = node_dict.get(node_id)
 211 |         if node:
 212 |             deps = node["data"].get("dependencies", [])
 213 |             for dep in deps:
 214 |                 if dep in node_dict:
 215 |                     visit(dep)
 216 |             sorted_nodes.append(node)
 217 | 
 218 |     for node in nodes:
 219 |         visit(node["id"])
 220 |     return sorted_nodes
 221 | 
 222 | # ─── ORCHESTRATION SYSTEM INSTRUCTIONS ───
 223 | 
 224 | ORCHESTRATOR_SYSTEM_INSTRUCTION = """
 225 | You are Solospace, an elite workflow orchestrator. Your ONLY job is to analyze the user's request and output a JSON list of specialized agents.
 226 | 
 227 | CRITICAL RULES:
 228 | - For ANY request that involves building, designing, integrating, or researching a non‑trivial system, you MUST output at least 2 agents.
 229 | - For requests that mention multiple domains (e.g., frontend + backend + database), use 3‑6 agents.
 230 | - Only output a SINGLE agent ("general") for extremely simple questions like "Hello", "What is AI?", or one‑line explanations.
 231 | - Classify the complexity field in the JSON schema as "complex" if the user asks to build, design, integrate, or analyze a system with 2+ distinct components (frontend, backend, database, payments, auth, research). If in doubt, prefer "complex" over "simple".
 232 | 
 233 | AGENT CREATION:
 234 | You can use any senderId, not only the built‑in list. Define custom agents freely.
 235 | Every agent MUST have:
 236 | - senderId: a unique short identifier (e.g., "frontend_ui", "payment_gateway", "data_analyst").
 237 | - senderName: a human readable name.
 238 | - senderIcon: "code", "science", or "trending_up".
 239 | - text: what this agent will contribute.
 240 | - objective: specific goal for this agent.
 241 | - systemPrompt: detailed instructions for the agent.
 242 | - rules: 2‑3 specific constraints.
 243 | - dependencies: list of other agent ids this agent needs.
 244 | - tools: choose from ["Web Search", "Memory", "Code Executor", "Browser", "API Connector"].
 245 | 
 246 | EXAMPLES:
 247 | 1. User: "Build a full‑stack SaaS with Next.js, Stripe payments, and PostgreSQL"
 248 |    → Output agents: frontend_ui, backend_api, database_admin, payment_integrator (4 agents).
 249 | 
 250 | 2. User: "Explain how JWT works"
 251 |    → Output agents: general (1 agent).
 252 | 
 253 | 3. User: "Research AI trends and write a summary"
 254 |    → Output agents: researcher, writer (2 agents).
 255 | 
 256 | Respond ONLY with a valid JSON object matching the provided schema.
 257 | """
 258 | 
 259 | orchestration_schema = {
 260 |     "type": "OBJECT",
 261 |     "properties": {
 262 |         "complexity": {
 263 |             "type": "STRING",
 264 |             "enum": ["simple", "medium", "complex"]
 265 |         },
 266 |         "capabilities": {
 267 |             "type": "ARRAY",
 268 |             "items": {"type": "STRING"}
 269 |         },
 270 |         "thinking_summary": {
 271 |             "type": "STRING"
 272 |         },
 273 |         "agent_talk": {
 274 |             "type": "ARRAY",
 275 |             "items": {
 276 |                 "type": "OBJECT",
 277 |                 "properties": {
 278 |                     "senderId": {"type": "STRING"},
 279 |                     "senderName": {"type": "STRING"},
 280 |                     "senderIcon": {"type": "STRING"},
 281 |                     "text": {"type": "STRING"},
 282 |                     "objective": {"type": "STRING"},
 283 |                     "systemPrompt": {"type": "STRING"},
 284 |                     "rules": {
 285 |                         "type": "ARRAY",
 286 |                         "items": {"type": "STRING"}
 287 |                     },
 288 |                     "dependencies": {
 289 |                         "type": "ARRAY",
 290 |                         "items": {"type": "STRING"}
 291 |                     },
 292 |                     "tools": {
 293 |                         "type": "ARRAY",
 294 |                         "items": {"type": "STRING"}
 295 |                     },
 296 |                     "custom_template": {
 297 |                         "type": "OBJECT",
 298 |                         "properties": {
 299 |                             "name": {"type": "STRING"},
 300 |                             "icon": {"type": "STRING"},
 301 |                             "tag": {"type": "STRING"},
 302 |                             "temp": {"type": "NUMBER"},
 303 |                             "logic": {"type": "INTEGER"},
 304 |                             "col": {"type": "INTEGER"}
 305 |                         },
 306 |                         "required": ["name", "icon", "tag", "temp", "logic", "col"]
 307 |                     }
 308 |                 },
 309 |                 "required": ["senderId", "senderName", "senderIcon", "text", "objective", "systemPrompt", "rules", "dependencies", "tools"]
 310 |             }
 311 |         }
 312 |     },
 313 |     "required": ["complexity", "capabilities", "thinking_summary", "agent_talk"]
 314 | }
 315 | 
 316 | # Real-time ReAct loop action schema for agents
 317 | agent_turn_schema = {
 318 |     "type": "OBJECT",
 319 |     "properties": {
 320 |         "thought": {"type": "STRING"},
 321 |         "action": {
 322 |             "type": "STRING",
 323 |             "enum": ["none", "web_search", "execute_code", "api_call", "query_memory", "store_memory", "send_message"]
 324 |         },
 325 |         "action_input": {"type": "STRING"},
 326 |         "final_answer": {"type": "STRING"}
 327 |     },
 328 |     "required": ["thought", "action", "action_input", "final_answer"]
 329 | }
 330 | 
 331 | 
 332 | RESPONSE_SYSTEM_INSTRUCTION = """
 333 | You are Solospace, an elite assistant.
 334 | Your job is to produce a clean, direct response to the user's prompt using the provided context.
 335 | 
 336 | STRICT RULES — NEVER VIOLATE:
 337 | - Do NOT include any preamble, header, or status line such as "[Agent processing...]", "Synthesizing...", "From the agent team:", or similar.
 338 | - Do NOT mention agents, sub-tasks, specialists, orchestration, or internal workflow mechanics.
 339 | - Do NOT start your response with any markdown header that references processing steps.
 340 | - Begin your response immediately and directly with the answer.
 341 | - Use clean, well-structured markdown only when it genuinely helps the user.
 342 | - For conversational messages (e.g. greetings), reply naturally and concisely without any structure.
 343 | """
 344 | 
 345 | GEMINI_SAFETY_SETTINGS = [
 346 |     {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
 347 |     {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
 348 |     {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
 349 |     {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"}
 350 | ]
 351 | 
 352 | def check_guardrails(prompt: str) -> Optional[str]:
 353 |     jailbreak_keywords = [
 354 |         "ignore previous instructions", "ignore all instructions", "override system prompt",
 355 |         "you are now developer mode", "jailbreak"
 356 |     ]
 357 |     for keyword in jailbreak_keywords:
 358 |         if keyword in prompt.lower():
 359 |             return "Safety Alert: Input contains potential prompt injection or system instruction bypass."
 360 |     return None
 361 | 
 362 | MAX_TOKENS = 100000.0
 363 | REFILL_RATE = 100.0
 364 | 
 365 | def check_rate_limit(session_id: str, prompt_len: int) -> bool:
 366 |     limit_info = db.get_rate_limit(session_id)
 367 |     now = datetime.datetime.now()
 368 |     
 369 |     if not limit_info:
 370 |         tokens = MAX_TOKENS
 371 |     else:
 372 |         try:
 373 |             last_updated = datetime.datetime.fromisoformat(limit_info["last_updated"])
 374 |             elapsed = (now - last_updated).total_seconds()
 375 |             tokens = min(MAX_TOKENS, limit_info["tokens_remaining"] + elapsed * REFILL_RATE)
 376 |         except Exception:
 377 |             tokens = MAX_TOKENS
 378 |     
 379 |     estimated_tokens = prompt_len / 3.0
 380 |     
 381 |     if tokens < estimated_tokens:
 382 |         return False
 383 |         
 384 |     tokens -= estimated_tokens
 385 |     db.update_rate_limit(session_id, tokens)
 386 |     return True
 387 | 
 388 | @app.post("/approve")
 389 | async def approve_tool(req: ApprovalRequest):
 390 |     status = "approved" if req.action == "approve" else "denied"
 391 |     
 392 |     # Update SQLite database tool approvals
 393 |     db.update_tool_approval(req.sessionId, req.nodeId, req.toolName, "pending", status)
 394 |     # Database is the single source of truth; no in-memory fallback needed
 395 |     # Perform wildcard updates in database (if specific logId is not provided)
 396 |     conn = db.get_db_connection()
 397 |     cursor = conn.cursor()
 398 |     cursor.execute(
 399 |         "UPDATE tool_approvals SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND node_id = ? AND tool_name = ? AND status = 'pending'",
 400 |         (status, req.sessionId, req.nodeId, req.toolName)
 401 |     )
 402 |     conn.commit()
 403 |     conn.close()
 404 |     
 405 |     return {"status": "success", "state": status}
 406 | 
 407 | async def run_cached_flow(cached_data: Dict[str, Any]):
 408 |     metadata = cached_data.get("metadata")
 409 |     if metadata:
 410 |         yield f"event: metadata\ndata: {json.dumps(metadata)}\n\n"
 411 |     
 412 |     text = cached_data.get("text", "")
 413 |     chunk_size = 15
 414 |     for i in range(0, len(text), chunk_size):
 415 |         chunk = text[i:i+chunk_size]
 416 |         yield f"event: text\ndata: {json.dumps(chunk)}\n\n"
 417 |         await asyncio.sleep(0.02)
 418 |     yield "event: done\ndata: {}\n\n"
 419 | 
 420 | @app.post("/orchestrate")
 421 | async def orchestrate(req: OrchestrateRequest):
 422 |     api_key = req.api_key or os.environ.get("GEMINI_API_KEY")
 423 |     if not api_key or api_key == "MY_GEMINI_API_KEY" or api_key == "":
 424 |         raise HTTPException(
 425 |             status_code=400,
 426 |             detail="Gemini API Key is missing. Please configure BYOK in Settings or set the GEMINI_API_KEY environment variable."
 427 |         )
 428 | 
 429 |     # 1. Guardrails check
 430 |     guardrail_err = check_guardrails(req.prompt)
 431 |     if guardrail_err:
 432 |         async def stream_guardrail_err():
 433 |             yield f"event: text\ndata: {json.dumps(guardrail_err)}\n\n"
 434 |             yield "event: done\ndata: {}\n\n"
 435 |         return StreamingResponse(stream_guardrail_err(), media_type="text/event-stream")
 436 | 
 437 |     # In-memory and persistent session id
 438 |     session_id = req.session_id or str(int(datetime.datetime.now().timestamp()))
 439 | 
 440 |     # 2. Rate limiting check
 441 |     if not check_rate_limit(session_id, len(req.prompt)):
 442 |         async def stream_rate_limit_err():
 443 |             yield f"event: text\ndata: {json.dumps('**Rate Limit Exceeded**: Please wait a minute before making more requests.')}\n\n"
 444 |             yield "event: done\ndata: {}\n\n"
 445 |         return StreamingResponse(stream_rate_limit_err(), media_type="text/event-stream")
 446 | 
 447 |     # 3. Semantic caching
 448 |     prompt_hash_overall = hashlib.sha256(req.prompt.encode('utf-8')).hexdigest()
 449 |     prompt_embedding = await get_gemini_embedding(req.prompt, api_key)
 450 |     if prompt_embedding:
 451 |         all_caches = db.load_all_cached_embeddings()
 452 |         for cache in all_caches:
 453 |             sim = cosine_similarity(prompt_embedding, cache["embedding"])
 454 |             if sim > 0.95:
 455 |                 print(f"[SEMANTIC CACHE] Cache hit for overall response. Similarity: {sim:.4f}")
 456 |                 return StreamingResponse(run_cached_flow(cache["response"]), media_type="text/event-stream")
 457 | 
 458 |     # 4. Map history and call planner
 459 |     contents = []
 460 |     if req.history:
 461 |         for msg in req.history:
 462 |             role = "user" if msg.sender == "user" else "model"
 463 |             contents.append({
 464 |                 "role": role,
 465 |                 "parts": [{"text": msg.text}]
 466 |             })
 467 |     
 468 |     contents.append({
 469 |         "role": "user",
 470 |         "parts": [{"text": req.prompt}]
 471 |     })
 472 | 
 473 |     url_orchestrate = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
 474 |     
 475 |     orchestrate_payload = {
 476 |         "contents": contents,
 477 |         "systemInstruction": {
 478 |             "parts": [{"text": ORCHESTRATOR_SYSTEM_INSTRUCTION}]
 479 |         },
 480 |         "generationConfig": {
 481 |             "responseMimeType": "application/json",
 482 |             "responseSchema": orchestration_schema,
 483 |             "temperature": 0.2,
 484 |             "thinkingConfig": {"thinkingBudget": 2048}
 485 |         },
 486 |         "safetySettings": GEMINI_SAFETY_SETTINGS
 487 |     }
 488 | 
 489 |     plan = {
 490 |         "complexity": "simple",
 491 |         "capabilities": [],
 492 |         "thinking_summary": "System defaulted to general mode.",
 493 |         "agent_talk": [{
 494 |             "senderId": "general",
 495 |             "senderName": "General Assistant",
 496 |             "senderIcon": "bot",
 497 |             "text": "Standing by to process your request.",
 498 |             "objective": "Process user requests with precise analysis.",
 499 |             "systemPrompt": "You are Solospace core.",
 500 |             "rules": ["Be descriptive"],
 501 |             "dependencies": []
 502 |         }],
 503 |         "follow_up_suggestions": ["Can you elaborate?", "Show me a detailed implementation example."]
 504 |     }
 505 | 
 506 |     async with httpx.AsyncClient() as client:
 507 |         try:
 508 |             plan_response = await client.post(url_orchestrate, json=orchestrate_payload, timeout=30.0)
 509 |             if plan_response.status_code == 200:
 510 |                 plan_data = plan_response.json()
 511 |                 if "candidates" in plan_data and len(plan_data["candidates"]) > 0:
 512 |                     raw_text = plan_data["candidates"][0]["content"]["parts"][-1]["text"].strip()
 513 |                     plan = json.loads(raw_text)
 514 |         except Exception as e:
 515 |             print(f"[ORCHESTRATION WARNING] Planning failed: {str(e)}")
 516 | 
 517 |     nodes = []
 518 |     edges = []
 519 |     complexity = plan.get("complexity", "simple")
 520 |     
 521 |     # Enforce minimum agents for non-simple tasks
 522 |     if complexity != "simple" and len(plan.get("agent_talk", [])) < 2:
 523 |         print("[WARN] Too few agents for complex/medium task, adding a default assistant agent.")
 524 |         plan.setdefault("agent_talk", []).append({
 525 |             "senderId": "assistant",
 526 |             "senderName": "General Assistant",
 527 |             "senderIcon": "code",
 528 |             "text": "Supports the primary agents with general assistance.",
 529 |             "objective": "Provide supplementary help and context.",
 530 |             "systemPrompt": "You are a helpful assistant that supports other agents.",
 531 |             "rules": ["Be concise", "Do not duplicate work"],
 532 |             "dependencies": [],
 533 |             "tools": ["Web Search", "Memory"]
 534 |         })
 535 | 
 536 |     if complexity == "simple":
 537 |         nodes.append({
 538 |             "id": "general",
 539 |             "type": "custom",
 540 |             "position": {"x": 400, "y": 250},
 541 |             "data": {
 542 |                 "name": "General Assistant",
 543 |                 "tag": "GENERAL_CORE",
 544 |                 "status": "ACTIVE",
 545 |                 "metricLabel": "Logic Level",
 546 |                 "metricVal": "90%",
 547 |                 "icon": "bot",
 548 |                 "objective": "Address the user request with natural, accurate, and comprehensive insights.",
 549 |                 "personality": "Helpful, expert, clear-headed",
 550 |                 "systemPrompt": "You are Solospace, an elite assistant.",
 551 |                 "rules": ["Be helpful and concise", "Use rich markdown"],
 552 |                 "tools": ["Web Search", "Memory"],
 553 |                 "temp": 0.7,
 554 |                 "logic": 90,
 555 |                 "empathy": 80,
 556 |                 "context": "128k",
 557 |                 "enabled": True,
 558 |                 "priority": 5,
 559 |                 "toolPermissions": {"Web Search": "ALLOWED", "Memory": "ALLOWED"},
 560 |                 "toolLogs": [],
 561 |                 "dependencies": []
 562 |             }
 563 |         })
 564 |     else:
 565 |         col_mapping = {
 566 |             "research": 1,
 567 |             "auth": 2,
 568 |             "database": 2,
 569 |             "frontend": 2,
 570 |             "backend": 3,
 571 |             "payments": 3
 572 |         }
 573 | 
 574 |         # Built-in templates: provide defaults but agent can override tools via agent_talk
 575 |         AGENT_TEMPLATES = {
 576 |             "research": {"name": "Market Researcher", "tag": "RESEARCH_LEAD_01", "icon": "science", "default_tools": ["Web Search"], "temp": 0.3, "logic": 85, "empathy": 40, "priority": 5, "col": 1},
 577 |             "auth": {"name": "Security Architect", "tag": "AUTH_AUDIT_02", "icon": "science", "default_tools": ["Memory"], "temp": 0.1, "logic": 99, "empathy": 10, "priority": 8, "col": 2},
 578 |             "database": {"name": "Database Admin", "tag": "DB_SCHEMA_03", "icon": "science", "default_tools": ["Memory"], "temp": 0.2, "logic": 95, "empathy": 20, "priority": 7, "col": 2},
 579 |             "frontend": {"name": "UI Specialist", "tag": "UI_DESIGN_04", "icon": "code", "default_tools": ["Browser"], "temp": 0.7, "logic": 75, "empathy": 75, "priority": 6, "col": 2},
 580 |             "backend": {"name": "API Architect", "tag": "API_ENGINE_05", "icon": "code", "default_tools": ["Code Executor"], "temp": 0.2, "logic": 92, "empathy": 25, "priority": 8, "col": 3},
 581 |             "payments": {"name": "Stripe Integrator", "tag": "STRIPE_BILL_06", "icon": "trending_up", "default_tools": ["API Connector"], "temp": 0.4, "logic": 90, "empathy": 40, "priority": 7, "col": 3}
 582 |         }
 583 | 
 584 |         active_agents = []
 585 |         seen_ids = set()
 586 |         for agent in plan.get("agent_talk", []):
 587 |             cap = agent.get("senderId", "")
 588 |             # Deduplicate by senderId — if Gemini sends duplicate, suffix with index
 589 |             unique_id = cap
 590 |             if unique_id in seen_ids:
 591 |                 unique_id = f"{cap}_{len(seen_ids)}"
 592 |             seen_ids.add(unique_id)
 593 |             if cap in AGENT_TEMPLATES:
 594 |                 active_agents.append((unique_id, agent, AGENT_TEMPLATES[cap]))
 595 |             elif cap == "other" or cap not in AGENT_TEMPLATES:
 596 |                 # Dynamic / custom agent
 597 |                 ct = agent.get("custom_template", {})
 598 |                 dynamic_tpl = {
 599 |                     "name": ct.get("name", agent.get("senderName", "Custom Agent")),
 600 |                     "tag": ct.get("tag", f"CUSTOM_{unique_id.upper()[:8]}"),
 601 |                     "icon": ct.get("icon", agent.get("senderIcon", "science")),
 602 |                     "default_tools": ["Web Search", "Memory"],
 603 |                     "temp": ct.get("temp", 0.5),
 604 |                     "logic": ct.get("logic", 80),
 605 |                     "empathy": 50,
 606 |                     "priority": 5,
 607 |                     "col": ct.get("col", 2)
 608 |                 }
 609 |                 active_agents.append((unique_id, agent, dynamic_tpl))
 610 | 
 611 |         col_counts = {1: 0, 2: 0, 3: 0}
 612 |         for uid, agent, tpl in active_agents:
 613 |             col = tpl.get("col", 2)
 614 |             col_counts[col] += 1
 615 | 
 616 |         col_indices = {1: 0, 2: 0, 3: 0}
 617 |         for uid, agent, tpl in active_agents:
 618 |             col = tpl.get("col", 2)
 619 |             index = col_indices[col]
 620 |             col_indices[col] += 1
 621 | 
 622 |             x = 100 if col == 1 else (400 if col == 2 else 700)
 623 |             total_in_col = col_counts[col]
 624 |             y_start = 250 - (total_in_col - 1) * 120
 625 |             y = y_start + index * 240
 626 | 
 627 |             # Agent-defined tools override template defaults
 628 |             agent_tools = agent.get("tools", [])
 629 |             resolved_tools = agent_tools if agent_tools else tpl["default_tools"]
 630 |             # Filter to known tool names for safety
 631 |             valid_tools = {"Web Search", "Memory", "Code Executor", "Browser", "API Connector", "Vision", "Voice", "File Upload"}
 632 |             resolved_tools = [t for t in resolved_tools if t in valid_tools] or tpl["default_tools"]
 633 | 
 634 |             default_metrics = {
 635 |                 "research": ("Sources Scanned", "24 Pages"),
 636 |                 "auth": ("Audit Score", "99%"),
 637 |                 "database": ("Schema Status", "Normalized"),
 638 |                 "frontend": ("UI Score", "95%"),
 639 |                 "backend": ("Execution Rate", "98%"),
 640 |                 "payments": ("Stripe API Status", "Online")
 641 |             }.get(agent.get("senderId", ""), ("Logic Level", "90%"))
 642 | 
 643 |             nodes.append({
 644 |                 "id": uid,
 645 |                 "type": "custom",
 646 |                 "position": {"x": x, "y": y},
 647 |                 "data": {
 648 |                     "name": agent.get("senderName", tpl["name"]),
 649 |                     "tag": tpl["tag"],
 650 |                     "status": "IDLE",
 651 |                     "metricLabel": default_metrics[0],
 652 |                     "metricVal": default_metrics[1],
 653 |                     "icon": agent.get("senderIcon", tpl["icon"]),
 654 |                     "objective": agent.get("objective", ""),
 655 |                     "personality": "Collaborative Specialist",
 656 |                     "systemPrompt": agent.get("systemPrompt", ""),
 657 |                     "rules": agent.get("rules", []),
 658 |                     "tools": resolved_tools,
 659 |                     "temp": tpl["temp"],
 660 |                     "logic": tpl["logic"],
 661 |                     "empathy": tpl["empathy"],
 662 |                     "context": "128k",
 663 |                     "enabled": True,
 664 |                     "priority": tpl["priority"],
 665 |                     "toolPermissions": {t: "ASK" if t in ["Code Executor", "API Connector"] else "ALLOWED" for t in resolved_tools},
 666 |                     "toolLogs": [],
 667 |                     "dependencies": agent.get("dependencies", [])
 668 |                 }
 669 |             })
 670 | 
 671 |         for node in nodes:
 672 |             for dep in node["data"].get("dependencies", []):
 673 |                 edges.append({
 674 |                     "id": f"e-{dep}-{node['id']}",
 675 |                     "source": dep,
 676 |                     "target": node["id"],
 677 |                     "animated": True,
 678 |                     "type": "custom",
 679 |                     "style": {"stroke": "#60a5fa", "strokeWidth": 2}
 680 |                 })
 681 | 
 682 |     # Decide whether to run full agent flow
 683 |     if not req.execute_agents:
 684 |         # Only planning mode: save session in DB with paused state and return planning metadata
 685 |         db.save_session(
 686 |             session_id=session_id,
 687 |             title=req.prompt[:40] + "..." if len(req.prompt) > 40 else req.prompt,
 688 |             prompt=req.prompt,
 689 |             mode=complexity,
 690 |             nodes=nodes,
 691 |             edges=edges,
 692 |             chat_messages=[
 693 |                 {"id": "user-prompt", "sender": "user", "text": req.prompt, "timestamp": datetime.datetime.now().strftime("%I:%M:%S %p")}
 694 |             ],
 695 |             agent_talk_logs=[],
 696 |             execution_state="paused",
 697 |             status_message="Agent team generated. Customize and proceed.",
 698 |             follow_up_suggestions=plan.get("follow_up_suggestions", [])
 699 |         )
 700 |         
 701 |         async def planning_only_flow():
 702 |             setup_metadata = {
 703 |                 "complexity": complexity,
 704 |                 "capabilities": plan.get("capabilities", []),
 705 |                 "thinking_summary": plan.get("thinking_summary", ""),
 706 |                 "nodes": nodes,
 707 |                 "edges": edges,
 708 |                 "agent_talk": [],
 709 |                 "follow_up_suggestions": plan.get("follow_up_suggestions", [])
 710 |             }
 711 |             yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
 712 |             yield f"event: text\ndata: {json.dumps('✅ Agent team generated. Go to the **Flow** tab to customize agents and click **Proceed** to run them.')}\n\n"
 713 |             yield "event: done\ndata: {}\n\n"
 714 |             
 715 |         return StreamingResponse(planning_only_flow(), media_type="text/event-stream")
 716 |     else:
 717 |         # Existing full execution flow
 718 |         return StreamingResponse(
 719 |             run_agent_execution_loop(
 720 |                 session_id=session_id,
 721 |                 prompt=req.prompt,
 722 |                 history=req.history or [],
 723 |                 api_key=api_key,
 724 |                 nodes=nodes,
 725 |                 edges=edges,
 726 |                 complexity=complexity,
 727 |                 capabilities=plan.get("capabilities", []),
 728 |                 thinking_summary=plan.get("thinking_summary", ""),
 729 |                 follow_up_suggestions=plan.get("follow_up_suggestions", [])
 730 |             ),
 731 |             media_type="text/event-stream"
 732 |         )
 733 | 
 734 | # Session persistence APIs
 735 | @app.get("/sessions")
 736 | async def get_sessions():
 737 |     return db.load_sessions()
 738 | 
 739 | @app.get("/sessions/{session_id}")
 740 | async def get_session(session_id: str):
 741 |     session = db.load_session(session_id)
 742 |     if not session:
 743 |         raise HTTPException(status_code=404, detail="Session not found")
 744 |     return session
 745 | 
 746 | @app.delete("/sessions/{session_id}")
 747 | async def delete_session(session_id: str):
 748 |     db.delete_session(session_id)
 749 |     return {"status": "success"}
 750 | 
 751 | async def run_agent_execution_loop(
 752 |     session_id: str,
 753 |     prompt: str,
 754 |     history: List[Message],
 755 |     api_key: str,
 756 |     nodes: List[Dict[str, Any]],
 757 |     edges: List[Dict[str, Any]],
 758 |     complexity: str,
 759 |     capabilities: List[str],
 760 |     thinking_summary: str,
 761 |     follow_up_suggestions: List[str]
 762 | ):
 763 |     now_str = lambda: datetime.datetime.now().strftime("%I:%M:%S %p")
 764 |     agent_results: Dict[str, str] = {}
 765 |     setup_metadata = {
 766 |         "complexity": complexity,
 767 |         "capabilities": capabilities,
 768 |         "thinking_summary": thinking_summary,
 769 |         "nodes": nodes,
 770 |         "edges": edges,
 771 |         "agent_talk": [],
 772 |         "follow_up_suggestions": follow_up_suggestions
 773 |     }
 774 |     
 775 |     # Save initial session in DB
 776 |     db.save_session(
 777 |         session_id=session_id,
 778 |         title=prompt[:40] + "..." if len(prompt) > 40 else prompt,
 779 |         prompt=prompt,
 780 |         mode=complexity,
 781 |         nodes=nodes,
 782 |         edges=edges,
 783 |         chat_messages=[],
 784 |         agent_talk_logs=[],
 785 |         execution_state="running",
 786 |         status_message="Running orchestration loop",
 787 |         follow_up_suggestions=follow_up_suggestions
 788 |     )
 789 |     
 790 |     yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
 791 | 
 792 |     execution_order = sort_nodes_topologically(nodes)
 793 |     
 794 |     for agent_node in execution_order:
 795 |         node_id = agent_node["id"]
 796 |         agent_data = agent_node["data"]
 797 |         agent_name = agent_data["name"]
 798 |         
 799 |         # Checkpoint loading
 800 |         checkpoint_state = db.load_checkpoint(session_id, node_id)
 801 |         if checkpoint_state:
 802 |             agent_results[node_id] = checkpoint_state.get("final_answer", "Completed.")
 803 |             setup_metadata["agent_talk"].append({
 804 |                 "id": f"agent-log-{node_id}-{now_str()}",
 805 |                 "senderId": node_id,
 806 |                 "senderName": agent_name,
 807 |                 "senderIcon": agent_data["icon"],
 808 |                 "text": checkpoint_state.get("final_answer", "Completed.")[:180],
 809 |                 "timestamp": now_str()
 810 |             })
 811 |             continue
 812 | 
 813 |         for n in nodes:
 814 |             if n["id"] == node_id:
 815 |                 n["data"]["status"] = "ACTIVE"
 816 |         yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
 817 |         
 818 |         yield f"event: status\ndata: {json.dumps(f'[{agent_name}] processing...')}\n\n"
 819 |         await asyncio.sleep(0.5)
 820 | 
 821 |         dep_outputs = ""
 822 |         for dep_id in agent_data.get("dependencies", []):
 823 |             if dep_id in agent_results:
 824 |                 dep_outputs += f"### Input from {dep_id.upper()}:\n{agent_results[dep_id]}\n"
 825 | 
 826 |         memories_context = ""
 827 |         try:
 828 |             matched_memories = await query_memory(agent_data["objective"], api_key)
 829 |             if matched_memories:
 830 |                 memories_context = "### Relevant Historical Memories:\n" + "\n".join(f"- {m}" for m in matched_memories)
 831 |         except Exception:
 832 |             pass
 833 | 
 834 |         # Get messages addressed to this agent
 835 |         incoming_msgs = get_messages_for_agent(session_id, node_id)
 836 |         msg_block = ""
 837 |         if incoming_msgs:
 838 |             msg_block = "### Messages from other agents:\n"
 839 |             for msg in incoming_msgs:
 840 |                 msg_block += f"- From {msg['from']}: {msg['content']}\n"
 841 |             # Clear after reading
 842 |             clear_messages(session_id, node_id)
 843 | 
 844 |         agent_history = [{
 845 |             "role": "user",
 846 |             "parts": [{"text": f"User Request: {prompt}\n\n{dep_outputs}\n{memories_context}\n{msg_block}\n\nYour specific objective: {agent_data['objective']}\nRules: {agent_data['rules']}"}]
 847 |         }]
 848 | 
 849 |         agent_final_answer = "Sub-task completed."
 850 |         url_gemini = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
 851 | 
 852 |         action_execution_history = []
 853 | 
 854 |         for turn in range(3):
 855 |             agent_payload = {
 856 |                 "contents": agent_history,
 857 |                 "systemInstruction": {"parts": [{"text": agent_data["systemPrompt"]}]},
 858 |                 "generationConfig": {
 859 |                     "responseMimeType": "application/json",
 860 |                     "responseSchema": agent_turn_schema,
 861 |                     "temperature": 0.2
 862 |                 },
 863 |                 "safetySettings": GEMINI_SAFETY_SETTINGS
 864 |             }
 865 | 
 866 |             action = "none"
 867 |             observation = ""
 868 |             try:
 869 |                 async with httpx.AsyncClient() as client:
 870 |                     resp = await client.post(url_gemini, json=agent_payload, timeout=30.0)
 871 |                     if resp.status_code == 200:
 872 |                         turn_text = resp.json()["candidates"][0]["content"]["parts"][-1]["text"].strip()
 873 |                         turn_data = json.loads(turn_text)
 874 |                         
 875 |                         thought = turn_data.get("thought", "")
 876 |                         action = turn_data.get("action", "none")
 877 |                         action_input = turn_data.get("action_input", "")
 878 |                         agent_final_answer = turn_data.get("final_answer", "")
 879 |                         
 880 |                         if thought:
 881 |                             yield f"event: thinking\ndata: {json.dumps(f'[{agent_name}]: {thought}\\n')}\n\n"
 882 |                     else:
 883 |                         break
 884 |             except Exception as e:
 885 |                 print(f"ReAct Turn fail: {e}")
 886 |                 break
 887 | 
 888 |             if action == "none" or agent_final_answer:
 889 |                 break
 890 | 
 891 |             # Circuit Breaker Check
 892 |             action_execution_history.append((action, action_input))
 893 |             if action_execution_history.count((action, action_input)) >= 3:
 894 |                 observation = "Circuit Breaker: Tool executed repeatedly with identical input. Halting loop to prevent infinite spend."
 895 |                 yield f"event: status\ndata: {json.dumps(f'[{agent_name}] circuit breaker halted')}\n\n"
 896 |                 agent_history.append({
 897 |                     "role": "model",
 898 |                     "parts": [{"text": json.dumps(turn_data)}]
 899 |                 })
 900 |                 agent_history.append({
 901 |                     "role": "user",
 902 |                     "parts": [{"text": f"Observation: {observation}"}]
 903 |                 })
 904 |                 continue
 905 | 
 906 |             t_log_id = f"t-log-{int(datetime.datetime.now().timestamp())}"
 907 |             t_timestamp = now_str()
 908 |             
 909 |             permission = agent_data.get("toolPermissions", {}).get(action, "ALLOWED")
 910 |             
 911 |             if permission == "ASK":
 912 |                 new_log = {
 913 |                     "id": t_log_id,
 914 |                     "timestamp": t_timestamp,
 915 |                     "tool": action,
 916 |                     "action": "Execution Request",
 917 |                     "status": "PENDING",
 918 |                     "detail": f"Waiting for user to approve execution of '{action_input[:50]}...'"
 919 |                 }
 920 |                 for n in nodes:
 921 |                     if n["id"] == node_id:
 922 |                         n["data"]["toolLogs"] = [new_log] + n["data"].get("toolLogs", [])
 923 |                 yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
 924 |                 
 925 |                 db.create_tool_approval(session_id, node_id, action, action_input, t_log_id)
 926 |                 
 927 |                 yield f"event: tool_approval\ndata: {json.dumps({'sessionId': session_id, 'nodeId': node_id, 'toolName': action, 'action': 'Execution Approval Required', 'detail': action_input[:100], 'logId': t_log_id})}\n\n"
 928 |                 yield f"event: status\ndata: {json.dumps(f'[{agent_name}] waiting for approval to run [{action}]')}\n\n"
 929 | 
 930 |                 # Poll database for verdict
 931 |                 while True:
 932 |                     approval_status = db.get_tool_approval(session_id, node_id, action, t_log_id)
 933 |                     if approval_status in ["approved", "denied"]:
 934 |                         permission = "ALLOWED" if approval_status == "approved" else "DENIED"
 935 |                         break
 936 |                     await asyncio.sleep(0.5)
 937 |                 
 938 |                 if permission == "ALLOWED":
 939 |                     for n in nodes:
 940 |                         if n["id"] == node_id:
 941 |                             n["data"]["toolLogs"] = [{**new_log, "status": "SUCCESS", "detail": f"Approved: {action_input[:50]}"}] + n["data"].get("toolLogs", [])[1:]
 942 |                 else:
 943 |                     for n in nodes:
 944 |                         if n["id"] == node_id:
 945 |                             n["data"]["toolLogs"] = [{**new_log, "status": "BLOCKED", "detail": "Blocked by user."}] + n["data"].get("toolLogs", [])[1:]
 946 | 
 947 |             if permission == "ALLOWED":
 948 |                 yield f"event: status\ndata: {json.dumps(f'[{agent_name}] executing [{action}]')}\n\n"
 949 |                 
 950 |                 if action == "web_search":
 951 |                     observation = await execute_web_search(action_input)
 952 |                 elif action == "execute_code":
 953 |                     observation = await execute_python_code(action_input)
 954 |                 elif action == "api_call":
 955 |                     observation = await execute_api_call(action_input)
 956 |                 elif action == "query_memory":
 957 |                     mem_res = await query_memory(action_input, api_key)
 958 |                     observation = "\n".join(mem_res) if mem_res else "No matches found."
 959 |                 elif action == "store_memory":
 960 |                     await store_memory(node_id, action_input, api_key, session_id)
 961 |                     observation = "Saved successfully."
 962 |                 elif action == "send_message":
 963 |                     parts = action_input.split("|", 1)
 964 |                     if len(parts) == 2:
 965 |                         target_agent, content = parts
 966 |                         post_message(session_id, node_id, target_agent, content)
 967 |                         observation = f"Message sent to {target_agent}."
 968 |                     else:
 969 |                         observation = "Invalid send_message format. Use 'target|content'."
 970 |                 else:
 971 |                     observation = "Mock tool result."
 972 |                 
 973 |                 success_log = {
 974 |                     "id": t_log_id,
 975 |                     "timestamp": now_str(),
 976 |                     "tool": action,
 977 |                     "action": "Call",
 978 |                     "status": "SUCCESS",
 979 |                     "detail": f"Ran tool with inputs: '{action_input[:50]}' -> Output: {observation[:100]}..."
 980 |                 }
 981 |                 for n in nodes:
 982 |                     if n["id"] == node_id:
 983 |                         logs_filtered = [l for l in n["data"].get("toolLogs", []) if l["id"] != t_log_id]
 984 |                         n["data"]["toolLogs"] = [success_log] + logs_filtered
 985 |             else:
 986 |                 observation = "Execution Blocked: Permission Denied."
 987 |             
 988 |             yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
 989 |             
 990 |             agent_history.append({
 991 |                 "role": "model",
 992 |                 "parts": [{"text": json.dumps(turn_data)}]
 993 |             })
 994 |             agent_history.append({
 995 |                 "role": "user",
 996 |                 "parts": [{"text": f"Observation: {observation}"}]
 997 |             })
 998 | 
 999 |         agent_results[node_id] = agent_final_answer
1000 |         
1001 |         # Save state checkpoint
1002 |         db.save_checkpoint(session_id, node_id, {"final_answer": agent_final_answer})
1003 |         
1004 |         for n in nodes:
1005 |             if n["id"] == node_id:
1006 |                 n["data"]["status"] = "IDLE"
1007 |         
1008 |         setup_metadata["agent_talk"].append({
1009 |             "id": f"agent-log-{node_id}-{now_str()}",
1010 |             "senderId": node_id,
1011 |             "senderName": agent_name,
1012 |             "senderIcon": agent_data["icon"],
1013 |             "text": agent_final_answer[:180] + "..." if len(agent_final_answer) > 180 else agent_final_answer,
1014 |             "timestamp": now_str()
1015 |         })
1016 |         yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1017 |         
1018 |         try:
1019 |             await store_memory(node_id, f"Goal: {agent_data['objective']}. Final Solution: {agent_final_answer}", api_key, session_id)
1020 |         except Exception:
1021 |             pass
1022 | 
1023 |     if complexity == "simple" and not agent_results:
1024 |         agent_results["general"] = "Processed the request, but no specific output was generated."
1025 | 
1026 |     yield f"event: status\ndata: {json.dumps('Synthesizing final response...')}\n\n"
1027 | 
1028 |     # Build aggregator prompt — inject relevant memory + agent results
1029 |     aggregator_prompt = ""
1030 |     try:
1031 |         memory_hits = await query_memory(prompt, api_key, top_k=3, agent_id=None)
1032 |         if memory_hits:
1033 |             aggregator_prompt += "### Relevant context from past conversation:\n" + "\n".join(f"- {m}" for m in memory_hits) + "\n\n"
1034 |     except Exception:
1035 |         pass
1036 | 
1037 |     if agent_results:
1038 |         aggregator_prompt += "### Analysis context:\n"
1039 |         for _nid, result in agent_results.items():
1040 |             aggregator_prompt += f"{result}\n\n"
1041 | 
1042 |     aggregator_prompt += f"\nUser's current message: {prompt}"
1043 | 
1044 |     # Fallback if aggregator prompt is empty
1045 |     if not aggregator_prompt.strip():
1046 |         aggregator_prompt = f"Answer the following user request concisely and helpfully:\n\n{prompt}"
1047 | 
1048 |     # Build full conversation history for aggregator so it has cross-turn context
1049 |     aggregator_contents = []
1050 |     if history:
1051 |         for msg in history:
1052 |             role = "user" if msg.sender == "user" else "model"
1053 |             aggregator_contents.append({"role": role, "parts": [{"text": msg.text}]})
1054 |     aggregator_contents.append({"role": "user", "parts": [{"text": aggregator_prompt}]})
1055 | 
1056 |     url_stream = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key={api_key}"
1057 |     stream_payload = {
1058 |         "contents": aggregator_contents,
1059 |         "systemInstruction": {
1060 |             "parts": [{"text": RESPONSE_SYSTEM_INSTRUCTION}]
1061 |         },
1062 |         "generationConfig": {
1063 |             "temperature": 0.7
1064 |         },
1065 |         "safetySettings": GEMINI_SAFETY_SETTINGS
1066 |     }
1067 |     
1068 |     line_buf = ""
1069 |     final_synthesis_text = ""
1070 |     async with httpx.AsyncClient() as client:
1071 |         try:
1072 |             async with client.stream("POST", url_stream, json=stream_payload, timeout=90.0) as r:
1073 |                 if r.status_code == 200:
1074 |                     async for chunk in r.aiter_text():
1075 |                         line_buf += chunk
1076 |                         while "\n" in line_buf:
1077 |                             line, line_buf = line_buf.split("\n", 1)
1078 |                             line = line.strip()
1079 |                             if not line:
1080 |                                 continue
1081 |                             if line.startswith("data:"):
1082 |                                 json_str = line[5:].strip()
1083 |                                 if not json_str:
1084 |                                     continue
1085 |                                 try:
1086 |                                     obj = json.loads(json_str)
1087 |                                     for cand in obj.get("candidates", []):
1088 |                                         for part in cand.get("content", {}).get("parts", []):
1089 |                                             if "text" in part:
1090 |                                                 token = part["text"]
1091 |                                                 final_synthesis_text += token
1092 |                                                 yield f"event: text\ndata: {json.dumps(token)}\n\n"
1093 |                                 except Exception:
1094 |                                     pass
1095 |                     # Process trailing buffer content
1096 |                     if line_buf.strip():
1097 |                         line = line_buf.strip()
1098 |                         if line.startswith("data:"):
1099 |                             json_str = line[5:].strip()
1100 |                             if json_str:
1101 |                                 try:
1102 |                                     obj = json.loads(json_str)
1103 |                                     for cand in obj.get("candidates", []):
1104 |                                         for part in cand.get("content", {}).get("parts", []):
1105 |                                             if "text" in part:
1106 |                                                 token = part["text"]
1107 |                                                 final_synthesis_text += token
1108 |                                                 yield f"event: text\ndata: {json.dumps(token)}\n\n"
1109 |                                 except Exception:
1110 |                                     pass
1111 |                 else:
1112 |                     err_bytes = await r.aread()
1113 |                     err_msg = f"**Synthesis error ({r.status_code})**: {err_bytes.decode()}"
1114 |                     yield f"event: text\ndata: {json.dumps(err_msg)}\n\n"
1115 |                     final_synthesis_text = err_msg
1116 |         except Exception as exc:
1117 |             err_msg = f"\n\n*Stream Synthesis Error: {str(exc)}*\n\n"
1118 |             yield f"event: text\ndata: {json.dumps(err_msg)}\n\n"
1119 |             final_synthesis_text = err_msg
1120 | 
1121 |     print(f"[DEBUG] final_synthesis_text length: {len(final_synthesis_text)}")
1122 |     if not final_synthesis_text:
1123 |         print("[ERROR] Aggregator produced empty response")
1124 | 
1125 |     # Save complete session data
1126 |     final_chat_messages = []
1127 |     if history:
1128 |         for msg in history:
1129 |             final_chat_messages.append({"id": f"msg-{id(msg)}", "sender": msg.sender, "text": msg.text, "timestamp": ""})
1130 |     final_chat_messages.append({"id": "user-prompt", "sender": "user", "text": prompt, "timestamp": now_str()})
1131 |     final_chat_messages.append({"id": "ai-response", "sender": "ai", "text": final_synthesis_text, "timestamp": now_str()})
1132 | 
1133 |     db.save_session(
1134 |         session_id=session_id,
1135 |         title=prompt[:40] + "..." if len(prompt) > 40 else prompt,
1136 |         prompt=prompt,
1137 |         mode=complexity,
1138 |         nodes=nodes,
1139 |         edges=edges,
1140 |         chat_messages=final_chat_messages,
1141 |         agent_talk_logs=setup_metadata["agent_talk"],
1142 |         execution_state="setup",
1143 |         status_message="Execution completed",
1144 |         follow_up_suggestions=follow_up_suggestions
1145 |     )
1146 | 
1147 |     # Cache final response
1148 |     cached_val = {
1149 |         "metadata": {
1150 |             "complexity": complexity,
1151 |             "capabilities": capabilities,
1152 |             "thinking_summary": thinking_summary,
1153 |             "nodes": nodes,
1154 |             "edges": edges,
1155 |             "agent_talk": setup_metadata["agent_talk"],
1156 |             "follow_up_suggestions": follow_up_suggestions
1157 |         },
1158 |         "text": final_synthesis_text
1159 |     }
1160 |     
1161 |     # Compute embeddings inside
1162 |     try:
1163 |         prompt_embedding = await get_gemini_embedding(prompt, api_key)
1164 |         if prompt_embedding:
1165 |             prompt_hash_overall = hashlib.sha256(prompt.encode('utf-8')).hexdigest()
1166 |             db.save_cached_response(prompt_hash_overall, prompt, prompt_embedding, cached_val)
1167 |     except Exception:
1168 |         pass
1169 | 
1170 |     # Auto-store this full conversation turn in vector memory for cross-turn recall
1171 |     if final_synthesis_text:
1172 |         try:
1173 |             convo_memory = f"User: {prompt}\nAssistant: {final_synthesis_text[:800]}"
1174 |             await store_memory(f"session_{session_id}", convo_memory, api_key, session_id)
1175 |         except Exception:
1176 |             pass
1177 | 
1178 |     yield "event: done\ndata: {}\n\n"
1179 | 
1180 | @app.post("/execute_custom")
1181 | async def execute_custom(req: ExecuteCustomRequest):
1182 |     api_key = req.api_key or os.environ.get("GEMINI_API_KEY")
1183 |     if not api_key or api_key == "MY_GEMINI_API_KEY" or api_key == "":
1184 |         raise HTTPException(
1185 |             status_code=400,
1186 |             detail="Gemini API Key is missing. Please configure BYOK in Settings."
1187 |         )
1188 | 
1189 |     complexity = "simple" if len(req.nodes) == 1 and req.nodes[0]["id"] == "general" else "custom"
1190 |     capabilities = [n["data"].get("tag", "CUSTOM") for n in req.nodes]
1191 |     
1192 |     return StreamingResponse(
1193 |         run_agent_execution_loop(
1194 |             session_id=req.session_id,
1195 |             prompt=req.prompt,
1196 |             history=req.history or [],
1197 |             api_key=api_key,
1198 |             nodes=req.nodes,
1199 |             edges=req.edges,
1200 |             complexity=complexity,
1201 |             capabilities=capabilities,
1202 |             thinking_summary="Running customized agent workflow",
1203 |             follow_up_suggestions=["Can you explain the agent collaboration?"]
1204 |         ),
1205 |         media_type="text/event-stream"
1206 |     )
1207 | 
1208 |
```

### File: `Backend/memory_store.json`

> 142 lines | 3.7 KB

```json
  1 | [
  2 |   {
  3 |     "agent_id": "research",
  4 |     "text": "This is razorpay market research data.",
  5 |     "embedding": [
  6 |       1.0,
  7 |       0.0,
  8 |       0.0
  9 |     ],
 10 |     "timestamp": "2026-05-26T12:37:15.477608"
 11 |   },
 12 |   {
 13 |     "agent_id": "session_test_session_123",
 14 |     "text": "This is razorpay market research data.",
 15 |     "embedding": [
 16 |       1.0,
 17 |       0.0,
 18 |       0.0
 19 |     ],
 20 |     "timestamp": "2026-05-26T12:37:15.477611"
 21 |   },
 22 |   {
 23 |     "agent_id": "general",
 24 |     "text": "Goal: Address the user request with natural, accurate, and comprehensive insights.. Final Solution: Sub-task completed.",
 25 |     "embedding": [
 26 |       1.0,
 27 |       0.0,
 28 |       0.0
 29 |     ],
 30 |     "timestamp": "2026-05-26T12:49:48.761043"
 31 |   },
 32 |   {
 33 |     "agent_id": "session_test_sess",
 34 |     "text": "Goal: Address the user request with natural, accurate, and comprehensive insights.. Final Solution: Sub-task completed.",
 35 |     "embedding": [
 36 |       1.0,
 37 |       0.0,
 38 |       0.0
 39 |     ],
 40 |     "timestamp": "2026-05-26T12:49:48.761048"
 41 |   },
 42 |   {
 43 |     "agent_id": "session_test_sess",
 44 |     "text": "User: Hello\nAssistant: \n\n*Stream Synthesis Error: 'coroutine' object does not support the asynchronous context manager protocol (missed __aexit__ method)*\n\n",
 45 |     "embedding": [
 46 |       1.0,
 47 |       0.0,
 48 |       0.0
 49 |     ],
 50 |     "timestamp": "2026-05-26T12:49:48.801443"
 51 |   },
 52 |   {
 53 |     "agent_id": "session_test_sess",
 54 |     "text": "User: Hello\nAssistant: \n\n*Stream Synthesis Error: 'coroutine' object does not support the asynchronous context manager protocol (missed __aexit__ method)*\n\n",
 55 |     "embedding": [
 56 |       1.0,
 57 |       0.0,
 58 |       0.0
 59 |     ],
 60 |     "timestamp": "2026-05-26T12:49:48.801450"
 61 |   },
 62 |   {
 63 |     "agent_id": "general",
 64 |     "text": "Goal: Address the user request with natural, accurate, and comprehensive insights.. Final Solution: Sub-task completed.",
 65 |     "embedding": [
 66 |       1.0,
 67 |       0.0,
 68 |       0.0
 69 |     ],
 70 |     "timestamp": "2026-05-26T12:50:30.502534"
 71 |   },
 72 |   {
 73 |     "agent_id": "session_test_sess",
 74 |     "text": "Goal: Address the user request with natural, accurate, and comprehensive insights.. Final Solution: Sub-task completed.",
 75 |     "embedding": [
 76 |       1.0,
 77 |       0.0,
 78 |       0.0
 79 |     ],
 80 |     "timestamp": "2026-05-26T12:50:30.502547"
 81 |   },
 82 |   {
 83 |     "agent_id": "session_test_sess",
 84 |     "text": "User: Hello\nAssistant: \n\n*Stream Synthesis Error: 'async for' requires an object with __aiter__ method, got coroutine*\n\n",
 85 |     "embedding": [
 86 |       1.0,
 87 |       0.0,
 88 |       0.0
 89 |     ],
 90 |     "timestamp": "2026-05-26T12:50:30.532697"
 91 |   },
 92 |   {
 93 |     "agent_id": "session_test_sess",
 94 |     "text": "User: Hello\nAssistant: \n\n*Stream Synthesis Error: 'async for' requires an object with __aiter__ method, got coroutine*\n\n",
 95 |     "embedding": [
 96 |       1.0,
 97 |       0.0,
 98 |       0.0
 99 |     ],
100 |     "timestamp": "2026-05-26T12:50:30.532709"
101 |   },
102 |   {
103 |     "agent_id": "general",
104 |     "text": "Goal: Address the user request with natural, accurate, and comprehensive insights.. Final Solution: ",
105 |     "embedding": [
106 |       1.0,
107 |       0.0,
108 |       0.0
109 |     ],
110 |     "timestamp": "2026-05-26T12:50:39.164122"
111 |   },
112 |   {
113 |     "agent_id": "session_test_sess",
114 |     "text": "Goal: Address the user request with natural, accurate, and comprehensive insights.. Final Solution: ",
115 |     "embedding": [
116 |       1.0,
117 |       0.0,
118 |       0.0
119 |     ],
120 |     "timestamp": "2026-05-26T12:50:39.164130"
121 |   },
122 |   {
123 |     "agent_id": "session_test_sess",
124 |     "text": "User: Hello\nAssistant: Hello world!",
125 |     "embedding": [
126 |       1.0,
127 |       0.0,
128 |       0.0
129 |     ],
130 |     "timestamp": "2026-05-26T12:50:39.193061"
131 |   },
132 |   {
133 |     "agent_id": "session_test_sess",
134 |     "text": "User: Hello\nAssistant: Hello world!",
135 |     "embedding": [
136 |       1.0,
137 |       0.0,
138 |       0.0
139 |     ],
140 |     "timestamp": "2026-05-26T12:50:39.193084"
141 |   }
142 | ]
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

> 182 lines | 4.4 KB

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

> 1444 lines | 74.8 KB

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
  26 |   Code,
  27 |   TrendingUp,
  28 |   Sparkles,
  29 |   Copy,
  30 |   Check,
  31 |   Square
  32 | } from "lucide-react";
  33 | import { motion, AnimatePresence } from "motion/react";
  34 | import { ReactFlowProvider } from '@xyflow/react';
  35 | import { useWorkflowStore, ChatSession, ChatMessage, AgentTalkLog } from "@/store/workflowStore";
  36 | import FlowArena from "@/components/FlowArena";
  37 | import MarkdownRenderer from "@/components/MarkdownRenderer";
  38 | 
  39 | export default function SolospaceApp() {
  40 |   return (
  41 |     <ReactFlowProvider>
  42 |       <SolospaceContent />
  43 |     </ReactFlowProvider>
  44 |   );
  45 | }
  46 | 
  47 | function SolospaceContent() {
  48 |   // Store bindings
  49 |   const sessions = useWorkflowStore((s) => s.sessions);
  50 |   const activeSessionId = useWorkflowStore((s) => s.activeSessionId);
  51 |   const nodes = useWorkflowStore((s) => s.nodes);
  52 |   const edges = useWorkflowStore((s) => s.edges);
  53 |   const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  54 |   const executionState = useWorkflowStore((s) => s.executionState);
  55 |   const isOrchestrating = useWorkflowStore((s) => s.isOrchestrating);
  56 |   const isThinking = useWorkflowStore((s) => s.isThinking);
  57 |   const statusMessage = useWorkflowStore((s) => s.statusMessage);
  58 |   const chatMessages = useWorkflowStore((s) => s.chatMessages);
  59 |   const agentTalkLogs = useWorkflowStore((s) => s.agentTalkLogs);
  60 |   const pendingApproval = useWorkflowStore((s) => s.pendingApproval);
  61 | 
  62 |   const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
  63 |   const setNodes = useWorkflowStore((s) => s.setNodes);
  64 |   const setEdges = useWorkflowStore((s) => s.setEdges);
  65 |   const setExecutionState = useWorkflowStore((s) => s.setExecutionState);
  66 |   const updateNodeField = useWorkflowStore((s) => s.updateNodeField);
  67 |   const addRule = useWorkflowStore((s) => s.addRule);
  68 |   const deleteRule = useWorkflowStore((s) => s.deleteRule);
  69 |   const deleteEdge = useWorkflowStore((s) => s.deleteEdge);
  70 |   const liveThoughts = useWorkflowStore((s) => s.liveThoughts);
  71 |   const setApiKey = useWorkflowStore((s) => s.setApiKey);
  72 |   const apiKey = useWorkflowStore((s) => s.apiKey);
  73 | 
  74 |   const triggerSteerOrchestration = useWorkflowStore((s) => s.triggerSteerOrchestration);
  75 |   const setChatMessages = useWorkflowStore((s) => s.setChatMessages);
  76 |   const createSession = useWorkflowStore((s) => s.createSession);
  77 |   const switchSession = useWorkflowStore((s) => s.switchSession);
  78 |   const cancelOrchestration = useWorkflowStore((s) => s.cancelOrchestration);
  79 |   const followUpSuggestions = useWorkflowStore((s) => s.followUpSuggestions);
  80 |   const fetchSessions = useWorkflowStore((s) => s.fetchSessions);
  81 |   const loadSessionFromDb = useWorkflowStore((s) => s.loadSessionFromDb);
  82 |   const deleteSessionFromDb = useWorkflowStore((s) => s.deleteSessionFromDb);
  83 | 
  84 |   const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  85 |   const copyToClipboard = (text: string, msgId: string) => {
  86 |     navigator.clipboard.writeText(text);
  87 |     setCopiedMsgId(msgId);
  88 |     setTimeout(() => setCopiedMsgId(null), 2000);
  89 |   };
  90 | 
  91 |   const chatContainerRef = useRef<HTMLDivElement>(null);
  92 |   const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  93 | 
  94 |   const handleScroll = () => {
  95 |     const container = chatContainerRef.current;
  96 |     if (!container) return;
  97 |     const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
  98 |     setShouldAutoScroll(isAtBottom);
  99 |   };
 100 | 
 101 |   const textareaRef = useRef<HTMLTextAreaElement>(null);
 102 |   const adjustTextareaHeight = () => {
 103 |     const tx = textareaRef.current;
 104 |     if (tx) {
 105 |       tx.style.height = "auto";
 106 |       tx.style.height = `${Math.min(tx.scrollHeight, 200)}px`;
 107 |     }
 108 |   };
 109 | 
 110 |   // Screen and Tab States
 111 |   const [workspaceState, setWorkspaceState] = useState<"home" | "active">("home");
 112 |   const [currentTab, setCurrentTab] = useState<"chat" | "arena">("chat");
 113 |   const [isAutoMode, setIsAutoMode] = useState<boolean>(true);
 114 |   const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(true);
 115 | 
 116 |   // Input fields
 117 |   const [userQuery, setUserQuery] = useState<string>("");
 118 |   const activeSession = activeSessionId ? sessions[activeSessionId] : null;
 119 |   const activePrompt = activeSession ? activeSession.prompt : "";
 120 | 
 121 |   useEffect(() => {
 122 |     adjustTextareaHeight();
 123 |   }, [userQuery]);
 124 | 
 125 |   // API key — read directly from Zustand (not local state, to avoid disconnect)
 126 |   const [isSecretOpen, setIsSecretOpen] = useState<boolean>(false);
 127 |   const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
 128 | 
 129 |   // Tooltip helper state for collapsed sidebar
 130 |   const [hoveredSidebarItem, setHoveredSidebarItem] = useState<string | null>(null);
 131 | 
 132 |   // Node Configuration Panel
 133 |   const [isConfigPanelOpen, setIsConfigPanelOpen] = useState<boolean>(false);
 134 |   const [newRuleText, setNewRuleText] = useState<string>("");
 135 | 
 136 |   // Chat scroll ref
 137 |   const chatEndRef = useRef<HTMLDivElement>(null);
 138 | 
 139 |   // List of available tools in the Arena tool panel
 140 |   const toolsList = [
 141 |     { name: "Web Search", icon: <Globe className="w-4 h-4" />, desc: "Real-time Google search indices" },
 142 |     { name: "Memory", icon: <Database className="w-4 h-4" />, desc: "Persistent memory vector vault" },
 143 |     { name: "Browser", icon: <Eye className="w-4 h-4" />, desc: "Headless browser sandbox access" },
 144 |     { name: "File Upload", icon: <UploadCloud className="w-4 h-4" />, desc: "Parsing spreadsheet/code datasets" },
 145 |     { name: "Vision", icon: <Eye className="w-4 h-4" />, desc: "Image recognition & layout review" },
 146 |     { name: "Voice", icon: <Mic className="w-4 h-4" />, desc: "Acoustic synthesis & recognition" },
 147 |     { name: "Code Executor", icon: <Terminal className="w-4 h-4" />, desc: "Sandboxed node/python runs" },
 148 |     { name: "API Connector", icon: <GitFork className="w-4 h-4" />, desc: "Synchronize external webhooks" }
 149 |   ];
 150 | 
 151 |   // Sync config panel with selectedNodeId
 152 |   useEffect(() => {
 153 |     if (selectedNodeId) {
 154 |       setIsConfigPanelOpen(true);
 155 |     } else {
 156 |       setIsConfigPanelOpen(false);
 157 |     }
 158 |   }, [selectedNodeId]);
 159 | 
 160 |   // Synchronize modal's local display state when it opens
 161 |   const [apiKeyInput, setApiKeyInput] = useState<string>("");
 162 |   useEffect(() => {
 163 |     if (isSecretOpen) {
 164 |       setApiKeyInput(apiKey || "");
 165 |     }
 166 |   }, [isSecretOpen, apiKey]);
 167 | 
 168 |   // Auto-scroll chat to bottom if enabled
 169 |   useEffect(() => {
 170 |     if (shouldAutoScroll) {
 171 |       chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
 172 |     }
 173 |   }, [chatMessages, isThinking, shouldAutoScroll]);
 174 | 
 175 |   // Load sessions from DB on mount
 176 |   useEffect(() => {
 177 |     fetchSessions().catch(e => console.error("Failed to load sessions:", e));
 178 |   }, []);
 179 | 
 180 |   const handleCloseConfigPanel = () => {
 181 |     setIsConfigPanelOpen(false);
 182 |     setSelectedNodeId(null);
 183 |   };
 184 | 
 185 |   // Orchestrator — always stays in chat first
 186 |   const startOrchestration = (promptText: string) => {
 187 |     if (!promptText.trim()) return;
 188 |     setWorkspaceState("active");
 189 |     setCurrentTab("chat"); // ALWAYS stay in chat
 190 | 
 191 |     let sessionId = activeSessionId;
 192 |     if (!sessionId) {
 193 |       sessionId = createSession(promptText, isAutoMode ? "auto" : "custom");
 194 |     }
 195 | 
 196 |     setExecutionState("running");
 197 |     triggerSteerOrchestration(promptText, isAutoMode);
 198 |     setUserQuery("");
 199 |   };
 200 | 
 201 |   // Node editing actions
 202 |   const handleAddRule = () => {
 203 |     if (!newRuleText.trim() || !selectedNodeId) return;
 204 |     addRule(selectedNodeId, newRuleText.trim());
 205 |     setNewRuleText("");
 206 |   };
 207 | 
 208 |   const handleDeleteRule = (ruleIndex: number) => {
 209 |     if (!selectedNodeId) return;
 210 |     deleteRule(selectedNodeId, ruleIndex);
 211 |   };
 212 | 
 213 |   const activeNodeDetail = nodes.find(n => n.id === selectedNodeId) as any;
 214 | 
 215 |   // ── Thinking indicator bubble
 216 |   const ThinkingBubble = () => (
 217 |     <motion.div
 218 |       initial={{ opacity: 0, y: 8 }}
 219 |       animate={{ opacity: 1, y: 0 }}
 220 |       exit={{ opacity: 0, y: -4 }}
 221 |       className="flex flex-col gap-1.5 py-2 px-1"
 222 |     >
 223 |       <div className="flex items-center gap-2">
 224 |         <span className="text-xs text-neutral-500 italic">Thinking</span>
 225 |         <span className="flex gap-1">
 226 |           {[0, 1, 2].map(i => (
 227 |             <span
 228 |               key={i}
 229 |               className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce"
 230 |               style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
 231 |             />
 232 |           ))}
 233 |         </span>
 234 |       </div>
 235 |       {statusMessage && (
 236 |         <span className="text-[10px] font-mono text-neutral-600 pl-0.5 truncate max-w-sm">
 237 |           {statusMessage}
 238 |         </span>
 239 |       )}
 240 |       {liveThoughts && (
 241 |         <div className="mt-1 text-[10px] text-neutral-500 font-sans leading-relaxed max-w-lg whitespace-pre-wrap border-l-2 border-neutral-800 pl-2">
 242 |           {liveThoughts.slice(-400)}
 243 |         </div>
 244 |       )}
 245 |     </motion.div>
 246 |   );
 247 | 
 248 |   // ── Collapsible agent trace (real data from backend)
 249 |   const AgentTraceBlock = ({ logs, thinkingSummary }: { logs: AgentTalkLog[], thinkingSummary?: string }) => {
 250 |     if (logs.length === 0 && !thinkingSummary) return null;
 251 |     return (
 252 |       <div className="border border-[#1f1f1f] rounded-xl overflow-hidden bg-[#050505] mt-3 max-w-2xl w-full">
 253 |         <details className="group" open>
 254 |           <summary className="flex items-center justify-between p-3 cursor-pointer select-none text-[11px] font-semibold text-neutral-500 hover:text-white hover:bg-neutral-900/40 transition-colors">
 255 |             <div className="flex items-center gap-2">
 256 |               <Sparkles className="w-3 h-3 text-neutral-500 group-hover:text-cyan-400 transition-colors" />
 257 |               <span className="font-mono text-[10px] tracking-wider uppercase">Agent Trace & Thinking</span>
 258 |             </div>
 259 |             <div className="flex items-center gap-2">
 260 |               {logs.length > 0 && <span className="text-[9px] text-neutral-600 font-mono">{logs.length} specialist{logs.length !== 1 ? "s" : ""}</span>}
 261 |               <ChevronRight className="w-3.5 h-3.5 text-neutral-600 group-open:rotate-90 transition-transform" />
 262 |             </div>
 263 |           </summary>
 264 |           <div className="border-t border-[#1f1f1f] p-3 space-y-3 bg-[#030303]">
 265 |             {thinkingSummary && (
 266 |               <div className="space-y-1.5 pb-2 border-b border-[#0d0d0d] last:border-0 last:pb-0">
 267 |                 <span className="text-[9px] font-mono text-neutral-500 font-bold uppercase tracking-wider">Reasoning Process</span>
 268 |                 <p className="text-[11px] text-neutral-400 leading-relaxed font-sans whitespace-pre-wrap">
 269 |                   {thinkingSummary}
 270 |                 </p>
 271 |               </div>
 272 |             )}
 273 |             {logs.map((log) => (
 274 |               <div key={log.id} className="flex gap-2 items-start text-[10.5px] leading-relaxed border-b border-[#0d0d0d] pb-2 last:border-0 last:pb-0">
 275 |                 <div className="w-5 h-5 rounded-md bg-neutral-900 flex items-center justify-center border border-white/5 shrink-0 select-none text-[10px] font-mono text-neutral-400">
 276 |                   {log.senderIcon === "science" ? "[S]" : log.senderIcon === "code" ? "[C]" : log.senderIcon === "trending_up" ? "[T]" : log.senderIcon === "present_to_all" ? "[U]" : "[G]"}
 277 |                 </div>
 278 |                 <div className="flex-1 min-w-0">
 279 |                   <div className="flex justify-between items-baseline select-none">
 280 |                     <span className="font-bold text-white uppercase tracking-wider text-[8.5px] leading-none">{log.senderName}</span>
 281 |                     <span className="text-[7.5px] text-neutral-600 font-mono leading-none">{log.timestamp}</span>
 282 |                   </div>
 283 |                   <p className="text-neutral-400 mt-0.5 font-sans leading-relaxed">{log.text}</p>
 284 |                 </div>
 285 |               </div>
 286 |             ))}
 287 |           </div>
 288 |         </details>
 289 |       </div>
 290 |     );
 291 |   };
 292 | 
 293 |   return (
 294 |     <div className="flex h-screen w-full bg-black text-[#f5f5f5] overflow-hidden font-sans">
 295 | 
 296 |       {/* 1. Collapsible Sidebar */}
 297 |       <aside
 298 |         className={`flex flex-col h-full bg-[#0d0d0d] border-r border-[#1f1f1f] shrink-0 transition-all duration-300 z-30 select-none ${
 299 |           isSidebarExpanded ? "w-64" : "w-[60px]"
 300 |         }`}
 301 |       >
 302 |         {/* Top Header Area */}
 303 |         <div className="flex items-center gap-3 h-16 border-b border-[#1f1f1f] px-4 justify-between">
 304 |           {isSidebarExpanded ? (
 305 |             <div className="flex items-center gap-2.5">
 306 |               <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
 307 |                 <Bot className="w-4 h-4 text-black stroke-[2.5]" />
 308 |               </div>
 309 |               <div>
 310 |                 <h1 className="text-sm font-bold text-white tracking-tight leading-none">Solospace</h1>
 311 |               </div>
 312 |             </div>
 313 |           ) : (
 314 |             <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center mx-auto">
 315 |               <Bot className="w-4 h-4 text-black stroke-[2.5]" />
 316 |             </div>
 317 |           )}
 318 |           {isSidebarExpanded && (
 319 |             <button
 320 |               onClick={() => setIsSidebarExpanded(false)}
 321 |               className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 transition-colors cursor-pointer"
 322 |               title="Collapse sidebar"
 323 |             >
 324 |               <ChevronLeft className="w-4 h-4" />
 325 |             </button>
 326 |           )}
 327 |         </div>
 328 | 
 329 |         {/* Sidebar Nav Buttons */}
 330 |         <nav className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto custom-scrollbar">
 331 | 
 332 |           {/* Toggle sidebar button when collapsed */}
 333 |           {!isSidebarExpanded && (
 334 |             <button
 335 |               onClick={() => setIsSidebarExpanded(true)}
 336 |               className="w-full flex items-center justify-center py-2.5 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-all cursor-pointer"
 337 |               title="Expand sidebar"
 338 |             >
 339 |               <ChevronRight className="w-5 h-5" />
 340 |             </button>
 341 |           )}
 342 | 
 343 |           {/* New Chat Button */}
 344 |           <button
 345 |             id="new-chat-btn"
 346 |             onClick={() => {
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
 358 |                 isOrchestrating: false
 359 |               });
 360 |             }}
 361 |             onMouseEnter={() => setHoveredSidebarItem("New Chat")}
 362 |             onMouseLeave={() => setHoveredSidebarItem(null)}
 363 |             className={`w-full flex items-center rounded-lg transition-all duration-150 py-2.5 cursor-pointer relative ${
 364 |               isSidebarExpanded ? "px-3 gap-3 hover:bg-neutral-900 text-neutral-200" : "justify-center text-neutral-400 hover:bg-neutral-900"
 365 |             }`}
 366 |           >
 367 |             <SquarePlus className="w-5 h-5 stroke-[1.8]" />
 368 |             {isSidebarExpanded && <span className="text-xs font-semibold">New Chat</span>}
 369 |             {!isSidebarExpanded && hoveredSidebarItem === "New Chat" && (
 370 |               <div className="absolute left-[64px] bg-[#1a1a1a] border border-[#2d2d2d] py-1 px-2.5 rounded text-[10px] text-white whitespace-nowrap z-50 pointer-events-none shadow-md">
 371 |                 New Chat
 372 |               </div>
 373 |             )}
 374 |           </button>
 375 | 
 376 |           {/* BYOK Button */}
 377 |           <button
 378 |             id="byok-sidebar-btn"
 379 |             onClick={() => setIsSecretOpen(true)}
 380 |             onMouseEnter={() => setHoveredSidebarItem("BYOK")}
 381 |             onMouseLeave={() => setHoveredSidebarItem(null)}
 382 |             className={`w-full flex items-center rounded-lg transition-all duration-150 py-2.5 cursor-pointer relative ${
 383 |               isSidebarExpanded ? "px-3 gap-3 hover:bg-neutral-900 text-neutral-200" : "justify-center text-neutral-400 hover:bg-neutral-900"
 384 |             }`}
 385 |           >
 386 |             <Key className="w-5 h-5 stroke-[1.8]" />
 387 |             {isSidebarExpanded && <span className="text-xs font-semibold">API Keys</span>}
 388 |             {!isSidebarExpanded && hoveredSidebarItem === "BYOK" && (
 389 |               <div className="absolute left-[64px] bg-[#1a1a1a] border border-[#2d2d2d] py-1 px-2.5 rounded text-[10px] text-white whitespace-nowrap z-50 pointer-events-none shadow-md">
 390 |                 Bring Your Own Key
 391 |               </div>
 392 |             )}
 393 |           </button>
 394 | 
 395 |           {/* Recents Log */}
 396 |           {isSidebarExpanded && (
 397 |             <div className="pt-6 space-y-2 select-none">
 398 |               <div className="flex items-center gap-1.5 px-3">
 399 |                 <History className="w-3.5 h-3.5 text-neutral-600" />
 400 |                 <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest font-mono">Recents</span>
 401 |               </div>
 402 |               <div className="space-y-1 max-h-[220px] overflow-y-auto custom-scrollbar">
 403 |                 {Object.values(sessions).length === 0 ? (
 404 |                   <span className="text-[10px] text-neutral-600 italic px-3 block pt-1">No chats yet.</span>
 405 |                 ) : (
 406 |                   Object.values(sessions).reverse().map((s) => (
 407 |                     <button
 408 |                       key={s.id}
 409 |                       onClick={() => {
 410 |                         loadSessionFromDb(s.id);
 411 |                         setWorkspaceState("active");
 412 |                         setCurrentTab("chat");
 413 |                       }}
 414 |                       className={`w-full text-left px-3 py-2 rounded-md text-xs truncate font-medium block cursor-pointer transition-colors ${
 415 |                         activeSessionId === s.id
 416 |                           ? "bg-neutral-800 text-white"
 417 |                           : "text-neutral-500 hover:text-white hover:bg-neutral-900"
 418 |                       }`}
 419 |                       title={s.prompt}
 420 |                     >
 421 |                       {s.title}
 422 |                     </button>
 423 |                   ))
 424 |                 )}
 425 |               </div>
 426 |             </div>
 427 |           )}
 428 |         </nav>
 429 | 
 430 |         {/* Sidebar Footer */}
 431 |         <div className="p-2 border-t border-[#1f1f1f] space-y-1 select-none">
 432 |           <button
 433 |             onClick={() => alert("Settings panel coming soon.")}
 434 |             className={`w-full flex items-center rounded-lg hover:bg-neutral-900 transition-colors py-2 cursor-pointer ${
 435 |               isSidebarExpanded ? "px-3 gap-3 text-neutral-400 hover:text-white" : "justify-center text-neutral-400 hover:text-white"
 436 |             }`}
 437 |           >
 438 |             <Settings className="w-4 h-4" />
 439 |             {isSidebarExpanded && <span className="text-xs">Settings</span>}
 440 |           </button>
 441 |           <button
 442 |             onClick={() => setIsProfileOpen(true)}
 443 |             className={`w-full flex items-center rounded-lg hover:bg-neutral-900 transition-colors py-2 cursor-pointer ${
 444 |               isSidebarExpanded ? "px-3 gap-3 text-neutral-400 hover:text-white" : "justify-center text-neutral-400 hover:text-white"
 445 |             }`}
 446 |           >
 447 |             <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center shrink-0 border border-neutral-700">
 448 |               <User className="w-3.5 h-3.5 text-neutral-300" />
 449 |             </div>
 450 |             {isSidebarExpanded && <span className="text-xs truncate font-medium">Profile</span>}
 451 |           </button>
 452 |         </div>
 453 |       </aside>
 454 | 
 455 |       {/* 2. Core Workspace Window */}
 456 |       <main className="flex-1 flex flex-col min-w-0 bg-[#000000] relative">
 457 | 
 458 |         {/* Header */}
 459 |         <header className="flex justify-between items-center w-full px-6 h-16 border-b border-[#141414] shrink-0 z-10 bg-black/85 backdrop-blur-md">
 460 |           <div className="flex items-center gap-2">
 461 |             {!isSidebarExpanded && (
 462 |               <button
 463 |                 onClick={() => setIsSidebarExpanded(true)}
 464 |                 className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 transition-colors cursor-pointer"
 465 |                 title="Expand sidebar"
 466 |               >
 467 |                 <ChevronRight className="w-4 h-4" />
 468 |               </button>
 469 |             )}
 470 |           </div>
 471 | 
 472 |           {/* Tab Switcher — Chat always left, Flow/Arena only visible when complex task ran */}
 473 |           <div className="flex items-center bg-[#0d0d0d] border border-[#1f1f1f] p-[2px] rounded-full select-none">
 474 |             <button
 475 |               id="tab-chat"
 476 |               onClick={() => {
 477 |                 if (workspaceState === "home") return;
 478 |                 setCurrentTab("chat");
 479 |               }}
 480 |               className={`px-6 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
 481 |                 currentTab === "chat" || workspaceState === "home"
 482 |                   ? "bg-neutral-800 text-white"
 483 |                   : "text-neutral-400 hover:text-white"
 484 |               }`}
 485 |             >
 486 |               Chat
 487 |             </button>
 488 |             {/* Flow tab only shown when complex task (nodes exist) */}
 489 |             {workspaceState === "active" && (
 490 |               <button
 491 |                 id="tab-flow"
 492 |                 onClick={() => setCurrentTab("arena")}
 493 |                 className={`px-6 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
 494 |                   currentTab === "arena"
 495 |                     ? "bg-neutral-800 text-white"
 496 |                     : "text-neutral-400 hover:text-white"
 497 |                 }`}
 498 |               >
 499 |                 <GitFork className="w-3 h-3" />
 500 |                 Flow
 501 |                 {nodes.length > 0 && (
 502 |                   <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse ml-0.5" />
 503 |                 )}
 504 |               </button>
 505 |             )}
 506 |           </div>
 507 | 
 508 |           {/* Right Header Controls */}
 509 |           <div className="flex items-center gap-4 select-none">
 510 |             <button
 511 |               onClick={() => alert("Solospace — AI-powered assistant. Enter any prompt to get a complete, detailed response. For complex tasks, use the Flow tab to inspect the multi-agent pipeline.")}
 512 |               className="text-neutral-400 hover:text-white p-1.5 rounded-md hover:bg-neutral-900 transition-colors cursor-pointer"
 513 |             >
 514 |               <HelpCircle className="w-4 h-4 stroke-[1.8]" />
 515 |             </button>
 516 |           </div>
 517 |         </header>
 518 | 
 519 |         {/* View Layout */}
 520 |         <div className="flex-1 relative overflow-hidden">
 521 | 
 522 |           {/* A. HOME SCREEN */}
 523 |           {workspaceState === "home" && (
 524 |             <div className="absolute inset-0 flex flex-col justify-between overflow-y-auto custom-scrollbar">
 525 |               <div />
 526 |               <div className="w-full max-w-2xl mx-auto px-6 py-12 flex flex-col items-center">
 527 |                 <div className="text-center mb-10 space-y-2 select-none">
 528 |                   <h1 className="text-4xl font-extrabold tracking-tight text-white antialiased">
 529 |                     What&apos;s on your mind?
 530 |                   </h1>
 531 |                   <p className="text-sm text-neutral-400 font-sans">
 532 |                     Ask anything. Get a real, complete answer instantly.
 533 |                   </p>
 534 |                 </div>
 535 | 
 536 |                 {/* Search Bar */}
 537 |                 <div className="w-full chatgpt-input-box rounded-[24px] p-2 flex flex-col gap-2">
 538 |                   <div className="flex items-center gap-3">
 539 |                     <button
 540 |                       onClick={() => alert("File attachment coming soon.")}
 541 |                       className="p-2 text-neutral-500 hover:text-neutral-300 rounded-full hover:bg-neutral-900 transition-colors shrink-0 cursor-pointer"
 542 |                       title="Attach File"
 543 |                     >
 544 |                       <UploadCloud className="w-5 h-5 stroke-[1.8]" />
 545 |                     </button>
 546 |                     <textarea
 547 |                       id="home-prompt-input"
 548 |                       rows={1}
 549 |                       value={userQuery}
 550 |                       onChange={(e) => setUserQuery(e.target.value)}
 551 |                       onKeyDown={(e) => {
 552 |                         if (e.key === "Enter" && !e.shiftKey) {
 553 |                           e.preventDefault();
 554 |                           if (userQuery.trim()) startOrchestration(userQuery);
 555 |                         }
 556 |                       }}
 557 |                       placeholder="Describe your idea, problem, or question..."
 558 |                       className="flex-1 bg-transparent text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-0 resize-none py-1.5 custom-scrollbar"
 559 |                       style={{ maxHeight: "150px" }}
 560 |                     />
 561 |                     <div className="flex items-center gap-1.5 shrink-0">
 562 |                       <button
 563 |                         onClick={() => alert("Voice input coming soon.")}
 564 |                         className="p-2 text-neutral-500 hover:text-neutral-300 rounded-full hover:bg-neutral-900 transition-colors cursor-pointer"
 565 |                         title="Voice Input"
 566 |                       >
 567 |                         <Mic className="w-5 h-5 stroke-[1.8]" />
 568 |                       </button>
 569 |                       <button
 570 |                         id="home-send-btn"
 571 |                         onClick={() => startOrchestration(userQuery)}
 572 |                         disabled={!userQuery.trim()}
 573 |                         className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-neutral-200 active:scale-95 disabled:opacity-20 disabled:scale-100 transition-all font-semibold cursor-pointer"
 574 |                         title="Send prompt"
 575 |                       >
 576 |                         <ArrowRight className="w-4 h-4 text-black stroke-[3]" />
 577 |                       </button>
 578 |                     </div>
 579 |                   </div>
 580 |                 </div>
 581 | 
 582 |                 {/* Mode Selector */}
 583 |                 <div className="flex items-center gap-3 mt-5 select-none">
 584 |                   <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Mode:</span>
 585 |                   <button
 586 |                     onClick={() => setIsAutoMode(true)}
 587 |                     className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono border transition-all cursor-pointer ${
 588 |                       isAutoMode
 589 |                         ? "bg-white text-black border-white font-bold"
 590 |                         : "bg-neutral-950 text-neutral-400 border-[#1f1f1f] hover:text-white"
 591 |                     }`}
 592 |                   >
 593 |                     <Zap className="w-3 h-3 stroke-[2]" />
 594 |                     <span>Auto</span>
 595 |                   </button>
 596 |                   <button
 597 |                     onClick={() => setIsAutoMode(false)}
 598 |                     className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono border transition-all cursor-pointer ${
 599 |                       !isAutoMode
 600 |                         ? "bg-white text-black border-white font-bold"
 601 |                         : "bg-neutral-950 text-neutral-400 border-[#1f1f1f] hover:text-white"
 602 |                     }`}
 603 |                   >
 604 |                     <Sliders className="w-3 h-3" />
 605 |                     <span>Custom Flow</span>
 606 |                   </button>
 607 |                 </div>
 608 | 
 609 |                 {/* Quick start suggestion cards */}
 610 |                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-12 select-none">
 611 |                   <div
 612 |                     onClick={() => { setIsAutoMode(true); startOrchestration("Help me build a SaaS application with Next.js, Stripe payments, and Clerk authentication"); }}
 613 |                     className="border border-[#1f1f1f] bg-[#050505] hover:bg-[#0a0a0a] hover:border-neutral-700 p-4 rounded-xl cursor-pointer transition-all flex flex-col justify-between h-24"
 614 |                   >
 615 |                     <Bot className="w-4 h-4 text-neutral-500" />
 616 |                     <div>
 617 |                       <h3 className="text-xs font-semibold text-white">Full-Stack SaaS App</h3>
 618 |                       <p className="text-[10px] text-neutral-500 mt-1 truncate">Next.js, Stripe, Auth, DB schema.</p>
 619 |                     </div>
 620 |                   </div>
 621 |                   <div
 622 |                     onClick={() => { setIsAutoMode(true); startOrchestration("Write a comprehensive competitive analysis framework for a B2B startup in the AI productivity space"); }}
 623 |                     className="border border-[#1f1f1f] bg-[#050505] hover:bg-[#0a0a0a] hover:border-neutral-700 p-4 rounded-xl cursor-pointer transition-all flex flex-col justify-between h-24"
 624 |                   >
 625 |                     <TrendingUp className="w-4 h-4 text-neutral-500" />
 626 |                     <div>
 627 |                       <h3 className="text-xs font-semibold text-white">Startup Strategy</h3>
 628 |                       <p className="text-[10px] text-neutral-500 mt-1 truncate">Market analysis, positioning, GTM.</p>
 629 |                     </div>
 630 |                   </div>
 631 |                   <div
 632 |                     onClick={() => { setIsAutoMode(true); startOrchestration("Explain how to implement JWT authentication with refresh tokens in a Node.js API"); }}
 633 |                     className="border border-[#1f1f1f] bg-[#050505] hover:bg-[#0a0a0a] hover:border-neutral-700 p-4 rounded-xl cursor-pointer transition-all flex flex-col justify-between h-24"
 634 |                   >
 635 |                     <Code className="w-4 h-4 text-neutral-500" />
 636 |                     <div>
 637 |                       <h3 className="text-xs font-semibold text-white">JWT Auth Guide</h3>
 638 |                       <p className="text-[10px] text-neutral-500 mt-1 truncate">Tokens, refresh flow, security.</p>
 639 |                     </div>
 640 |                   </div>
 641 |                 </div>
 642 |               </div>
 643 |               <div />
 644 |             </div>
 645 |           )}
 646 | 
 647 |           {/* B. ACTIVE WORKSPACE */}
 648 |           {workspaceState === "active" && (
 649 |             <div className="absolute inset-0 flex">
 650 | 
 651 |               {/* VIEW 1: CHAT (Primary — always shown first) */}
 652 |               {currentTab === "chat" && (
 653 |                 <div className="flex-1 flex flex-col justify-between overflow-hidden bg-black">
 654 | 
 655 |                   {/* Chat messages */}
 656 |                   <div
 657 |                     ref={chatContainerRef}
 658 |                     onScroll={handleScroll}
 659 |                     className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4"
 660 |                   >
 661 |                     <div className="max-w-5xl mx-auto space-y-4 select-text">
 662 | 
 663 |                       {chatMessages.map((msg, msgIdx) => (
 664 |                         <motion.div
 665 |                           key={msg.id}
 666 |                           initial={{ opacity: 0, y: 12 }}
 667 |                           animate={{ opacity: 1, y: 0 }}
 668 |                           transition={{ duration: 0.3 }}
 669 |                           className={`flex w-full ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
 670 |                         >
 671 |                           {msg.sender === "user" ? (
 672 |                             <div className="max-w-[72%] rounded-3xl px-5 py-3 bg-[#2f2f2f] text-neutral-100 text-sm leading-relaxed">
 673 |                               <p className="whitespace-pre-wrap">{msg.text}</p>
 674 |                             </div>
 675 |                           ) : (
 676 |                             <div className="flex-1 max-w-[88%] flex flex-col items-start space-y-1">
 677 |                               <div className="w-full text-neutral-100 text-sm leading-relaxed px-1 py-2">
 678 |                                 <MarkdownRenderer content={msg.text || "*Streaming response...*"} />
 679 |                                 
 680 |                                 {/* Action Buttons for AI Response */}
 681 |                                 {msg.text && (
 682 |                                   <div className="flex items-center gap-3 mt-4 text-neutral-500 select-none">
 683 |                                     <button
 684 |                                       onClick={() => copyToClipboard(msg.text, msg.id)}
 685 |                                       className="flex items-center gap-1.5 text-[11px] hover:text-neutral-200 transition-colors cursor-pointer p-1 rounded-md hover:bg-neutral-800"
 686 |                                       title="Copy response"
 687 |                                     >
 688 |                                       {copiedMsgId === msg.id ? (
 689 |                                         <>
 690 |                                           <Check className="w-3.5 h-3.5 text-emerald-400" />
 691 |                                           <span className="text-emerald-400 font-medium">Copied</span>
 692 |                                         </>
 693 |                                       ) : (
 694 |                                         <>
 695 |                                           <Copy className="w-3.5 h-3.5" />
 696 |                                           <span>Copy</span>
 697 |                                         </>
 698 |                                       )}
 699 |                                     </button>
 700 |                                     {msgIdx === chatMessages.length - 1 && !isThinking && !isOrchestrating && (
 701 |                                       <button
 702 |                                         onClick={() => {
 703 |                                           const lastUser = chatMessages.slice().reverse().find(m => m.sender === "user");
 704 |                                           if (lastUser) {
 705 |                                             startOrchestration(lastUser.text);
 706 |                                           }
 707 |                                         }}
 708 |                                         className="flex items-center gap-1.5 text-[11px] hover:text-neutral-200 transition-colors cursor-pointer p-1 rounded-md hover:bg-neutral-800"
 709 |                                         title="Regenerate response"
 710 |                                       >
 711 |                                         <Zap className="w-3.5 h-3.5" />
 712 |                                         <span>Regenerate</span>
 713 |                                       </button>
 714 |                                     )}
 715 |                                   </div>
 716 |                                 )}
 717 |                               </div>
 718 | 
 719 |                               {/* Collapsible trace block and see flow buttons outside bubble */}
 720 |                               {msgIdx === chatMessages.length - 1 && (
 721 |                                 <div className="space-y-3 pt-1 w-full">
 722 |                                   <AgentTraceBlock
 723 |                                     logs={agentTalkLogs}
 724 |                                     thinkingSummary={msg.thinkingSummary}
 725 |                                   />
 726 |                                   
 727 |                                   {!isThinking && !isOrchestrating && nodes.length > 0 && (
 728 |                                     <div className="flex flex-wrap gap-2 pt-1">
 729 |                                       <button
 730 |                                         id="see-flow-btn"
 731 |                                         onClick={() => setCurrentTab("arena")}
 732 |                                         className="px-4 py-2 bg-neutral-950 hover:bg-neutral-900 border border-[#1f1f1f] hover:border-cyan-500/40 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer max-w-max select-none"
 733 |                                       >
 734 |                                         <GitFork className="w-3.5 h-3.5 text-cyan-400" />
 735 |                                         <span>See Agent Flow</span>
 736 |                                         <span className="text-[9px] font-mono text-neutral-600">({nodes.length} agents)</span>
 737 |                                       </button>
 738 | 
 739 |                                       {!isAutoMode && (
 740 |                                         <button
 741 |                                           onClick={() => setCurrentTab("arena")}
 742 |                                           className="px-4 py-2 bg-neutral-950 hover:bg-neutral-900 border border-[#1f1f1f] hover:border-neutral-500 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer max-w-max select-none"
 743 |                                         >
 744 |                                           <Sliders className="w-3.5 h-3.5" />
 745 |                                           <span>Customize Agents</span>
 746 |                                         </button>
 747 |                                       )}
 748 |                                     </div>
 749 |                                   )}
 750 |                                 </div>
 751 |                               )}
 752 |                             </div>
 753 |                           )}
 754 |                         </motion.div>
 755 |                       ))}
 756 | 
 757 |                       {/* Thinking indicator */}
 758 |                       <AnimatePresence>
 759 |                         {isThinking && <ThinkingBubble />}
 760 |                       </AnimatePresence>
 761 | 
 762 |                       {/* Auto-scroll anchor */}
 763 |                       <div ref={chatEndRef} />
 764 |                     </div>
 765 |                   </div>
 766 | 
 767 |                   {/* Bottom input bar */}
 768 |                   <div className="px-6 py-4 bg-black/60 border-t border-[#141414] backdrop-blur-xl shrink-0 flex flex-col gap-2">
 769 |                     {!isAutoMode && workspaceState === "active" && (
 770 |                       <div className="text-[10px] font-mono text-amber-400 bg-amber-950/30 px-3 py-1 rounded-full self-center border border-amber-500/20 max-w-max select-none">
 771 |                         Planning Mode – Edit agents in Flow, then click Proceed
 772 |                       </div>
 773 |                     )}
 774 |                     <div className="max-w-3xl mx-auto w-full chatgpt-input-box rounded-[24px] p-1.5 flex items-center gap-2">
 775 |                       <textarea
 776 |                         ref={textareaRef}
 777 |                         id="chat-prompt-input"
 778 |                         rows={1}
 779 |                         value={userQuery}
 780 |                         onChange={(e) => setUserQuery(e.target.value)}
 781 |                         onKeyDown={(e) => {
 782 |                           if (e.key === "Enter" && !e.shiftKey) {
 783 |                             e.preventDefault();
 784 |                             if (!isOrchestrating && userQuery.trim()) startOrchestration(userQuery);
 785 |                           }
 786 |                         }}
 787 |                         placeholder={isOrchestrating ? "Streaming response..." : (isAutoMode ? "Ask a follow-up or new question..." : "Enter a new idea to generate agents (no auto-run)...")}
 788 |                         disabled={isOrchestrating}
 789 |                         className="flex-1 bg-transparent text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-0 px-3 py-1.5 disabled:opacity-50 resize-none max-h-40 custom-scrollbar"
 790 |                       />
 791 |                       {isOrchestrating ? (
 792 |                         <button
 793 |                           onClick={cancelOrchestration}
 794 |                           className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-500 active:scale-95 transition-all font-semibold cursor-pointer shrink-0"
 795 |                           title="Stop generating"
 796 |                         >
 797 |                           <Square className="w-3.5 h-3.5 text-white fill-white" />
 798 |                         </button>
 799 |                       ) : (
 800 |                         <button
 801 |                           id="chat-send-btn"
 802 |                           onClick={() => startOrchestration(userQuery)}
 803 |                           disabled={!userQuery.trim() || isThinking}
 804 |                           className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-neutral-200 active:scale-95 disabled:opacity-20 disabled:scale-100 transition-all font-semibold cursor-pointer shrink-0"
 805 |                           title="Send message"
 806 |                         >
 807 |                           <ArrowRight className="w-4 h-4 text-black stroke-[3]" />
 808 |                         </button>
 809 |                       )}
 810 |                     </div>
 811 |                   </div>
 812 |                 </div>
 813 |               )}
 814 | 
 815 |               {/* VIEW 2: ARENA CANVAS (Optional — Flow inspection/editing) */}
 816 |               {currentTab === "arena" && (
 817 |                 <div className="flex-1 relative overflow-hidden bg-[#000000] flex">
 818 | 
 819 |                   {/* Back to chat bar at top */}
 820 |                   <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#0d0d0d]/90 border border-[#1f1f1f] rounded-full px-4 py-2 backdrop-blur-md shadow-xl pointer-events-auto">
 821 |                     <button
 822 |                       onClick={() => setCurrentTab("chat")}
 823 |                       className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer font-mono"
 824 |                     >
 825 |                       <ChevronLeft className="w-3.5 h-3.5" />
 826 |                       Back to Chat
 827 |                     </button>
 828 |                     <span className="text-neutral-700 text-xs">|</span>
 829 |                     <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
 830 |                       Agent Flow — {nodes.length} active
 831 |                     </span>
 832 |                   </div>
 833 | 
 834 |                   {/* FLOATING LEFT SIDE Arena Tools Panel */}
 835 |                   <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col bg-[#0d0d0d]/80 border border-[#1f1f1f] p-1.5 rounded-xl z-20 backdrop-blur-md shadow-2xl">
 836 |                     <div className="text-[8px] font-mono text-neutral-600 uppercase tracking-widest px-2 pb-2 text-center select-none border-b border-[#141414] mb-2 font-bold">
 837 |                       Tools
 838 |                     </div>
 839 |                     {toolsList.map((tool) => (
 840 |                       <div
 841 |                         key={tool.name}
 842 |                         draggable
 843 |                         onDragStart={(e) => e.dataTransfer.setData("toolName", tool.name)}
 844 |                         className="p-2.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-900 transition-all cursor-grab active:cursor-grabbing flex items-center justify-center relative group"
 845 |                       >
 846 |                         {tool.icon}
 847 |                         <div className="absolute left-12 bg-[#0c0c0c] border border-[#1f1f1f] p-2.5 rounded-lg text-left hidden group-hover:block w-40 z-30 shadow-2xl pointer-events-none">
 848 |                           <h4 className="text-[10px] font-bold text-white">{tool.name}</h4>
 849 |                           <p className="text-[9px] text-neutral-400 mt-0.5 leading-relaxed">{tool.desc}</p>
 850 |                           <span className="text-[8px] font-mono text-neutral-600 block mt-1.5 italic">Drag onto agent node</span>
 851 |                         </div>
 852 |                       </div>
 853 |                     ))}
 854 |                   </div>
 855 | 
 856 |                   {/* Flow Arena */}
 857 |                   <FlowArena />
 858 | 
 859 |                   {/* Bottom controls — Proceed & Return to Chat */}
 860 |                   <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center gap-3">
 861 |                     <button
 862 |                       onClick={() => {
 863 |                         setCurrentTab("chat"); // Switch back to chat to see the output stream
 864 |                         const triggerCustomExecution = useWorkflowStore.getState().triggerCustomExecution;
 865 |                         triggerCustomExecution();
 866 |                       }}
 867 |                       className="bg-white hover:bg-neutral-200 text-black font-bold text-xs h-10 px-6 rounded-[24px] shadow-2xl flex items-center gap-1.5 cursor-pointer shrink-0 transition-all active:scale-95"
 868 |                     >
 869 |                       <Zap className="w-3.5 h-3.5 text-black fill-black" />
 870 |                       <span>Proceed with Agents</span>
 871 |                     </button>
 872 |                     <button
 873 |                       onClick={() => setCurrentTab("chat")}
 874 |                       className="h-10 px-4 rounded-[24px] border border-[#1f1f1f] hover:border-neutral-600 bg-black/80 backdrop-blur-md text-neutral-400 hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-2xl"
 875 |                     >
 876 |                       Return to Chat
 877 |                     </button>
 878 |                   </div>
 879 |                 </div>
 880 |               )}
 881 |             </div>
 882 |           )}
 883 |         </div>
 884 |       </main>
 885 | 
 886 |       {/* 3. RIGHT Sliding Configuration Edit Panel */}
 887 |       <div
 888 |         className={`fixed top-0 right-0 h-full w-[400px] bg-[#0c0c0c]/95 border-l border-[#1f1f1f] z-40 flex flex-col justify-between shadow-2xl transition-transform duration-300 right-panel select-none ${
 889 |           isConfigPanelOpen ? "translate-x-0" : "translate-x-full"
 890 |         }`}
 891 |       >
 892 |         <button
 893 |           onClick={handleCloseConfigPanel}
 894 |           className="absolute -left-8 top-1/2 -translate-y-1/2 w-8 h-16 bg-[#0c0c0c]/95 border border-[#1f1f1f] border-r-0 rounded-l-xl flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer"
 895 |         >
 896 |           {isConfigPanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
 897 |         </button>
 898 | 
 899 |         {activeNodeDetail ? (
 900 |           <div className="flex-1 flex flex-col h-full overflow-hidden">
 901 |             <div className="p-5 border-b border-[#1f1f1f] flex justify-between items-center bg-[#0d0d0d]">
 902 |               <div>
 903 |                 <h3 className="text-sm font-bold text-white uppercase tracking-wider">{activeNodeDetail.data.name}</h3>
 904 |                 <span className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest block mt-0.5">{activeNodeDetail.data.tag}</span>
 905 |               </div>
 906 |               <button onClick={handleCloseConfigPanel} className="text-neutral-500 hover:text-white cursor-pointer">
 907 |                 <X className="w-4 h-4" />
 908 |               </button>
 909 |             </div>
 910 | 
 911 |             <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
 912 |               {/* Enable/Disable toggle */}
 913 |               <div className="flex items-center justify-between bg-[#070707] border border-[#1f1f1f] p-3 rounded-xl">
 914 |                 <div className="flex flex-col">
 915 |                   <span className="text-[10px] font-bold text-white uppercase tracking-wider">Active</span>
 916 |                   <span className="text-[9px] text-neutral-500 mt-0.5">Disable to exclude from pipeline</span>
 917 |                 </div>
 918 |                 <button
 919 |                   onClick={() => updateNodeField(activeNodeDetail.id, { enabled: !activeNodeDetail.data.enabled })}
 920 |                   className={`w-10 h-5 rounded-full p-0.5 transition-all duration-200 cursor-pointer ${activeNodeDetail.data.enabled ? "bg-white" : "bg-neutral-800"}`}
 921 |                 >
 922 |                   <div className={`w-4 h-4 rounded-full transition-transform ${activeNodeDetail.data.enabled ? "bg-black translate-x-5" : "bg-neutral-600 translate-x-0"}`} />
 923 |                 </button>
 924 |               </div>
 925 | 
 926 |               {/* Priority Slider */}
 927 |               <div className="space-y-1 bg-[#070707] border border-[#1f1f1f] p-3 rounded-xl">
 928 |                 <div className="flex justify-between items-center text-[9px] font-mono uppercase text-neutral-400 font-bold">
 929 |                   <span>Priority</span>
 930 |                   <span className="text-white">Level {activeNodeDetail.data.priority}</span>
 931 |                 </div>
 932 |                 <input
 933 |                   type="range" min="1" max="10" step="1"
 934 |                   value={activeNodeDetail.data.priority}
 935 |                   onChange={(e) => updateNodeField(activeNodeDetail.id, { priority: parseInt(e.target.value) })}
 936 |                   className="w-full accent-white h-1 bg-[#1f1f1f] rounded-lg appearance-none cursor-pointer mt-2"
 937 |                 />
 938 |               </div>
 939 | 
 940 |               {/* Name */}
 941 |               <div className="space-y-1.5">
 942 |                 <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Agent Name</label>
 943 |                 <input
 944 |                   type="text" value={activeNodeDetail.data.name}
 945 |                   onChange={(e) => updateNodeField(activeNodeDetail.id, { name: e.target.value })}
 946 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-3 py-2 text-xs text-white focus:border-neutral-500 outline-none"
 947 |                 />
 948 |               </div>
 949 | 
 950 |               {/* Personality */}
 951 |               <div className="space-y-1.5">
 952 |                 <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Personality</label>
 953 |                 <input
 954 |                   type="text" value={activeNodeDetail.data.personality}
 955 |                   onChange={(e) => updateNodeField(activeNodeDetail.id, { personality: e.target.value })}
 956 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-3 py-2 text-xs text-white focus:border-neutral-500 outline-none"
 957 |                 />
 958 |               </div>
 959 | 
 960 |               {/* System Prompt */}
 961 |               <div className="space-y-1.5">
 962 |                 <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">System Prompt</label>
 963 |                 <textarea
 964 |                   value={activeNodeDetail.data.systemPrompt}
 965 |                   onChange={(e) => updateNodeField(activeNodeDetail.id, { systemPrompt: e.target.value })}
 966 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg p-3 text-xs text-white focus:border-neutral-500 outline-none min-h-[80px] resize-none leading-relaxed"
 967 |                 />
 968 |               </div>
 969 | 
 970 |               {/* Goal Objective */}
 971 |               <div className="space-y-1.5">
 972 |                 <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Objective</label>
 973 |                 <textarea
 974 |                   value={activeNodeDetail.data.objective}
 975 |                   onChange={(e) => updateNodeField(activeNodeDetail.id, { objective: e.target.value })}
 976 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg p-3 text-xs text-white focus:border-neutral-500 outline-none min-h-[60px] resize-none leading-relaxed"
 977 |                 />
 978 |               </div>
 979 | 
 980 |               {/* Rules */}
 981 |               <div className="space-y-2">
 982 |                 <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold block">Rules</label>
 983 |                 <div className="space-y-1.5">
 984 |                   {activeNodeDetail.data.rules && activeNodeDetail.data.rules.map((rule: any, idx: number) => (
 985 |                     <div key={idx} className="flex gap-2 items-center bg-[#050505] border border-[#1f1f1f] p-2 rounded-lg justify-between">
 986 |                       <span className="text-[10px] text-neutral-300 leading-normal flex-1 pr-2">{rule}</span>
 987 |                       <button onClick={() => handleDeleteRule(idx)} className="text-neutral-500 hover:text-red-400 transition-colors shrink-0 cursor-pointer">
 988 |                         <Trash2 className="w-3.5 h-3.5" />
 989 |                       </button>
 990 |                     </div>
 991 |                   ))}
 992 |                 </div>
 993 |                 <div className="flex gap-2">
 994 |                   <input
 995 |                     type="text" value={newRuleText}
 996 |                     onChange={(e) => setNewRuleText(e.target.value)}
 997 |                     placeholder="Add constraint..."
 998 |                     className="flex-1 bg-[#050505] border border-[#1f1f1f] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-neutral-500"
 999 |                   />
1000 |                   <button onClick={handleAddRule} className="bg-white text-black font-bold text-xs px-3 rounded-lg hover:bg-neutral-200 cursor-pointer">Add</button>
1001 |                 </div>
1002 |               </div>
1003 | 
1004 |               {/* Sliders */}
1005 |               <div className="space-y-4 pt-3 border-t border-[#141414]">
1006 |                 {[
1007 |                   { label: "Creativity", key: "temp", min: 0, max: 1, step: 0.05, display: (v: number) => v.toString() },
1008 |                   { label: "Logic / Depth", key: "logic", min: 10, max: 100, step: 5, display: (v: number) => `${v}%` },
1009 |                   { label: "Empathy", key: "empathy", min: 0, max: 100, step: 5, display: (v: number) => `${v}%` }
1010 |                 ].map(({ label, key, min, max, step, display }) => (
1011 |                   <div key={key} className="space-y-1">
1012 |                     <div className="flex justify-between items-center text-[9px] font-mono uppercase text-neutral-400 font-bold">
1013 |                       <span>{label}</span>
1014 |                       <span className="text-white">{display(activeNodeDetail.data[key])}</span>
1015 |                     </div>
1016 |                     <input
1017 |                       type="range" min={min} max={max} step={step}
1018 |                       value={activeNodeDetail.data[key]}
1019 |                       onChange={(e) => updateNodeField(activeNodeDetail.id, { [key]: key === "temp" ? parseFloat(e.target.value) : parseInt(e.target.value) })}
1020 |                       className="w-full accent-white h-1 bg-[#1f1f1f] rounded-lg appearance-none cursor-pointer"
1021 |                     />
1022 |                   </div>
1023 |                 ))}
1024 |               </div>
1025 | 
1026 |               {/* Tool Integrations */}
1027 |               <div className="pt-5 border-t border-[#141414] space-y-4">
1028 |                 <div className="flex justify-between items-center">
1029 |                   <label className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Tools</label>
1030 |                   <span className="text-[8px] font-mono text-neutral-500 uppercase">Attached: {activeNodeDetail.data.tools?.length || 0}</span>
1031 |                 </div>
1032 |                 <select
1033 |                   id="tool-selector-dropdown"
1034 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 outline-none focus:border-neutral-500"
1035 |                   defaultValue=""
1036 |                   onChange={(e) => {
1037 |                     const toolName = e.target.value;
1038 |                     if (!toolName) return;
1039 |                     const currentTools = activeNodeDetail.data.tools || [];
1040 |                     if (!currentTools.includes(toolName)) {
1041 |                       const updatedTools = [...currentTools, toolName];
1042 |                       const permissions = activeNodeDetail.data.toolPermissions || {};
1043 |                       const updatedPerms = { ...permissions, [toolName]: permissions[toolName] || "ALLOWED" };
1044 |                       updateNodeField(activeNodeDetail.id, { tools: updatedTools, toolPermissions: updatedPerms });
1045 |                     }
1046 |                     e.target.value = "";
1047 |                   }}
1048 |                 >
1049 |                   <option value="" disabled>+ Attach tool...</option>
1050 |                   {["Web Search", "Browser", "Memory", "File Upload", "Code Executor", "Vision", "Voice", "API Connector"]
1051 |                     .filter(tool => !(activeNodeDetail.data.tools || []).includes(tool))
1052 |                     .map((tool: string) => (
1053 |                       <option key={tool} value={tool}>{tool}</option>
1054 |                     ))}
1055 |                 </select>
1056 | 
1057 |                 <div className="space-y-3">
1058 |                   {(!activeNodeDetail.data.tools || activeNodeDetail.data.tools.length === 0) ? (
1059 |                     <div className="bg-[#050505] border border-dashed border-[#1f1f1f] p-4 text-center rounded-xl">
1060 |                       <p className="text-[10px] text-neutral-500">No tools attached.</p>
1061 |                     </div>
1062 |                   ) : (
1063 |                     activeNodeDetail.data.tools.map((tool: any) => {
1064 |                       const currentPermissions = activeNodeDetail.data.toolPermissions || {};
1065 |                       const permission = currentPermissions[tool] || "ALLOWED";
1066 |                       return (
1067 |                         <div key={tool} className="bg-[#050505] border border-[#1f1f1f] p-3 rounded-xl space-y-2">
1068 |                           <div className="flex justify-between items-center">
1069 |                             <span className="text-xs font-bold text-white flex items-center gap-1.5">
1070 |                               <span className={`w-1.5 h-1.5 rounded-full ${permission === "ALLOWED" ? "bg-emerald-500 animate-pulse" : permission === "ASK" ? "bg-amber-500" : "bg-rose-500"}`} />
1071 |                               {tool}
1072 |                             </span>
1073 |                             <button
1074 |                               onClick={() => {
1075 |                                 const updatedTools = (activeNodeDetail.data.tools || []).filter((t: string) => t !== tool);
1076 |                                 const updatedPerms = { ...(activeNodeDetail.data.toolPermissions || {}) };
1077 |                                 delete updatedPerms[tool];
1078 |                                 updateNodeField(activeNodeDetail.id, { tools: updatedTools, toolPermissions: updatedPerms });
1079 |                               }}
1080 |                               className="text-neutral-500 hover:text-red-400 p-1 transition-colors cursor-pointer"
1081 |                             >
1082 |                               <Trash2 className="w-3.5 h-3.5" />
1083 |                             </button>
1084 |                           </div>
1085 |                           <div className="grid grid-cols-3 gap-1 pt-1">
1086 |                             {(["ALLOWED", "ASK", "DENIED"] as const).map((level) => (
1087 |                               <button
1088 |                                 key={level}
1089 |                                 onClick={() => {
1090 |                                   const updatedPerms = { ...(activeNodeDetail.data.toolPermissions || {}), [tool]: level };
1091 |                                   updateNodeField(activeNodeDetail.id, { toolPermissions: updatedPerms });
1092 |                                 }}
1093 |                                 className={`py-1 text-[9px] font-mono font-bold rounded-md border transition-all cursor-pointer ${
1094 |                                   permission === level
1095 |                                     ? level === "ALLOWED" ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/50"
1096 |                                     : level === "ASK" ? "bg-amber-950/40 text-amber-400 border-amber-500/50"
1097 |                                     : "bg-rose-950/40 text-rose-400 border-rose-500/50"
1098 |                                     : "bg-transparent text-neutral-500 border-[#1f1f1f] hover:text-neutral-300"
1099 |                                 }`}
1100 |                               >
1101 |                                 {level === "ALLOWED" ? "ALLOW" : level === "ASK" ? "ASK" : "DENY"}
1102 |                               </button>
1103 |                             ))}
1104 |                           </div>
1105 |                         </div>
1106 |                       );
1107 |                     })
1108 |                   )}
1109 |                 </div>
1110 |               </div>
1111 | 
1112 |               {/* Connections */}
1113 |               <div className="pt-5 border-t border-[#141414] space-y-4">
1114 |                 <div className="flex justify-between items-center">
1115 |                   <label className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Connections</label>
1116 |                   <span className="text-[8px] font-mono text-neutral-500 uppercase">
1117 |                     Links: {edges.filter(c => c.source === activeNodeDetail.id || c.target === activeNodeDetail.id).length}
1118 |                   </span>
1119 |                 </div>
1120 |                 <select
1121 |                   id="connection-selector-dropdown"
1122 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 outline-none focus:border-neutral-500"
1123 |                   defaultValue=""
1124 |                   onChange={(e) => {
1125 |                     const targetId = e.target.value;
1126 |                     if (!targetId) return;
1127 |                     const exists = edges.some(c =>
1128 |                       (c.source === activeNodeDetail.id && c.target === targetId) ||
1129 |                       (c.source === targetId && c.target === activeNodeDetail.id)
1130 |                     );
1131 |                     if (!exists) {
1132 |                       setEdges(prev => [...prev, {
1133 |                         id: `e-${activeNodeDetail.id}-${targetId}`,
1134 |                         source: activeNodeDetail.id,
1135 |                         target: targetId,
1136 |                         animated: true,
1137 |                         type: 'custom'
1138 |                       }]);
1139 |                     }
1140 |                     e.target.value = "";
1141 |                   }}
1142 |                 >
1143 |                   <option value="" disabled>+ Connect to agent...</option>
1144 |                   {nodes.filter(n => n.id !== activeNodeDetail.id && n.type === 'custom').map(node => (
1145 |                     <option key={node.id} value={node.id}>{(node.data as any).name}</option>
1146 |                   ))}
1147 |                 </select>
1148 |                 <div className="space-y-1.5">
1149 |                   {(() => {
1150 |                     const linkedConns = edges.filter(c => c.source === activeNodeDetail.id || c.target === activeNodeDetail.id);
1151 |                     if (linkedConns.length === 0) {
1152 |                       return (
1153 |                         <div className="bg-[#050505] border border-dashed border-[#1f1f1f] p-3 text-center rounded-xl">
1154 |                           <p className="text-[10px] text-neutral-500">No connections.</p>
1155 |                         </div>
1156 |                       );
1157 |                     }
1158 |                     return linkedConns.map((conn, index) => {
1159 |                       const otherNodeId = conn.source === activeNodeDetail.id ? conn.target : conn.source;
1160 |                       const otherNode = nodes.find(n => n.id === otherNodeId);
1161 |                       return (
1162 |                         <div key={index} className="flex gap-2 items-center bg-[#050505] border border-[#1f1f1f] p-2 rounded-lg justify-between">
1163 |                           <span className="text-[10px] text-neutral-300 leading-normal flex-1 pr-2">
1164 |                             {otherNode ? (otherNode.data as any).name : otherNodeId}
1165 |                           </span>
1166 |                           <button onClick={() => deleteEdge(conn.id)} className="text-neutral-500 hover:text-red-400 transition-colors shrink-0 cursor-pointer">
1167 |                             <Trash2 className="w-3.5 h-3.5" />
1168 |                           </button>
1169 |                         </div>
1170 |                       );
1171 |                     });
1172 |                   })()}
1173 |                 </div>
1174 |               </div>
1175 | 
1176 |               {/* Execution Logs */}
1177 |               <div className="pt-5 border-t border-[#141414] space-y-3">
1178 |                 <div className="flex justify-between items-center">
1179 |                   <label className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Execution Log</label>
1180 |                   <button
1181 |                     onClick={() => updateNodeField(activeNodeDetail.id, { toolLogs: [] })}
1182 |                     className="text-[8px] font-mono text-neutral-500 hover:text-white uppercase transition-colors cursor-pointer"
1183 |                   >
1184 |                     Clear
1185 |                   </button>
1186 |                 </div>
1187 |                 <div className="bg-black border border-[#1f1f1f] rounded-xl p-3 h-44 overflow-y-auto font-mono text-[9px] space-y-1.5 custom-scrollbar">
1188 |                   {(!activeNodeDetail.data.toolLogs || activeNodeDetail.data.toolLogs.length === 0) ? (
1189 |                     <div className="h-full flex items-center justify-center text-neutral-600 text-center">
1190 |                       <span>No logs recorded.</span>
1191 |                     </div>
1192 |                   ) : (
1193 |                     activeNodeDetail.data.toolLogs.map((log: any) => (
1194 |                       <div key={log.id} className="flex gap-1.5 items-start leading-normal text-neutral-300">
1195 |                         <span className="text-neutral-500 shrink-0 select-none">[{log.timestamp}]</span>
1196 |                         <div className="flex-1">
1197 |                           <span className="font-bold text-white uppercase mr-1">[{log.tool}]</span>
1198 |                           <span>{log.detail}</span>
1199 |                         </div>
1200 |                         <span className={`shrink-0 font-bold px-1 rounded-sm text-[8px] ${
1201 |                           log.status === "SUCCESS" ? "bg-emerald-950 text-emerald-400" :
1202 |                           log.status === "PENDING" ? "bg-amber-950 text-amber-400 animate-pulse" :
1203 |                           log.status === "BLOCKED" ? "bg-rose-950 text-rose-400" : "bg-neutral-800 text-neutral-400"
1204 |                         }`}>
1205 |                           {log.status}
1206 |                         </span>
1207 |                       </div>
1208 |                     ))
1209 |                   )}
1210 |                 </div>
1211 | 
1212 |               </div>
1213 |             </div>
1214 | 
1215 |             {/* Footer */}
1216 |             <div className="p-4 border-t border-[#1f1f1f] bg-[#0d0d0d] grid grid-cols-2 gap-3">
1217 |               <button
1218 |                 onClick={() => { handleCloseConfigPanel(); }}
1219 |                 className="py-2.5 border border-[#1f1f1f] text-xs font-semibold text-neutral-400 hover:text-white rounded-lg transition-colors font-mono cursor-pointer"
1220 |               >
1221 |                 Close
1222 |               </button>
1223 |               <button
1224 |                 onClick={() => {
1225 |                   alert("Agent configuration saved.");
1226 |                   handleCloseConfigPanel();
1227 |                 }}
1228 |                 className="py-2.5 bg-white hover:bg-neutral-100 text-black text-xs font-bold rounded-lg transition-all font-mono cursor-pointer"
1229 |               >
1230 |                 Save Config
1231 |               </button>
1232 |             </div>
1233 |           </div>
1234 |         ) : (
1235 |           <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
1236 |             <Bot className="w-12 h-12 text-neutral-700 mb-3 animate-pulse" />
1237 |             <p className="text-xs text-neutral-500">Click any agent node in the Flow to edit its configuration.</p>
1238 |           </div>
1239 |         )}
1240 |       </div>
1241 | 
1242 |       {/* 4. Modals & Overlays */}
1243 |       <AnimatePresence>
1244 | 
1245 |         {/* BYOK MODAL */}
1246 |         {isSecretOpen && (
1247 |           <motion.div
1248 |             initial={{ opacity: 0 }}
1249 |             animate={{ opacity: 1 }}
1250 |             exit={{ opacity: 0 }}
1251 |             className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-6 select-none"
1252 |           >
1253 |             <motion.div
1254 |               initial={{ scale: 0.95 }}
1255 |               animate={{ scale: 1 }}
1256 |               exit={{ scale: 0.95 }}
1257 |               className="w-full max-w-md bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl p-6 relative shadow-2xl"
1258 |             >
1259 |               <button onClick={() => setIsSecretOpen(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white cursor-pointer">
1260 |                 <X className="w-5 h-5" />
1261 |               </button>
1262 |               <div className="flex gap-4 items-center mb-6">
1263 |                 <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
1264 |                   <Key className="w-6 h-6 text-white" />
1265 |                 </div>
1266 |                 <div>
1267 |                   <h3 className="text-sm font-bold text-white">API Key Settings</h3>
1268 |                   <p className="text-xs text-neutral-400 font-sans mt-0.5">Connect your Gemini API key to power the AI.</p>
1269 |                 </div>
1270 |               </div>
1271 |               <div className="space-y-4">
1272 |                 <div className="space-y-1.5">
1273 |                   <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">GEMINI_API_KEY</label>
1274 |                   <input
1275 |                     id="api-key-input"
1276 |                     type="password"
1277 |                     placeholder="Enter AIzaSy... key from Google AI Studio"
1278 |                     value={apiKeyInput}
1279 |                     onChange={(e) => setApiKeyInput(e.target.value)}
1280 |                     className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500"
1281 |                   />
1282 |                   <p className="text-[9px] text-neutral-500 font-mono leading-normal">
1283 |                     Get a free key at <span className="text-cyan-400">aistudio.google.com</span>. Your key is stored locally only.
1284 |                   </p>
1285 |                 </div>
1286 |                 <div className="pt-4 flex gap-3">
1287 |                   <button
1288 |                     id="save-api-key-btn"
1289 |                     onClick={() => {
1290 |                       setApiKey(apiKeyInput.trim());
1291 |                       setIsSecretOpen(false);
1292 |                     }}
1293 |                     className="flex-1 py-2.5 bg-white hover:bg-neutral-100 text-black font-bold rounded-xl text-xs font-mono transition-colors cursor-pointer"
1294 |                   >
1295 |                     Save Key
1296 |                   </button>
1297 |                   <button
1298 |                     onClick={() => setIsSecretOpen(false)}
1299 |                     className="px-5 py-2.5 border border-[#1f1f1f] text-neutral-400 hover:text-white rounded-xl text-xs font-mono transition-colors cursor-pointer"
1300 |                   >
1301 |                     Cancel
1302 |                   </button>
1303 |                 </div>
1304 |               </div>
1305 |             </motion.div>
1306 |           </motion.div>
1307 |         )}
1308 | 
1309 |         {/* USER PROFILE MODAL */}
1310 |         {isProfileOpen && (
1311 |           <motion.div
1312 |             initial={{ opacity: 0 }}
1313 |             animate={{ opacity: 1 }}
1314 |             exit={{ opacity: 0 }}
1315 |             className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-6 select-none"
1316 |           >
1317 |             <motion.div
1318 |               initial={{ scale: 0.95 }}
1319 |               animate={{ scale: 1 }}
1320 |               exit={{ scale: 0.95 }}
1321 |               className="w-full max-w-sm bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl p-6 relative shadow-2xl"
1322 |             >
1323 |               <button onClick={() => setIsProfileOpen(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white cursor-pointer">
1324 |                 <X className="w-5 h-5" />
1325 |               </button>
1326 |               <div className="flex flex-col items-center text-center space-y-4 py-4">
1327 |                 <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#1f1f1f] flex items-center justify-center bg-neutral-900">
1328 |                   <User className="w-8 h-8 text-neutral-500" />
1329 |                 </div>
1330 |                 <div>
1331 |                   <h3 className="text-sm font-bold text-white uppercase tracking-wider">User Profile</h3>
1332 |                   <span className="text-xs text-neutral-400 font-mono">solospace_user@gmail.com</span>
1333 |                 </div>
1334 |                 <div className="w-full pt-4 space-y-2 border-t border-[#141414]">
1335 |                   <div className="flex justify-between items-center bg-black py-2 px-3 rounded text-[10px] border border-[#141414] font-mono">
1336 |                     <span className="text-neutral-500">Plan:</span>
1337 |                     <span className="text-white font-bold">Pro</span>
1338 |                   </div>
1339 |                   <div className="flex justify-between items-center bg-black py-2 px-3 rounded text-[10px] border border-[#141414] font-mono">
1340 |                     <span className="text-neutral-500">Sessions:</span>
1341 |                     <span className="text-white font-bold">{Object.values(sessions).length}</span>
1342 |                   </div>
1343 |                 </div>
1344 |                 <button
1345 |                   onClick={() => setIsProfileOpen(false)}
1346 |                   className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-[#1f1f1f] text-neutral-300 hover:text-white font-bold rounded-xl text-xs font-mono transition-colors cursor-pointer"
1347 |                 >
1348 |                   Close
1349 |                 </button>
1350 |               </div>
1351 |             </motion.div>
1352 |           </motion.div>
1353 |         )}
1354 | 
1355 |         {/* TOOL APPROVAL TOAST */}
1356 |         {pendingApproval && (
1357 |           <div className="fixed bottom-6 right-6 w-96 bg-[#0d0d0d] border border-amber-500/50 shadow-[0_0_50px_rgba(245,158,11,0.15)] rounded-2xl p-5 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 select-none">
1358 |             <div className="flex gap-4 items-start">
1359 |               <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 shrink-0">
1360 |                 <Sliders className="w-5 h-5 animate-pulse" />
1361 |               </div>
1362 |               <div className="flex-1 space-y-2">
1363 |                 <div className="flex justify-between items-center">
1364 |                   <span className="text-[10px] font-bold text-amber-500 font-mono tracking-widest uppercase">Permission Required</span>
1365 |                   <span className="text-[9px] text-neutral-500 font-mono">Agent Tool</span>
1366 |                 </div>
1367 |                 <h4 className="text-xs font-bold text-white">
1368 |                   &apos;{(nodes.find(n => n.id === pendingApproval.nodeId)?.data as any)?.name}&apos; wants to use <span className="text-amber-400 font-mono">[{pendingApproval.toolName}]</span>
1369 |                 </h4>
1370 |                 <p className="text-[10px] text-neutral-400 leading-normal">
1371 |                   Action: <span className="text-white font-semibold">{pendingApproval.action}</span> — {pendingApproval.detail}
1372 |                 </p>
1373 |                 <div className="pt-3 flex gap-2">
1374 |                   <button
1375 |                     onClick={() => {
1376 |                       const sessId = pendingApproval.sessionId || activeSessionId || "";
1377 |                       fetch("/api/gemini/approve", {
1378 |                         method: "POST",
1379 |                         headers: { "Content-Type": "application/json" },
1380 |                         body: JSON.stringify({
1381 |                           sessionId: sessId,
1382 |                           nodeId: pendingApproval.nodeId,
1383 |                           toolName: pendingApproval.toolName,
1384 |                           action: "approve"
1385 |                         })
1386 |                       }).catch(e => console.error("Failed to approve tool:", e));
1387 | 
1388 |                       const node = nodes.find(n => n.id === pendingApproval.nodeId);
1389 |                       if (node) {
1390 |                         const updatedLogs = ((node.data as any).toolLogs || []).map((log: any) => {
1391 |                           if (log.id === pendingApproval.logId) {
1392 |                             return { ...log, status: "SUCCESS" as const, detail: `Approved: ${pendingApproval.detail}` };
1393 |                           }
1394 |                           return log;
1395 |                         });
1396 |                         updateNodeField(pendingApproval.nodeId, { toolLogs: updatedLogs });
1397 |                       }
1398 |                       useWorkflowStore.setState({ pendingApproval: null });
1399 |                     }}
1400 |                     className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-lg text-[10px] font-mono transition-colors cursor-pointer"
1401 |                   >
1402 |                     Approve
1403 |                   </button>
1404 |                   <button
1405 |                     onClick={() => {
1406 |                       const sessId = pendingApproval.sessionId || activeSessionId || "";
1407 |                       fetch("/api/gemini/approve", {
1408 |                         method: "POST",
1409 |                         headers: { "Content-Type": "application/json" },
1410 |                         body: JSON.stringify({
1411 |                           sessionId: sessId,
1412 |                           nodeId: pendingApproval.nodeId,
1413 |                           toolName: pendingApproval.toolName,
1414 |                           action: "deny"
1415 |                         })
1416 |                       }).catch(e => console.error("Failed to deny tool:", e));
1417 | 
1418 |                       const node = nodes.find(n => n.id === pendingApproval.nodeId);
1419 |                       if (node) {
1420 |                         const updatedLogs = ((node.data as any).toolLogs || []).map((log: any) => {
1421 |                           if (log.id === pendingApproval.logId) {
1422 |                             return { ...log, status: "BLOCKED" as const, detail: `Denied: ${pendingApproval.detail}` };
1423 |                           }
1424 |                           return log;
1425 |                         });
1426 |                         updateNodeField(pendingApproval.nodeId, { toolLogs: updatedLogs });
1427 |                       }
1428 |                       useWorkflowStore.setState({ pendingApproval: null });
1429 |                     }}
1430 |                     className="px-4 py-2 border border-[#1f1f1f] text-neutral-400 hover:text-white rounded-lg text-[10px] font-mono transition-colors cursor-pointer"
1431 |                   >
1432 |                     Deny
1433 |                   </button>
1434 |                 </div>
1435 |               </div>
1436 |             </div>
1437 |           </div>
1438 |         )}
1439 | 
1440 |       </AnimatePresence>
1441 |     </div>
1442 |   );
1443 | }
1444 |
```

### File: `Frontend/components/edges/CustomEdge.tsx`

> 103 lines | 2.7 KB

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
 16 | }: EdgeProps) => {
 17 |   const [isHovered, setIsHovered] = useState(false);
 18 |   const deleteEdge = useWorkflowStore((s) => s.deleteEdge);
 19 | 
 20 |   const [edgePath, labelX, labelY] = getBezierPath({
 21 |     sourceX,
 22 |     sourceY,
 23 |     sourcePosition,
 24 |     targetX,
 25 |     targetY,
 26 |     targetPosition,
 27 |   });
 28 | 
 29 |   const strokeColor = style.stroke || '#06b6d4'; // default cyan neon
 30 | 
 31 |   return (
 32 |     <g 
 33 |       onMouseEnter={() => setIsHovered(true)} 
 34 |       onMouseLeave={() => setIsHovered(false)}
 35 |       className="group"
 36 |     >
 37 |       {/* Background thicker glow path */}
 38 |       <path
 39 |         id={`${id}-glow`}
 40 |         className="react-flow__edge-path-glow"
 41 |         d={edgePath}
 42 |         fill="none"
 43 |         stroke={strokeColor}
 44 |         strokeWidth={6}
 45 |         strokeOpacity={isHovered ? 0.35 : 0.15}
 46 |         style={{
 47 |           transition: 'stroke-width 0.2s, stroke-opacity 0.2s',
 48 |           filter: `drop-shadow(0 0 4px ${strokeColor})`,
 49 |         }}
 50 |       />
 51 | 
 52 |       {/* Main Core Path */}
 53 |       <path
 54 |         id={id}
 55 |         className="react-flow__edge-path connection-line"
 56 |         d={edgePath}
 57 |         fill="none"
 58 |         stroke={strokeColor}
 59 |         strokeWidth={isHovered ? 2.5 : 1.5}
 60 |         markerEnd={markerEnd}
 61 |         style={{
 62 |           transition: 'stroke-width 0.2s',
 63 |           ...style,
 64 |         }}
 65 |       />
 66 | 
 67 |       {/* Invisible thicker interaction path for easier hovering */}
 68 |       <path
 69 |         d={edgePath}
 70 |         fill="none"
 71 |         stroke="transparent"
 72 |         strokeWidth={15}
 73 |         className="cursor-pointer"
 74 |       />
 75 | 
 76 |       {/* Delete Button Label overlay */}
 77 |       {isHovered && (
 78 |         <EdgeLabelRenderer>
 79 |           <div
 80 |             style={{
 81 |               position: 'absolute',
 82 |               transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
 83 |               pointerEvents: 'all',
 84 |             }}
 85 |             className="nodrag nopan z-40"
 86 |           >
 87 |             <button
 88 |               onClick={(e) => {
 89 |                 e.stopPropagation();
 90 |                 deleteEdge(id);
 91 |               }}
 92 |               className="w-5 h-5 rounded-full bg-[#0d0d0d] border border-[#1f1f1f] text-neutral-400 hover:text-red-400 flex items-center justify-center shadow-lg transition-all hover:scale-115 active:scale-95 cursor-pointer"
 93 |               title="Delete connection"
 94 |             >
 95 |               <X className="w-3 h-3 stroke-[2.5]" />
 96 |             </button>
 97 |           </div>
 98 |         </EdgeLabelRenderer>
 99 |       )}
100 |     </g>
101 |   );
102 | };
103 |
```

### File: `Frontend/components/nodes/CustomNode.tsx`

> 168 lines | 6.1 KB

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
 65 | 
 66 |   return (
 67 |     <div
 68 |       onMouseEnter={() => setIsHovered(true)}
 69 |       onMouseLeave={() => setIsHovered(false)}
 70 |       onDragOver={handleDragOver}
 71 |       onDrop={handleDropTool}
 72 |       onClick={() => {
 73 |         setSelectedNodeId(id);
 74 |       }}
 75 |       className={`relative w-60 glass-panel rounded-xl p-4 cursor-grab active:cursor-grabbing select-none transition-all duration-150 ${
 76 |         selected ? 'ring-1 ring-white border-white scale-[1.01] bg-[#0c0c0c]/90 shadow-2xl' : ''
 77 |       } ${
 78 |         droppedPulse ? 'ring-2 ring-emerald-500 border-emerald-500 scale-105' : ''
 79 |       } ${
 80 |         isActive ? 'node-active-pulse' : ''
 81 |       } ${
 82 |         !isNodeEnabled ? 'opacity-35 grayscale border-dashed border-neutral-800 bg-[#050505]' : ''
 83 |       }`}
 84 |     >
 85 |       {/* Floating Hover Controls Panel */}
 86 |       {isHovered && (
 87 |         <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center bg-[#0d0d0d] border border-[#1f1f1f] p-1 rounded-lg gap-1 shadow-lg pointer-events-auto z-30 animate-in fade-in zoom-in-95 duration-150">
 88 |           <button 
 89 |             onClick={(e) => {
 90 |               e.stopPropagation();
 91 |               setSelectedNodeId(id);
 92 |             }}
 93 |             className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white cursor-pointer"
 94 |             title="Edit Configuration"
 95 |           >
 96 |             <Edit className="w-3.5 h-3.5" />
 97 |           </button>
 98 |           <button 
 99 |             onClick={handleFocus}
100 |             className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white cursor-pointer"
101 |             title="Select Node"
102 |           >
103 |             <Maximize className="w-3.5 h-3.5" />
104 |           </button>
105 |           <button 
106 |             onClick={(e) => {
107 |               e.stopPropagation();
108 |               deleteNode(id);
109 |             }}
110 |             className="p-1 hover:bg-red-950 hover:text-red-400 rounded text-neutral-400 cursor-pointer"
111 |             title="Delete Agent"
112 |           >
113 |             <Trash2 className="w-3.5 h-3.5" />
114 |           </button>
115 |         </div>
116 |       )}
117 | 
118 |       {/* Target Handle (Left input port) */}
119 |       <Handle
120 |         type="target"
121 |         position={Position.Left}
122 |         id="input"
123 |         className="!w-2.5 !h-2.5 !bg-black !border-2 !border-rose-500 !shadow-[0_0_8px_#f43f5e] !transition-all hover:!scale-125"
124 |         style={{ top: '24px', left: '-5px' }}
125 |       />
126 | 
127 |       {/* Source Handle (Right output port) */}
128 |       <Handle
129 |         type="source"
130 |         position={Position.Right}
131 |         id="output"
132 |         className="!w-2.5 !h-2.5 !bg-black !border-2 !border-emerald-500 !shadow-[0_0_8px_#10b981] !transition-all hover:!scale-125"
133 |         style={{ top: '24px', right: '-5px' }}
134 |       />
135 | 
136 |       {/* Node Header */}
137 |       <div className="flex items-center gap-2.5 mb-2.5">
138 |         <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center border border-[#1f1f1f] shrink-0">
139 |           {renderIcon(data.icon)}
140 |         </div>
141 |         <div className="min-w-0">
142 |           <h4 className="text-xs font-bold text-white tracking-tight truncate">{data.name}</h4>
143 |           <span className="text-[8px] font-mono text-neutral-500 uppercase tracking-wider block leading-none mt-0.5">{data.tag || 'AGENT_NODE'}</span>
144 |         </div>
145 |       </div>
146 | 
147 |       {/* Description / Objective */}
148 |       <p className="text-[10px] text-neutral-400 line-clamp-2 leading-relaxed">{data.objective}</p>
149 | 
150 |       {/* Bulleted Instruction Rules (Antigravity Rules Style) */}
151 |       {data.rules && data.rules.length > 0 && (
152 |         <ul className="mt-3 pt-2.5 border-t border-[#141414] space-y-1 list-disc list-inside text-[9px] text-neutral-400 font-sans leading-normal">
153 |           {data.rules.slice(0, 3).map((rule, idx) => (
154 |             <li key={idx} className="truncate text-neutral-400/90 pl-0.5" title={rule}>
155 |               {rule}
156 |             </li>
157 |           ))}
158 |           {data.rules.length > 3 && (
159 |             <li className="list-none text-neutral-600 text-[8px] italic pl-2 mt-0.5">
160 |               + {data.rules.length - 3} more constraints
161 |             </li>
162 |           )}
163 |         </ul>
164 |       )}
165 |     </div>
166 |   );
167 | };
168 |
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

> 225 lines | 6.9 KB

```tsx
  1 | import React, { useState, useCallback } from 'react';
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
 15 | import { Plus, Minus, Maximize, PlusCircle } from 'lucide-react';
 16 | import { useWorkflowStore, CanvasNodeData } from '@/store/workflowStore';
 17 | import { CustomNode } from './nodes/CustomNode';
 18 | import { GroupNode } from './nodes/GroupNode';
 19 | import { CustomEdge } from './edges/CustomEdge';
 20 | import { ContextMenu } from './ContextMenu';
 21 | 
 22 | const nodeTypes = {
 23 |   custom: CustomNode,
 24 |   groupNode: GroupNode,
 25 | };
 26 | 
 27 | const edgeTypes = {
 28 |   custom: CustomEdge,
 29 | };
 30 | 
 31 | export default function FlowArena() {
 32 |   const { zoomIn, zoomOut, setViewport, getViewport } = useReactFlow();
 33 |   
 34 |   const nodes = useWorkflowStore((s) => s.nodes);
 35 |   const edges = useWorkflowStore((s) => s.edges);
 36 |   const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
 37 |   const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
 38 |   const onConnect = useWorkflowStore((s) => s.onConnect);
 39 |   const setEdges = useWorkflowStore((s) => s.setEdges);
 40 |   const addNode = useWorkflowStore((s) => s.addNode);
 41 |   const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
 42 | 
 43 |   // Context Menu State
 44 |   const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: Node | null } | null>(null);
 45 | 
 46 |   // Reconnection state
 47 |   const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
 48 |     setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));
 49 |   }, [setEdges]);
 50 | 
 51 |   // Context Menu triggers
 52 |   const onNodeContextMenu = useCallback((event: any, node: Node) => {
 53 |     event.preventDefault();
 54 |     setContextMenu({
 55 |       x: event.clientX,
 56 |       y: event.clientY,
 57 |       node,
 58 |     });
 59 |   }, []);
 60 | 
 61 |   const onPaneContextMenu = useCallback((event: any) => {
 62 |     event.preventDefault();
 63 |     setContextMenu({
 64 |       x: event.clientX,
 65 |       y: event.clientY,
 66 |       node: null,
 67 |     });
 68 |   }, []);
 69 | 
 70 |   const onPaneClick = useCallback(() => {
 71 |     setContextMenu(null);
 72 |   }, []);
 73 | 
 74 |   // Zoom/Viewport Controls
 75 |   const handleZoomIn = () => {
 76 |     zoomIn({ duration: 300 });
 77 |   };
 78 | 
 79 |   const handleZoomOut = () => {
 80 |     zoomOut({ duration: 300 });
 81 |   };
 82 | 
 83 |   const handleResetView = () => {
 84 |     setViewport({ x: 100, y: 50, zoom: 0.9 }, { duration: 400 });
 85 |   };
 86 | 
 87 |   const handleAddAgentNode = () => {
 88 |     const randomId = `custom_agent_${Date.now().toString().slice(-4)}`;
 89 |     const view = getViewport();
 90 |     // Center new node inside view coordinates
 91 |     const x = (-view.x + window.innerWidth / 2 - 120) / view.zoom;
 92 |     const y = (-view.y + window.innerHeight / 2 - 100) / view.zoom;
 93 | 
 94 |     const newNode = {
 95 |       id: randomId,
 96 |       type: 'custom',
 97 |       position: { x: Math.max(50, x), y: Math.max(50, y) },
 98 |       data: {
 99 |         name: "Custom Agent Node",
100 |         tag: "USER_CUSTOM_NODE",
101 |         status: "IDLE" as const,
102 |         metricLabel: "Tasks Completed",
103 |         metricVal: "0",
104 |         icon: "science",
105 |         objective: "Enter agent goals...",
106 |         personality: "Pragmatic, logical, responsive",
107 |         systemPrompt: "You are a custom assistant. Fulfill user demands precisely.",
108 |         rules: ["Verify actions before launching"],
109 |         tools: ["Web Search"],
110 |         temp: 0.5,
111 |         logic: 80,
112 |         empathy: 50,
113 |         context: "128k",
114 |         enabled: true,
115 |         priority: 5,
116 |         toolPermissions: {
117 |           "Web Search": "ALLOWED" as const
118 |         },
119 |         toolLogs: []
120 |       }
121 |     };
122 |     addNode(newNode);
123 |     setSelectedNodeId(newNode.id);
124 |   };
125 | 
126 |   // Node styles for MiniMap representation
127 |   const getMiniMapNodeColor = (node: Node) => {
128 |     if (node.type === 'groupNode') return 'rgba(255, 255, 255, 0.03)';
129 |     const data = node.data as CanvasNodeData;
130 |     if (data && data.enabled === false) return '#262626';
131 |     if (data && (data.status === 'ACTIVE' || data.status === 'PROCESSING')) return '#06b6d4';
132 |     return '#404040';
133 |   };
134 | 
135 |   return (
136 |     <div className="w-full h-full flex-1 relative bg-black">
137 |       <ReactFlow
138 |         nodes={nodes}
139 |         edges={edges}
140 |         onNodesChange={onNodesChange}
141 |         onEdgesChange={onEdgesChange}
142 |         onConnect={onConnect}
143 |         onReconnect={onReconnect}
144 |         nodeTypes={nodeTypes}
145 |         edgeTypes={edgeTypes}
146 |         onNodeContextMenu={onNodeContextMenu}
147 |         onPaneContextMenu={onPaneContextMenu}
148 |         onPaneClick={onPaneClick}
149 |         snapToGrid={true}
150 |         snapGrid={[15, 15]}
151 |         fitViewOptions={{ padding: 0.2 }}
152 |         className="flow-arena-editor"
153 |         minZoom={0.2}
154 |         maxZoom={2.5}
155 |         defaultViewport={{ x: 100, y: 50, zoom: 0.9 }}
156 |       >
157 |         {/* Subtle grid background dots */}
158 |         <Background 
159 |           variant={BackgroundVariant.Dots} 
160 |           color="rgba(255, 255, 255, 0.06)" 
161 |           gap={24} 
162 |           size={1}
163 |         />
164 | 
165 |         {/* Custom Minimap Overlay */}
166 |         <MiniMap 
167 |           zoomable 
168 |           pannable 
169 |           nodeColor={getMiniMapNodeColor}
170 |           nodeStrokeWidth={3}
171 |           nodeBorderRadius={8}
172 |           maskColor="rgba(0, 0, 0, 0.65)"
173 |           className="!right-4 !top-4"
174 |         />
175 | 
176 |         {/* Custom Floating Zoom & Node controls */}
177 |         <Panel position="bottom-left" className="!left-4 !bottom-14 flex items-center bg-[#0d0d0d] border border-[#1f1f1f] p-1 rounded-xl z-20 shadow-2xl">
178 |           <button 
179 |             onClick={handleZoomIn}
180 |             className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors cursor-pointer"
181 |             title="Zoom In"
182 |           >
183 |             <Plus className="w-3.5 h-3.5" />
184 |           </button>
185 | 
186 |           <button 
187 |             onClick={handleZoomOut}
188 |             className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors cursor-pointer"
189 |             title="Zoom Out"
190 |           >
191 |             <Minus className="w-3.5 h-3.5" />
192 |           </button>
193 | 
194 |           <button 
195 |             onClick={handleResetView}
196 |             className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors border-l border-[#1f1f1f] ml-1 cursor-pointer"
197 |             title="Reset Viewport"
198 |           >
199 |             <Maximize className="w-3.5 h-3.5" />
200 |           </button>
201 | 
202 |           <button 
203 |             onClick={handleAddAgentNode}
204 |             className="p-2 text-white hover:bg-neutral-900 rounded-lg transition-colors border-l border-[#1f1f1f] ml-1 flex items-center gap-1 text-[10px] cursor-pointer"
205 |             title="Add Custom Agent Node"
206 |           >
207 |             <PlusCircle className="w-3.5 h-3.5 text-white" />
208 |             <span className="font-semibold pr-1">Node</span>
209 |           </button>
210 |         </Panel>
211 | 
212 |         {/* Right-click Context Menu */}
213 |         {contextMenu && (
214 |           <ContextMenu
215 |             x={contextMenu.x}
216 |             y={contextMenu.y}
217 |             node={contextMenu.node}
218 |             onClose={() => setContextMenu(null)}
219 |           />
220 |         )}
221 |       </ReactFlow>
222 |     </div>
223 |   );
224 | }
225 |
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

> 871 lines | 26.5 KB

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
 26 |   status: 'IDLE' | 'ACTIVE' | 'SCANNING WEB' | 'AUDITING' | 'QUEUED' | 'WAITING' | 'PROCESSING' | 'STANDBY' | 'DISABLED';
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
140 | export const useWorkflowStore = create<WorkflowState>((set, get) => ({
141 |   sessions: {},
142 |   activeSessionId: null,
143 |   nodes: [],
144 |   edges: [],
145 |   selectedNodeId: null,
146 |   executionState: 'setup',
147 |   isOrchestrating: false,
148 |   isThinking: false,
149 |   statusMessage: '',
150 |   chatMessages: [],
151 |   agentTalkLogs: [],
152 |   pendingApproval: null,
153 |   apiKey: null,
154 |   setApiKey: (key) => set({ apiKey: key }),
155 |   followUpSuggestions: [],
156 |   liveThoughts: '',
157 |   abortController: null,
158 |   cancelOrchestration: () => {
159 |     const controller = get().abortController;
160 |     if (controller) {
161 |       controller.abort();
162 |       set({ abortController: null, isOrchestrating: false, isThinking: false });
163 |     }
164 |   },
165 | 
166 |   setNodes: (newNodes) => {
167 |     set((state) => ({
168 |       nodes: typeof newNodes === 'function' ? newNodes(state.nodes) : newNodes
169 |     }));
170 |     get().saveCurrentSession();
171 |   },
172 | 
173 |   setEdges: (newEdges) => {
174 |     set((state) => ({
175 |       edges: typeof newEdges === 'function' ? newEdges(state.edges) : newEdges
176 |     }));
177 |     get().saveCurrentSession();
178 |   },
179 | 
180 |   onNodesChange: (changes) => {
181 |     set((state) => ({
182 |       nodes: applyNodeChanges(changes, state.nodes)
183 |     }));
184 |     get().saveCurrentSession();
185 |   },
186 | 
187 |   onEdgesChange: (changes) => {
188 |     set((state) => ({
189 |       edges: applyEdgeChanges(changes, state.edges)
190 |     }));
191 |     get().saveCurrentSession();
192 |   },
193 | 
194 |   onConnect: (connection) => {
195 |     set((state) => {
196 |       const edge: Edge = {
197 |         ...connection,
198 |         id: `e-${connection.source}-${connection.target}`,
199 |         animated: true,
200 |         type: 'custom',
201 |         style: { stroke: '#06b6d4', strokeWidth: 2 }
202 |       };
203 |       return { edges: addEdge(edge, state.edges) };
204 |     });
205 |     get().saveCurrentSession();
206 |   },
207 | 
208 |   setSelectedNodeId: (id) => set({ selectedNodeId: id }),
209 | 
210 |   updateNodeField: (nodeId, updates) => {
211 |     set((state) => ({
212 |       nodes: state.nodes.map((node) => {
213 |         if (node.id === nodeId) {
214 |           return { ...node, data: { ...node.data, ...updates } };
215 |         }
216 |         return node;
217 |       })
218 |     }));
219 |     get().saveCurrentSession();
220 |   },
221 | 
222 |   addNode: (node) => {
223 |     set((state) => ({ nodes: [...state.nodes, node] }));
224 |     get().saveCurrentSession();
225 |   },
226 | 
227 |   deleteNode: (nodeId) => {
228 |     set((state) => ({
229 |       nodes: state.nodes.filter((node) => node.id !== nodeId),
230 |       edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
231 |       selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId
232 |     }));
233 |     get().saveCurrentSession();
234 |   },
235 | 
236 |   deleteEdge: (edgeId) => {
237 |     set((state) => ({
238 |       edges: state.edges.filter((edge) => edge.id !== edgeId)
239 |     }));
240 |     get().saveCurrentSession();
241 |   },
242 | 
243 |   addRule: (nodeId, rule) => {
244 |     set((state) => ({
245 |       nodes: state.nodes.map((node) => {
246 |         if (node.id === nodeId) {
247 |           return {
248 |             ...node,
249 |             data: { ...node.data, rules: [...((node.data as any).rules || []), rule] }
250 |           };
251 |         }
252 |         return node;
253 |       })
254 |     }));
255 |     get().saveCurrentSession();
256 |   },
257 | 
258 |   deleteRule: (nodeId, ruleIndex) => {
259 |     set((state) => ({
260 |       nodes: state.nodes.map((node) => {
261 |         if (node.id === nodeId) {
262 |           return {
263 |             ...node,
264 |             data: {
265 |               ...node.data,
266 |               rules: ((node.data as any).rules || []).filter((_: any, idx: number) => idx !== ruleIndex)
267 |             }
268 |           };
269 |         }
270 |         return node;
271 |       })
272 |     }));
273 |     get().saveCurrentSession();
274 |   },
275 | 
276 |   // (simulateToolExecution removed — backend runs real tools)
277 | 
278 |   // State modifiers
279 |   setExecutionState: (state) => {
280 |     set({ executionState: state });
281 |     get().saveCurrentSession();
282 |   },
283 |   setIsOrchestrating: (val) => set({ isOrchestrating: val }),
284 |   setIsThinking: (val) => set({ isThinking: val }),
285 |   setStatusMessage: (msg) => {
286 |     set({ statusMessage: msg });
287 |     get().saveCurrentSession();
288 |   },
289 |   setChatMessages: (msgs) => {
290 |     set((state) => ({
291 |       chatMessages: typeof msgs === 'function' ? msgs(state.chatMessages) : msgs
292 |     }));
293 |     get().saveCurrentSession();
294 |   },
295 |   setAgentTalkLogs: (logs) => {
296 |     set((state) => ({
297 |       agentTalkLogs: typeof logs === 'function' ? logs(state.agentTalkLogs) : logs
298 |     }));
299 |     get().saveCurrentSession();
300 |   },
301 |   setPendingApproval: (val) => set({ pendingApproval: val }),
302 | 
303 |   // Session Actions
304 |   createSession: (prompt, mode) => {
305 |     const sessionId = Date.now().toString();
306 |     const newSession: ChatSession = {
307 |       id: sessionId,
308 |       title: prompt.length > 40 ? prompt.substring(0, 40) + "..." : prompt,
309 |       prompt: prompt,
310 |       mode: mode,
311 |       nodes: [],
312 |       edges: [],
313 |       chatMessages: [],
314 |       agentTalkLogs: [],
315 |       executionState: "setup",
316 |       statusMessage: "",
317 |       followUpSuggestions: []
318 |     };
319 | 
320 |     set((state) => ({
321 |       sessions: { ...state.sessions, [sessionId]: newSession },
322 |       activeSessionId: sessionId,
323 |       nodes: [],
324 |       edges: [],
325 |       chatMessages: [],
326 |       agentTalkLogs: [],
327 |       executionState: "setup",
328 |       statusMessage: "",
329 |       followUpSuggestions: []
330 |     }));
331 | 
332 |     return sessionId;
333 |   },
334 | 
335 |   switchSession: (sessionId) => {
336 |     const currentSessionId = get().activeSessionId;
337 |     if (currentSessionId) {
338 |       const currentSession: ChatSession = {
339 |         id: currentSessionId,
340 |         title: get().sessions[currentSessionId]?.title || "Chat",
341 |         prompt: get().sessions[currentSessionId]?.prompt || "",
342 |         mode: get().sessions[currentSessionId]?.mode || "auto",
343 |         nodes: get().nodes,
344 |         edges: get().edges,
345 |         chatMessages: get().chatMessages,
346 |         agentTalkLogs: get().agentTalkLogs,
347 |         executionState: get().executionState,
348 |         statusMessage: get().statusMessage,
349 |         followUpSuggestions: get().followUpSuggestions
350 |       };
351 |       set((state) => ({
352 |         sessions: { ...state.sessions, [currentSessionId]: currentSession }
353 |       }));
354 |     }
355 | 
356 |     const newSession = get().sessions[sessionId];
357 |     if (newSession) {
358 |       set({
359 |         activeSessionId: sessionId,
360 |         nodes: newSession.nodes,
361 |         edges: newSession.edges,
362 |         chatMessages: newSession.chatMessages,
363 |         agentTalkLogs: newSession.agentTalkLogs,
364 |         executionState: newSession.executionState,
365 |         statusMessage: newSession.statusMessage,
366 |         followUpSuggestions: newSession.followUpSuggestions || [],
367 |         selectedNodeId: null
368 |       });
369 |     }
370 |   },
371 | 
372 |   saveCurrentSession: () => {
373 |     const currentSessionId = get().activeSessionId;
374 |     if (!currentSessionId) return;
375 | 
376 |     set((state) => {
377 |       const currentSession: ChatSession = {
378 |         id: currentSessionId,
379 |         title: state.sessions[currentSessionId]?.title || "Chat",
380 |         prompt: state.sessions[currentSessionId]?.prompt || "",
381 |         mode: state.sessions[currentSessionId]?.mode || "auto",
382 |         nodes: state.nodes,
383 |         edges: state.edges,
384 |         chatMessages: state.chatMessages,
385 |         agentTalkLogs: state.agentTalkLogs,
386 |         executionState: state.executionState,
387 |         statusMessage: state.statusMessage,
388 |         followUpSuggestions: state.followUpSuggestions
389 |       };
390 |       return { sessions: { ...state.sessions, [currentSessionId]: currentSession } };
391 |     });
392 |   },
393 | 
394 |   fetchSessions: async () => {
395 |     try {
396 |       const response = await fetch("/api/gemini/sessions");
397 |       if (response.ok) {
398 |         const list = await response.json();
399 |         const updatedSessions: Record<string, ChatSession> = { ...get().sessions };
400 |         for (const s of list) {
401 |           if (!updatedSessions[s.session_id]) {
402 |             updatedSessions[s.session_id] = {
403 |               id: s.session_id,
404 |               title: s.title,
405 |               prompt: s.prompt,
406 |               mode: s.mode,
407 |               nodes: [],
408 |               edges: [],
409 |               chatMessages: [],
410 |               agentTalkLogs: [],
411 |               executionState: s.execution_state,
412 |               statusMessage: s.status_message,
413 |               followUpSuggestions: []
414 |             };
415 |           }
416 |         }
417 |         set({ sessions: updatedSessions });
418 |       }
419 |     } catch (e) {
420 |       console.error("Failed to fetch sessions from DB", e);
421 |     }
422 |   },
423 | 
424 |   loadSessionFromDb: async (sessionId: string) => {
425 |     try {
426 |       const response = await fetch(`/api/gemini/sessions?id=${sessionId}`);
427 |       if (response.ok) {
428 |         const fullSession = await response.json();
429 |         const session: ChatSession = {
430 |           id: fullSession.session_id,
431 |           title: fullSession.title,
432 |           prompt: fullSession.prompt,
433 |           mode: fullSession.mode,
434 |           nodes: fullSession.nodes,
435 |           edges: fullSession.edges,
436 |           chatMessages: fullSession.chat_messages,
437 |           agentTalkLogs: fullSession.agent_talk_logs,
438 |           executionState: fullSession.execution_state,
439 |           statusMessage: fullSession.status_message,
440 |           followUpSuggestions: fullSession.follow_up_suggestions
441 |         };
442 |         
443 |         set((state) => ({
444 |           sessions: { ...state.sessions, [sessionId]: session },
445 |           activeSessionId: sessionId,
446 |           nodes: session.nodes,
447 |           edges: session.edges,
448 |           chatMessages: session.chatMessages,
449 |           agentTalkLogs: session.agentTalkLogs,
450 |           executionState: session.executionState,
451 |           statusMessage: session.statusMessage,
452 |           followUpSuggestions: session.followUpSuggestions || [],
453 |           selectedNodeId: null
454 |         }));
455 |       }
456 |     } catch (e) {
457 |       console.error("Failed to load session from DB", e);
458 |     }
459 |   },
460 | 
461 |   deleteSessionFromDb: async (sessionId: string) => {
462 |     try {
463 |       const response = await fetch(`/api/gemini/sessions?id=${sessionId}`, {
464 |         method: "DELETE"
465 |       });
466 |       if (response.ok) {
467 |         set((state) => {
468 |           const updated = { ...state.sessions };
469 |           delete updated[sessionId];
470 |           const newActiveId = state.activeSessionId === sessionId ? null : state.activeSessionId;
471 |           return {
472 |             sessions: updated,
473 |             activeSessionId: newActiveId,
474 |             ...(newActiveId ? {} : {
475 |               nodes: [],
476 |               edges: [],
477 |               chatMessages: [],
478 |               agentTalkLogs: [],
479 |               executionState: "setup",
480 |               statusMessage: "",
481 |               followUpSuggestions: []
482 |             })
483 |           };
484 |         });
485 |       }
486 |     } catch (e) {
487 |       console.error("Failed to delete session", e);
488 |     }
489 |   },
490 | 
491 |   triggerSteerOrchestration: async (promptText, execute = true) => {
492 |     if (!promptText.trim()) return;
493 | 
494 |     // Abort any active orchestration
495 |     const currentController = get().abortController;
496 |     if (currentController) {
497 |       currentController.abort();
498 |     }
499 | 
500 |     const controller = new AbortController();
501 | 
502 |     const userMsg: ChatMessage = {
503 |       id: Date.now().toString(),
504 |       sender: "user",
505 |       text: promptText,
506 |       timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
507 |     };
508 | 
509 |     set((state) => ({
510 |       chatMessages: [...state.chatMessages, userMsg],
511 |       isOrchestrating: true,
512 |       isThinking: true,
513 |       statusMessage: "",
514 |       liveThoughts: "",
515 |       agentTalkLogs: [],
516 |       followUpSuggestions: [],
517 |       abortController: controller
518 |     }));
519 |     get().saveCurrentSession();
520 | 
521 |     // Create target AI message placeholder
522 |     const aiMsgId = (Date.now() + 1).toString();
523 |     set((state) => ({
524 |       chatMessages: [
525 |         ...state.chatMessages,
526 |         {
527 |           id: aiMsgId,
528 |           sender: "ai",
529 |           text: "",
530 |           thinkingSummary: "",
531 |           timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
532 |         }
533 |       ]
534 |     }));
535 |     get().saveCurrentSession();
536 | 
537 |     try {
538 |       const response = await fetch("/api/gemini/orchestrate", {
539 |         method: "POST",
540 |         headers: { "Content-Type": "application/json" },
541 |         body: JSON.stringify({
542 |           prompt: promptText,
543 |           history: get().chatMessages
544 |             .filter(m => m.id !== aiMsgId) // Exclude current empty prompt placeholder
545 |             .map(m => ({ sender: m.sender, text: m.text })),
546 |           api_key: get().apiKey || "",
547 |           session_id: get().activeSessionId || "",
548 |           execute_agents: execute
549 |         }),
550 |         signal: controller.signal
551 |       });
552 | 
553 |       if (!response.ok) {
554 |         const errData = await response.json().catch(() => ({ detail: "Orchestration failed." }));
555 |         throw new Error(errData.detail || `Server status error: ${response.status}`);
556 |       }
557 | 
558 |       const reader = response.body?.getReader();
559 |       const decoder = new TextDecoder();
560 |       if (!reader) throw new Error("No response stream body reader.");
561 | 
562 |       let assistantResponse = "";
563 |       let thinkingSummary = "";
564 |       let buffer = "";
565 | 
566 |       while (true) {
567 |         const { done, value } = await reader.read();
568 |         if (done) break;
569 | 
570 |         buffer += decoder.decode(value, { stream: true });
571 |         
572 |         const parts = buffer.split("\n\n");
573 |         buffer = parts.pop() || "";
574 | 
575 |         for (const part of parts) {
576 |           if (!part.trim()) continue;
577 | 
578 |           const lines = part.split("\n");
579 |           let eventType = "text";
580 |           let dataContent = "";
581 | 
582 |           for (const line of lines) {
583 |             if (line.startsWith("event: ")) {
584 |               eventType = line.slice(7);
585 |             } else if (line.startsWith("data: ")) {
586 |               dataContent = line.slice(6);
587 |             }
588 |           }
589 | 
590 |           if (eventType === "text") {
591 |             try {
592 |               const textVal = JSON.parse(dataContent);
593 |               assistantResponse += textVal;
594 |               set((state) => ({
595 |                 isThinking: false, // Turn off thinking dots on first text token
596 |                 chatMessages: state.chatMessages.map(m =>
597 |                   m.id === aiMsgId ? { ...m, text: assistantResponse } : m
598 |                 )
599 |               }));
600 |             } catch (e) {
601 |               console.error("Text SSE parse error", e);
602 |             }
603 |           } else if (eventType === "thinking") {
604 |             try {
605 |               const thoughtVal = JSON.parse(dataContent);
606 |               thinkingSummary += thoughtVal;
607 |               set((state) => ({
608 |                 liveThoughts: thinkingSummary,
609 |                 chatMessages: state.chatMessages.map(m =>
610 |                   m.id === aiMsgId ? { ...m, thinkingSummary: thinkingSummary } : m
611 |                 )
612 |               }));
613 |             } catch (e) {
614 |               console.error("Thinking SSE parse error", e);
615 |             }
616 |           } else if (eventType === "status") {
617 |             try {
618 |               const statusVal = JSON.parse(dataContent);
619 |               set({ statusMessage: typeof statusVal === "string" ? statusVal : "" });
620 |             } catch (e) {
621 |               console.error("Status SSE parse error", e);
622 |             }
623 |           } else if (eventType === "metadata") {
624 |             try {
625 |               const meta = JSON.parse(dataContent);
626 |               set({
627 |                 nodes: meta.nodes || [],
628 |                 edges: meta.edges || [],
629 |                 agentTalkLogs: meta.agent_talk || []
630 |               });
631 |             } catch (e) {
632 |               console.error("Metadata SSE parse error", e);
633 |             }
634 |           } else if (eventType === "tool_approval") {
635 |             try {
636 |               const approval = JSON.parse(dataContent);
637 |               set({ pendingApproval: approval });
638 |             } catch (e) {
639 |               console.error("Tool approval SSE parse error", e);
640 |             }
641 |           }
642 |         }
643 |       }
644 | 
645 |       if (!assistantResponse) {
646 |         const fallbackMsg = "I'm sorry, I couldn't generate a response. This might be due to a temporary issue with the AI service or an invalid API key. Please check your API key in Settings and try again.";
647 |         set((state) => ({
648 |           chatMessages: state.chatMessages.map(m =>
649 |             m.id === aiMsgId ? { ...m, text: fallbackMsg } : m
650 |           )
651 |         }));
652 |       }
653 | 
654 |       set({ abortController: null });
655 |       get().saveCurrentSession();
656 |     } catch (err: any) {
657 |       if (err.name === 'AbortError') {
658 |         console.log("Steer Orchestration manually aborted.");
659 |         set((state) => ({
660 |           chatMessages: state.chatMessages.map(m =>
661 |             m.id === aiMsgId && !m.text ? { ...m, text: "*Generation stopped by user.*" } : m
662 |           )
663 |         }));
664 |       } else {
665 |         console.error("Steer Orchestration stream error:", err);
666 |         const errorMsg = `**Connection Error.**\n\n${err.message || "Failed to parse stream event source. Check backend logs."}`;
667 |         set((state) => ({
668 |           chatMessages: state.chatMessages.map(m =>
669 |             m.id === aiMsgId ? { ...m, text: errorMsg } : m
670 |           ),
671 |           nodes: [],
672 |           edges: [],
673 |           followUpSuggestions: []
674 |         }));
675 |       }
676 |       set({ abortController: null, isThinking: false, isOrchestrating: false });
677 |       get().saveCurrentSession();
678 |     } finally {
679 |       set({ isOrchestrating: false, isThinking: false, statusMessage: '', liveThoughts: '' });
680 |       get().saveCurrentSession();
681 |     }
682 |   },
683 | 
684 |   triggerCustomExecution: async () => {
685 |     const currentController = get().abortController;
686 |     if (currentController) {
687 |       currentController.abort();
688 |     }
689 | 
690 |     const controller = new AbortController();
691 | 
692 |     const sessionId = get().activeSessionId;
693 |     if (!sessionId) return;
694 | 
695 |     const prompt = get().chatMessages.findLast(m => m.sender === 'user')?.text || "";
696 | 
697 |     set((state) => ({
698 |       isOrchestrating: true,
699 |       isThinking: true,
700 |       statusMessage: "Running custom orchestration loop...",
701 |       liveThoughts: "",
702 |       agentTalkLogs: [],
703 |       followUpSuggestions: [],
704 |       abortController: controller
705 |     }));
706 |     get().saveCurrentSession();
707 | 
708 |     const aiMsgId = Date.now().toString();
709 |     set((state) => ({
710 |       chatMessages: [
711 |         ...state.chatMessages,
712 |         {
713 |           id: aiMsgId,
714 |           sender: "ai",
715 |           text: "",
716 |           thinkingSummary: "",
717 |           timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
718 |         }
719 |       ]
720 |     }));
721 |     get().saveCurrentSession();
722 | 
723 |     try {
724 |       const response = await fetch("/api/gemini/execute_custom", {
725 |         method: "POST",
726 |         headers: { "Content-Type": "application/json" },
727 |         body: JSON.stringify({
728 |           session_id: sessionId,
729 |           prompt: prompt,
730 |           history: get().chatMessages
731 |             .filter(m => m.id !== aiMsgId)
732 |             .map(m => ({ sender: m.sender, text: m.text })),
733 |           api_key: get().apiKey || "",
734 |           nodes: get().nodes,
735 |           edges: get().edges
736 |         }),
737 |         signal: controller.signal
738 |       });
739 | 
740 |       if (!response.ok) {
741 |         const errData = await response.json().catch(() => ({ detail: "Execution failed." }));
742 |         throw new Error(errData.detail || `Server status error: ${response.status}`);
743 |       }
744 | 
745 |       const reader = response.body?.getReader();
746 |       const decoder = new TextDecoder();
747 |       if (!reader) throw new Error("No response stream body reader.");
748 | 
749 |       let assistantResponse = "";
750 |       let thinkingSummary = "";
751 |       let buffer = "";
752 | 
753 |       while (true) {
754 |         const { done, value } = await reader.read();
755 |         if (done) break;
756 | 
757 |         buffer += decoder.decode(value, { stream: true });
758 |         
759 |         const parts = buffer.split("\n\n");
760 |         buffer = parts.pop() || "";
761 | 
762 |         for (const part of parts) {
763 |           if (!part.trim()) continue;
764 | 
765 |           const lines = part.split("\n");
766 |           let eventType = "text";
767 |           let dataContent = "";
768 | 
769 |           for (const line of lines) {
770 |             if (line.startsWith("event: ")) {
771 |               eventType = line.slice(7);
772 |             } else if (line.startsWith("data: ")) {
773 |               dataContent = line.slice(6);
774 |             }
775 |           }
776 | 
777 |           if (eventType === "text") {
778 |             try {
779 |               const textVal = JSON.parse(dataContent);
780 |               assistantResponse += textVal;
781 |               set((state) => ({
782 |                 isThinking: false,
783 |                 chatMessages: state.chatMessages.map(m =>
784 |                   m.id === aiMsgId ? { ...m, text: assistantResponse } : m
785 |                 )
786 |               }));
787 |             } catch (e) {
788 |               console.error("Text SSE parse error", e);
789 |             }
790 |           } else if (eventType === "thinking") {
791 |             try {
792 |               const thoughtVal = JSON.parse(dataContent);
793 |               thinkingSummary += thoughtVal;
794 |               set((state) => ({
795 |                 liveThoughts: thinkingSummary,
796 |                 chatMessages: state.chatMessages.map(m =>
797 |                   m.id === aiMsgId ? { ...m, thinkingSummary: thinkingSummary } : m
798 |                 )
799 |               }));
800 |             } catch (e) {
801 |               console.error("Thinking SSE parse error", e);
802 |             }
803 |           } else if (eventType === "status") {
804 |             try {
805 |               const statusVal = JSON.parse(dataContent);
806 |               set({ statusMessage: typeof statusVal === "string" ? statusVal : "" });
807 |             } catch (e) {
808 |               console.error("Status SSE parse error", e);
809 |             }
810 |           } else if (eventType === "metadata") {
811 |             try {
812 |               const meta = JSON.parse(dataContent);
813 |               set({
814 |                 nodes: meta.nodes || [],
815 |                 edges: meta.edges || [],
816 |                 agentTalkLogs: meta.agent_talk || []
817 |               });
818 |             } catch (e) {
819 |               console.error("Metadata SSE parse error", e);
820 |             }
821 |           } else if (eventType === "tool_approval") {
822 |             try {
823 |               const approval = JSON.parse(dataContent);
824 |               set({ pendingApproval: approval });
825 |             } catch (e) {
826 |               console.error("Tool approval SSE parse error", e);
827 |             }
828 |           }
829 |         }
830 |       }
831 | 
832 |       if (!assistantResponse) {
833 |         const fallbackMsg = "I'm sorry, I couldn't generate a response. This might be due to a temporary issue with the AI service or an invalid API key. Please check your API key in Settings and try again.";
834 |         set((state) => ({
835 |           chatMessages: state.chatMessages.map(m =>
836 |             m.id === aiMsgId ? { ...m, text: fallbackMsg } : m
837 |           )
838 |         }));
839 |       }
840 | 
841 |       set({ abortController: null });
842 |       get().saveCurrentSession();
843 |     } catch (err: any) {
844 |       if (err.name === 'AbortError') {
845 |         console.log("Steer Orchestration manually aborted.");
846 |         set((state) => ({
847 |           chatMessages: state.chatMessages.map(m =>
848 |             m.id === aiMsgId && !m.text ? { ...m, text: "*Generation stopped by user.*" } : m
849 |           )
850 |         }));
851 |       } else {
852 |         console.error("Steer Orchestration stream error:", err);
853 |         const errorMsg = `**Connection Error.**\n\n${err.message || "Failed to parse stream event source. Check backend logs."}`;
854 |         set((state) => ({
855 |           chatMessages: state.chatMessages.map(m =>
856 |             m.id === aiMsgId ? { ...m, text: errorMsg } : m
857 |           ),
858 |           nodes: [],
859 |           edges: [],
860 |           followUpSuggestions: []
861 |         }));
862 |       }
863 |       set({ abortController: null, isThinking: false, isOrchestrating: false });
864 |       get().saveCurrentSession();
865 |     } finally {
866 |       set({ isOrchestrating: false, isThinking: false, statusMessage: '', liveThoughts: '' });
867 |       get().saveCurrentSession();
868 |     }
869 |   }
870 | }));
871 |
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

> 46 lines | 1.2 KB

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
15 |     "@types/react-syntax-highlighter": "^15.5.13",
16 |     "@xyflow/react": "^12.10.2",
17 |     "autoprefixer": "^10.4.21",
18 |     "class-variance-authority": "^0.7.1",
19 |     "clsx": "^2.1.1",
20 |     "lucide-react": "^0.553.0",
21 |     "motion": "^12.23.24",
22 |     "next": "^15.4.9",
23 |     "postcss": "^8.5.6",
24 |     "react": "^19.2.1",
25 |     "react-dom": "^19.2.1",
26 |     "react-markdown": "^10.1.0",
27 |     "react-syntax-highlighter": "^16.1.1",
28 |     "remark-gfm": "^4.0.1",
29 |     "tailwind-merge": "^3.3.1",
30 |     "zustand": "^5.0.13"
31 |   },
32 |   "devDependencies": {
33 |     "@tailwindcss/postcss": "4.1.11",
34 |     "@tailwindcss/typography": "^0.5.19",
35 |     "@types/node": "^20",
36 |     "@types/react": "^19",
37 |     "@types/react-dom": "^19",
38 |     "eslint": "9.39.1",
39 |     "eslint-config-next": "15.4.9",
40 |     "firebase-tools": "^15.0.0",
41 |     "tailwindcss": "4.1.11",
42 |     "tw-animate-css": "^1.4.0",
43 |     "typescript": "5.9.3"
44 |   }
45 | }
46 |
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
