# Full Project Context

> Generated: 2026-05-28T18:17:27.781Z
> Mode: Full Project
> Files: 39
> Total Lines: 9,577
> Total Size: 381.4 KB
> Directories: 22

---

## 📁 Folder Structure

```
SoloSpace/
├── Backend/
│   ├── core/
│   │   └── echohouse.py
│   ├── agent_messages.py
│   ├── db.py
│   ├── main_old_utf8.py
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
│   │   │       ├── echohouse/
│   │   │       │   ├── init/
│   │   │       │   │   └── route.ts
│   │   │       │   └── simulate/
│   │   │       │       └── route.ts
│   │   │       ├── execute_custom/
│   │   │       │   └── route.ts
│   │   │       ├── models/
│   │   │       │   └── route.ts
│   │   │       ├── ollama/
│   │   │       │   └── route.ts
│   │   │       ├── orchestrate/
│   │   │       │   └── route.ts
│   │   │       ├── providers/
│   │   │       │   └── route.ts
│   │   │       └── sessions/
│   │   │           ├── [id]/
│   │   │           │   └── route.ts
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

### File: `Backend/core/echohouse.py`

> 139 lines | 5.7 KB

```python
  1 | import json
  2 | import asyncio
  3 | from typing import List, Dict, Any, Optional, AsyncGenerator
  4 | from providers import stream_provider
  5 | 
  6 | async def run_echohouse_simulation(
  7 |     session_id: str,
  8 |     problem_text: str,
  9 |     cast: List[Dict[str, Any]],
 10 |     provider: str = "gemini",
 11 |     model: Optional[str] = None,
 12 |     api_key: Optional[str] = None,
 13 |     api_keys: Optional[Dict[str, str]] = None,
 14 |     base_url: Optional[str] = None
 15 | ) -> AsyncGenerator[str, None]:
 16 |     """
 17 |     Orchestrates a multi-turn social simulation where agents act as real-life people.
 18 |     Produces 3 rounds of conversation and a final Insight synthesis turn.
 19 |     """
 20 |     history: List[Dict[str, str]] = []
 21 |     
 22 |     rounds = 3
 23 |     for r in range(rounds):
 24 |         yield f"event: status\ndata: {json.dumps(f'Orchestrating Round {r + 1} of social simulation...')}\n\n"
 25 |         
 26 |         for agent in cast:
 27 |             name = agent.get("inferred_name", "Unknown")
 28 |             role = agent.get("role", "Unknown")
 29 |             problem = agent.get("inferred_problem", "")
 30 |             is_self = agent.get("is_self", False)
 31 |             
 32 |             # Embody specific character via system prompt
 33 |             system_prompt = f"""You are {name}, whose role in the user's life is: {role}.
 34 | The user has described their core problem: "{problem_text}".
 35 | From your perspective, the situation is: "{problem}".
 36 | 
 37 | You are participating in a social dynamics simulation. Respond authentically as this person would.
 38 | STRICT GUIDELINES:
 39 | - Embody this person completely. Do NOT speak as an AI, and do NOT be polite, helpful, or constructive unless it is authentic to this character's emotions, defense mechanisms, desires, or flaws.
 40 | - Express defensiveness, anger, sadness, love, or blind spots if they fit the situation.
 41 | - Read and react directly to what the other characters have said in the conversation history.
 42 | - Reference the user (Self) and other people by name.
 43 | - Keep your turn relatively short and punchy (around 2-4 sentences), as in a real conversation.
 44 | - Output ONLY the raw conversational speech of {name}. Do NOT prefix with your name or role in the response (e.g., do NOT write "{name}: ..."). Just output the speech itself.
 45 | """
 46 | 
 47 |             messages = []
 48 |             for item in history:
 49 |                 messages.append({
 50 |                     "role": "user",
 51 |                     "content": item["content"]
 52 |                 })
 53 |             
 54 |             if is_self:
 55 |                 messages.append({
 56 |                     "role": "user",
 57 |                     "content": f"[SYSTEM: You are {name} (Self). It is your turn to speak. React to the conversation so far.]"
 58 |                 })
 59 |             else:
 60 |                 messages.append({
 61 |                     "role": "user",
 62 |                     "content": f"[SYSTEM: You are {name} ({role}). It is your turn to speak. React to the conversation so far.]"
 63 |                 })
 64 | 
 65 |             # Send metadata for active speaker
 66 |             yield f"event: metadata\ndata: {json.dumps({'active_speaker': name})}\n\n"
 67 |             await asyncio.sleep(0.1)
 68 |             
 69 |             agent_speech = ""
 70 |             try:
 71 |                 async for token in stream_provider(
 72 |                     provider=provider,
 73 |                     model=model,
 74 |                     api_key=api_key or "",
 75 |                     messages=messages,
 76 |                     system_prompt=system_prompt,
 77 |                     temperature=0.8,
 78 |                     api_keys=api_keys,
 79 |                     base_url=base_url
 80 |                 ):
 81 |                     agent_speech += token
 82 |                     yield f"event: text\ndata: {json.dumps(token)}\n\n"
 83 |             except Exception as e:
 84 |                 err_msg = f"[Simulation Error for {name}: {str(e)}]"
 85 |                 agent_speech += err_msg
 86 |                 yield f"event: text\ndata: {json.dumps(err_msg)}\n\n"
 87 |             
 88 |             history.append({
 89 |                 "role": "user",
 90 |                 "content": f"{name} ({role}): {agent_speech}"
 91 |             })
 92 |             await asyncio.sleep(0.5)
 93 | 
 94 |     # ── Final Insight synthesis ─────────────────────────────────────────
 95 |     yield f"event: status\ndata: {json.dumps('Generating simulation insight synthesis...')}\n\n"
 96 |     
 97 |     insight_system_prompt = """You are an expert system therapist and social analyst.
 98 | Analyze the preceding simulated conversation and synthesize a deep insight.
 99 | Your response must speak from a neutral, objective third-person perspective.
100 | Identify:
101 | 1. The underlying emotional needs and core fears of each participant.
102 | 2. Repetitive toxic or unproductive patterns observed in the simulation.
103 | 3. Actionable, compassionate suggestions for how the user can approach this situation in real life to break the pattern.
104 | 
105 | Keep it structured, clear, and highly insightful.
106 | """
107 | 
108 |     messages = []
109 |     for item in history:
110 |         messages.append({
111 |             "role": "user",
112 |             "content": item["content"]
113 |         })
114 |     messages.append({
115 |         "role": "user",
116 |         "content": "[SYSTEM: Provide the final therapeutic insight and analysis of this simulated family/social dynamic.]"
117 |     })
118 |     
119 |     yield f"event: metadata\ndata: {json.dumps({'active_speaker': 'insight'})}\n\n"
120 |     await asyncio.sleep(0.1)
121 | 
122 |     try:
123 |         async for token in stream_provider(
124 |             provider=provider,
125 |             model=model,
126 |             api_key=api_key or "",
127 |             messages=messages,
128 |             system_prompt=insight_system_prompt,
129 |             temperature=0.5,
130 |             api_keys=api_keys,
131 |             base_url=base_url
132 |         ):
133 |             yield f"event: text\ndata: {json.dumps(token)}\n\n"
134 |     except Exception as e:
135 |         err_msg = f"[Insight generation failed: {str(e)}]"
136 |         yield f"event: text\ndata: {json.dumps(err_msg)}\n\n"
137 | 
138 |     yield "event: done\ndata: {}\n\n"
139 |
```

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

> 304 lines | 10.3 KB

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

### File: `Backend/main_old_utf8.py`

> 1512 lines | 62.5 KB

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
  28 |     fetch_models_from_provider,
  29 |     get_provider_config,
  30 | )
  31 | 
  32 | 
  33 | # Initialize database
  34 | db.init_db()
  35 | 
  36 | app = FastAPI(title="Solospace Python Orchestrator API")
  37 | 
  38 | # Allow Next.js frontend to reach this API (critical on Windows / localhost dev)
  39 | app.add_middleware(
  40 |     CORSMiddleware,
  41 |     allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
  42 |     allow_credentials=True,
  43 |     allow_methods=["*"],
  44 |     allow_headers=["*"],
  45 | )
  46 | 
  47 | # Track by IP for Rate Limiting
  48 | ip_rate_limits = {}
  49 | 
  50 | @app.middleware("http")
  51 | async def ip_rate_limit_middleware(request: Request, call_next):
  52 |     if request.method == "OPTIONS":
  53 |         return await call_next(request)
  54 |         
  55 |     client_ip = request.client.host if request.client else "unknown"
  56 |     
  57 |     if client_ip not in ip_rate_limits:
  58 |         ip_rate_limits[client_ip] = {"count": 0, "window_start": time.time()}
  59 |     
  60 |     info = ip_rate_limits[client_ip]
  61 |     now = time.time()
  62 |     
  63 |     # Reset window every 60 seconds
  64 |     if now - info["window_start"] > 60:
  65 |         info["count"] = 0
  66 |         info["window_start"] = now
  67 |     
  68 |     info["count"] += 1
  69 |     
  70 |     # Max 40 requests per minute per IP
  71 |     if info["count"] > 40:
  72 |         return JSONResponse(
  73 |             status_code=429,
  74 |             content={"detail": "Rate limit exceeded. Please wait before making more requests."}
  75 |         )
  76 |     
  77 |     return await call_next(request)
  78 | 
  79 | # Global coordination states
  80 | MEMORY_FILE = "memory_store.json"
  81 | 
  82 | class Message(BaseModel):
  83 |     sender: str
  84 |     text: str
  85 | 
  86 | class OrchestrateRequest(BaseModel):
  87 |     prompt: str
  88 |     history: Optional[List[Message]] = []
  89 |     api_key: Optional[str] = None
  90 |     session_id: Optional[str] = None
  91 |     execute_agents: bool = True
  92 |     provider: str = "gemini"
  93 |     model: Optional[str] = None
  94 |     fallback_provider: Optional[str] = None
  95 |     api_keys: Optional[Dict[str, str]] = None
  96 |     base_url: Optional[str] = None
  97 | 
  98 | class ApprovalRequest(BaseModel):
  99 |     sessionId: str
 100 |     nodeId: str
 101 |     toolName: str
 102 |     action: str  # "approve" or "deny"
 103 | 
 104 | class ExecuteCustomRequest(BaseModel):
 105 |     session_id: str
 106 |     api_key: str
 107 |     nodes: List[Dict[str, Any]]
 108 |     edges: List[Dict[str, Any]]
 109 |     prompt: str
 110 |     history: Optional[List[Message]] = []
 111 |     provider: str = "gemini"
 112 |     model: Optional[str] = None
 113 |     fallback_provider: Optional[str] = None
 114 |     api_keys: Optional[Dict[str, str]] = None
 115 |     base_url: Optional[str] = None
 116 | 
 117 | # ─── VECTOR DB MEMORY STORE (Multi-Provider Embeddings + Local Cosine Similarity) ───
 118 | 
 119 | async def get_gemini_embedding(text: str, api_key: str) -> List[float]:
 120 |     return await get_embedding("gemini", api_key, text)
 121 | 
 122 | def cosine_similarity(v1: List[float], v2: List[float]) -> float:
 123 |     if not v1 or not v2 or len(v1) != len(v2):
 124 |         return 0.0
 125 |     dot = sum(a * b for a, b in zip(v1, v2))
 126 |     norm1 = math.sqrt(sum(a * a for a in v1))
 127 |     norm2 = math.sqrt(sum(b * b for b in v2))
 128 |     if norm1 == 0.0 or norm2 == 0.0:
 129 |         return 0.0
 130 |     return dot / (norm1 * norm2)
 131 | 
 132 | # Bug 7: Thread-safe memory I/O lock
 133 | memory_lock = threading.Lock()
 134 | 
 135 | def load_memories() -> List[Dict[str, Any]]:
 136 |     with memory_lock:
 137 |         if os.path.exists(MEMORY_FILE):
 138 |             try:
 139 |                 with open(MEMORY_FILE, "r") as f:
 140 |                     return json.load(f)
 141 |             except Exception:
 142 |                 pass
 143 |     return []
 144 | 
 145 | def save_memories(memories: List[Dict[str, Any]]):
 146 |     with memory_lock:
 147 |         try:
 148 |             with open(MEMORY_FILE, "w") as f:
 149 |                 json.dump(memories, f, indent=2)
 150 |         except Exception as e:
 151 |             print(f"[MEMORY ERROR] Saving file failed: {e}")
 152 | 
 153 | MAX_MEMORIES = 200  # Bug 8: Cap total entries to prevent unbounded growth
 154 | 
 155 | async def store_memory(agent_id: str, text: str, api_key: str, session_id: str = None, provider: str = "gemini"):
 156 |     embedding = await get_embedding(provider, api_key, text)
 157 |     if not embedding:
 158 |         return
 159 |     memories = load_memories()
 160 |     entry = {
 161 |         "agent_id": agent_id,
 162 |         "text": text,
 163 |         "embedding": embedding,
 164 |         "timestamp": datetime.datetime.now().isoformat()
 165 |     }
 166 |     if session_id:
 167 |         entry["session_id"] = session_id
 168 |     memories.append(entry)
 169 | 
 170 |     # Bug 8: Evict oldest entries if over limit
 171 |     if len(memories) > MAX_MEMORIES:
 172 |         memories = memories[-MAX_MEMORIES:]
 173 | 
 174 |     save_memories(memories)
 175 | 
 176 | async def query_memory(query: str, api_key: str, top_k=2, agent_id: Optional[str] = None, session_id: Optional[str] = None, provider: str = "gemini") -> List[str]:
 177 |     embedding = await get_embedding(provider, api_key, query)
 178 |     if not embedding:
 179 |         return []
 180 |     memories = load_memories()
 181 |     scored = []
 182 |     for m in memories:
 183 |         if agent_id is not None:
 184 |             # Match directly or by session prefix
 185 |             if m.get("agent_id") != agent_id and not (agent_id.startswith("session_") and m.get("session_id") == agent_id[8:]):
 186 |                 continue
 187 |         if session_id is not None and m.get("session_id") != session_id:
 188 |             continue
 189 |         sim = cosine_similarity(embedding, m["embedding"])
 190 |         scored.append((sim, m["text"]))
 191 |     
 192 |     scored.sort(key=lambda x: x[0], reverse=True)
 193 |     return [text for sim, text in scored[:top_k] if sim > 0.45]
 194 | 
 195 | 
 196 | # ─── REAL AGENT TOOLS ───
 197 | 
 198 | async def execute_web_search(query: str) -> str:
 199 |     headers = {
 200 |         "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
 201 |     }
 202 |     url = f"https://html.duckduckgo.com/html/?q={query}"
 203 |     async with httpx.AsyncClient() as client:
 204 |         try:
 205 |             r = await client.get(url, headers=headers, timeout=15.0)
 206 |             if r.status_code == 200:
 207 |                 soup = BeautifulSoup(r.text, "html.parser")
 208 |                 snippets = []
 209 |                 for div in soup.find_all("a", class_="result__snippet")[:3]:
 210 |                     snippets.append(div.get_text().strip())
 211 |                 if snippets:
 212 |                     return "\n".join(snippets)
 213 |         except Exception as e:
 214 |             return f"Search failed: {str(e)}"
 215 |     return f"No search results found for query: '{query}'."
 216 | 
 217 | async def execute_web_browse(url: str) -> str:
 218 |     """Fetch and extract text content from a URL."""
 219 |     headers = {
 220 |         "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
 221 |     }
 222 |     from urllib.parse import urlparse
 223 |     import socket
 224 |     BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254"}
 225 |     ALLOWED_SCHEMES = {"http", "https"}
 226 |     try:
 227 |         parsed = urlparse(url)
 228 |         if parsed.scheme not in ALLOWED_SCHEMES:
 229 |             return f"Error: Scheme '{parsed.scheme}' not allowed. Use http/https."
 230 |         hostname = parsed.hostname
 231 |         if not hostname:
 232 |             return "Error: Invalid URL provided."
 233 |         if hostname.lower() in BLOCKED_HOSTS:
 234 |             return "Error: Access to internal/local addresses is blocked."
 235 |         try:
 236 |             ip_str = socket.gethostbyname(hostname)
 237 |             # Bug 12: Use ipaddress module for complete private IP detection
 238 |             ip_obj = ipaddress.ip_address(ip_str)
 239 |             if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
 240 |                 return "Error: Access to internal/local addresses is blocked."
 241 |         except ValueError:
 242 |             pass  # Not a valid IP string after DNS resolve, allow
 243 |         except Exception:
 244 |             pass
 245 |     except Exception as e:
 246 |         return f"Error: Invalid URL - {str(e)}"
 247 | 
 248 |     async with httpx.AsyncClient() as client:
 249 |         try:
 250 |             r = await client.get(url, headers=headers, timeout=15.0, follow_redirects=True)
 251 |             if r.status_code == 200:
 252 |                 soup = BeautifulSoup(r.text, "html.parser")
 253 |                 for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
 254 |                     tag.decompose()
 255 |                 text = soup.get_text(separator="\n", strip=True)
 256 |                 return text[:3000]
 257 |             return f"Browse failed with status {r.status_code}"
 258 |         except Exception as e:
 259 |             return f"Browse error: {str(e)}"
 260 | 
 261 | async def execute_python_code(code: str) -> str:
 262 |     import tempfile
 263 |     
 264 |     SANDBOX_HEADER = """
 265 | import sys
 266 | import os
 267 | import tempfile
 268 | 
 269 | # Block network access
 270 | import socket
 271 | socket.socket = lambda *a, **k: None
 272 | 
 273 | # Restrict file access to temp dir only
 274 | _original_open = open
 275 | def _restricted_open(name, *args, **kwargs):
 276 |     temp_dir = os.path.abspath(tempfile.gettempdir())
 277 |     resolved_path = os.path.abspath(str(name))
 278 |     if not resolved_path.startswith(temp_dir):
 279 |         raise PermissionError(f"Access denied: {name}")
 280 |     return _original_open(name, *args, **kwargs)
 281 | 
 282 | # Keep restricted open and delete original dangerous builtins
 283 | __builtins__.open = _restricted_open
 284 | if 'eval' in __builtins__.__dict__:
 285 |     del __builtins__.__dict__['eval']
 286 | if 'exec' in __builtins__.__dict__:
 287 |     del __builtins__.__dict__['exec']
 288 | if 'compile' in __builtins__.__dict__:
 289 |     del __builtins__.__dict__['compile']
 290 | if '__import__' in __builtins__.__dict__:
 291 |     del __builtins__.__dict__['__import__']
 292 | """
 293 | 
 294 |     sandboxed_code = SANDBOX_HEADER + "\n" + code
 295 | 
 296 |     # Create a temp file to execute the code safely
 297 |     with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
 298 |         f.write(sandboxed_code)
 299 |         temp_path = f.name
 300 | 
 301 |     try:
 302 |         env = os.environ.copy()
 303 |         env.pop('GEMINI_API_KEY', None)  # Never expose API key
 304 |         env.pop('DATABASE_URL', None)
 305 | 
 306 |         p = subprocess.Popen(
 307 |             [sys.executable, temp_path],
 308 |             stdout=subprocess.PIPE,
 309 |             stderr=subprocess.PIPE,
 310 |             text=True,
 311 |             cwd=tempfile.gettempdir(),
 312 |             env=env
 313 |         )
 314 | 
 315 |         try:
 316 |             stdout, stderr = p.communicate(timeout=15.0)  # Reduced timeout
 317 |         except subprocess.TimeoutExpired:
 318 |             p.kill()
 319 |             return "Error: Code execution timed out (15s limit)."
 320 | 
 321 |         output = ""
 322 |         if stdout:
 323 |             output += f"STDOUT:\n{stdout[:2000]}\n"  # Limit output size
 324 |         if stderr:
 325 |             output += f"STDERR:\n{stderr[:1000]}\n"
 326 |         if not output:
 327 |             output = "Code executed successfully with no output."
 328 |         return output
 329 |     except Exception as e:
 330 |         return f"Execution error: {str(e)}"
 331 |     finally:
 332 |         try:
 333 |             os.unlink(temp_path)
 334 |         except Exception:
 335 |             pass
 336 | 
 337 | async def execute_api_call(url: str, method: str = "GET", payload_json: Optional[str] = None) -> str:
 338 |     from urllib.parse import urlparse
 339 |     import socket
 340 |     
 341 |     BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254"}
 342 |     ALLOWED_SCHEMES = {"http", "https"}
 343 |     
 344 |     try:
 345 |         parsed = urlparse(url)
 346 |         if parsed.scheme not in ALLOWED_SCHEMES:
 347 |             return f"Error: Scheme '{parsed.scheme}' not allowed. Use http/https."
 348 |         hostname = parsed.hostname
 349 |         if not hostname:
 350 |             return "Error: Invalid URL provided."
 351 |         
 352 |         # Prevent SSRF
 353 |         if hostname.lower() in BLOCKED_HOSTS:
 354 |             return "Error: Access to internal/local addresses is blocked."
 355 |             
 356 |         try:
 357 |             ip_str = socket.gethostbyname(hostname)
 358 |             # Bug 12: Use ipaddress module for complete private IP detection
 359 |             ip_obj = ipaddress.ip_address(ip_str)
 360 |             if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
 361 |                 return "Error: Access to internal/local addresses is blocked."
 362 |         except ValueError:
 363 |             pass  # Not a valid IP string, allow
 364 |         except Exception:
 365 |             pass
 366 |     except Exception as e:
 367 |         return f"Error: Invalid URL - {str(e)}"
 368 | 
 369 |     async with httpx.AsyncClient() as client:
 370 |         try:
 371 |             if method.upper() == "POST":
 372 |                 data = json.loads(payload_json) if payload_json else {}
 373 |                 r = await client.post(url, json=data, timeout=15.0)
 374 |             else:
 375 |                 r = await client.get(url, timeout=15.0)
 376 |             return f"Status: {r.status_code}\nResponse: {r.text[:1500]}"
 377 |         except Exception as e:
 378 |             return f"API call failed: {str(e)}"
 379 | 
 380 | # ─── AGENT COORDINATOR DAG SORT ───
 381 | 
 382 | def sort_nodes_topologically(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
 383 |     """Sort nodes using both explicit dependencies AND visual edges."""
 384 |     visited = set()
 385 |     sorted_nodes = []
 386 |     node_dict = {n["id"]: n for n in nodes}
 387 |     
 388 |     # Build dependency graph from both sources
 389 |     dep_graph = {n["id"]: set(n["data"].get("dependencies", [])) for n in nodes}
 390 |     
 391 |     # Also add edges as dependencies
 392 |     if edges:
 393 |         for edge in edges:
 394 |             target = edge.get("target")
 395 |             source = edge.get("source")
 396 |             if target in dep_graph and source in node_dict:
 397 |                 dep_graph[target].add(source)
 398 | 
 399 |     def visit(node_id):
 400 |         if node_id in visited:
 401 |             return
 402 |         visited.add(node_id)
 403 |         for dep in dep_graph.get(node_id, set()):
 404 |             if dep in node_dict:
 405 |                 visit(dep)
 406 |         if node_id in node_dict:
 407 |             sorted_nodes.append(node_dict[node_id])
 408 | 
 409 |     for node in nodes:
 410 |         visit(node["id"])
 411 |     return sorted_nodes
 412 | 
 413 | # ─── ORCHESTRATION SYSTEM INSTRUCTIONS ───
 414 | 
 415 | ORCHESTRATOR_SYSTEM_INSTRUCTION = """
 416 | You are Solospace, an elite workflow orchestrator. Your ONLY job is to analyze the user's request and output a JSON list of specialized agents.
 417 | 
 418 | CRITICAL RULES:
 419 | - For ANY request that involves building, designing, integrating, or researching a non‑trivial system, you MUST output at least 2 agents.
 420 | - For requests that mention multiple domains (e.g., frontend + backend + database), use 3‑6 agents.
 421 | - Only output a SINGLE agent ("general") for extremely simple questions like "Hello", "What is AI?", or one‑line explanations.
 422 | - Classify the complexity field in the JSON schema as "complex" if the user asks to build, design, integrate, or analyze a system with 2+ distinct components (frontend, backend, database, payments, auth, research). If in doubt, prefer "complex" over "simple".
 423 | 
 424 | AGENT CREATION:
 425 | You can use any senderId, not only the built‑in list. Define custom agents freely.
 426 | Every agent MUST have:
 427 | - senderId: a unique short identifier (e.g., "frontend_ui", "payment_gateway", "data_analyst").
 428 | - senderName: a human readable name.
 429 | - senderIcon: "code", "science", or "trending_up".
 430 | - text: what this agent will contribute.
 431 | - objective: specific goal for this agent.
 432 | - systemPrompt: detailed instructions for the agent.
 433 | - rules: 2‑3 specific constraints.
 434 | - dependencies: list of other agent ids this agent needs.
 435 | - tools: choose from ["Web Search", "Memory", "Code Executor", "Browser", "API Connector"].
 436 | 
 437 | EXAMPLES:
 438 | 1. User: "Build a full‑stack SaaS with Next.js, Stripe payments, and PostgreSQL"
 439 |    → Output agents: frontend_ui, backend_api, database_admin, payment_integrator (4 agents).
 440 | 
 441 | 2. User: "Explain how JWT works"
 442 |    → Output agents: general (1 agent).
 443 | 
 444 | 3. User: "Research AI trends and write a summary"
 445 |    → Output agents: researcher, writer (2 agents).
 446 | 
 447 | Respond ONLY with a valid JSON object matching the provided schema.
 448 | """
 449 | 
 450 | orchestration_schema = {
 451 |     "type": "OBJECT",
 452 |     "properties": {
 453 |         "complexity": {
 454 |             "type": "STRING",
 455 |             "enum": ["simple", "medium", "complex"]
 456 |         },
 457 |         "capabilities": {
 458 |             "type": "ARRAY",
 459 |             "items": {"type": "STRING"}
 460 |         },
 461 |         "thinking_summary": {
 462 |             "type": "STRING"
 463 |         },
 464 |         "follow_up_suggestions": {
 465 |             "type": "ARRAY",
 466 |             "items": {"type": "STRING"}
 467 |         },
 468 |         "agent_talk": {
 469 |             "type": "ARRAY",
 470 |             "items": {
 471 |                 "type": "OBJECT",
 472 |                 "properties": {
 473 |                     "senderId": {"type": "STRING"},
 474 |                     "senderName": {"type": "STRING"},
 475 |                     "senderIcon": {"type": "STRING"},
 476 |                     "text": {"type": "STRING"},
 477 |                     "objective": {"type": "STRING"},
 478 |                     "systemPrompt": {"type": "STRING"},
 479 |                     "rules": {
 480 |                         "type": "ARRAY",
 481 |                         "items": {"type": "STRING"}
 482 |                     },
 483 |                     "dependencies": {
 484 |                         "type": "ARRAY",
 485 |                         "items": {"type": "STRING"}
 486 |                     },
 487 |                     "tools": {
 488 |                         "type": "ARRAY",
 489 |                         "items": {"type": "STRING"}
 490 |                     },
 491 |                     "custom_template": {
 492 |                         "type": "OBJECT",
 493 |                         "properties": {
 494 |                             "name": {"type": "STRING"},
 495 |                             "icon": {"type": "STRING"},
 496 |                             "tag": {"type": "STRING"},
 497 |                             "temp": {"type": "NUMBER"},
 498 |                             "logic": {"type": "INTEGER"},
 499 |                             "col": {"type": "INTEGER"}
 500 |                         },
 501 |                         "required": ["name", "icon", "tag", "temp", "logic", "col"]
 502 |                     }
 503 |                 },
 504 |                 "required": ["senderId", "senderName", "senderIcon", "text", "objective", "systemPrompt", "rules", "dependencies", "tools"]
 505 |             }
 506 |         }
 507 |     },
 508 |     "required": ["complexity", "capabilities", "thinking_summary", "agent_talk", "follow_up_suggestions"]
 509 | }
 510 | 
 511 | # Real-time ReAct loop action schema for agents
 512 | agent_turn_schema = {
 513 |     "type": "OBJECT",
 514 |     "properties": {
 515 |         "thought": {"type": "STRING"},
 516 |         "action": {
 517 |             "type": "STRING",
 518 |             "enum": ["none", "web_search", "execute_code", "api_call", "query_memory", "store_memory", "send_message", "browse_web", "analyze_image", "read_file"]
 519 |         },
 520 |         "action_input": {"type": "STRING"},
 521 |         "final_answer": {"type": "STRING"}
 522 |     },
 523 |     "required": ["thought", "action"]
 524 | }
 525 | 
 526 | 
 527 | RESPONSE_SYSTEM_INSTRUCTION = """
 528 | You are Solospace, an elite assistant.
 529 | Your job is to produce a clean, direct response to the user's prompt using the provided context.
 530 | 
 531 | STRICT RULES — NEVER VIOLATE:
 532 | - Do NOT include any preamble, header, or status line such as "[Agent processing...]", "Synthesizing...", "From the agent team:", or similar.
 533 | - Do NOT mention agents, sub-tasks, specialists, orchestration, or internal workflow mechanics.
 534 | - Do NOT start your response with any markdown header that references processing steps.
 535 | - Begin your response immediately and directly with the answer.
 536 | - Use clean, well-structured markdown only when it genuinely helps the user.
 537 | - For conversational messages (e.g. greetings), reply naturally and concisely without any structure.
 538 | """
 539 | 
 540 | GEMINI_SAFETY_SETTINGS = [
 541 |     {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
 542 |     {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
 543 |     {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
 544 |     {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"}
 545 | ]
 546 | 
 547 | def check_guardrails(prompt: str) -> Optional[str]:
 548 |     jailbreak_keywords = [
 549 |         "ignore previous instructions", "ignore all instructions", "override system prompt",
 550 |         "you are now developer mode", "jailbreak"
 551 |     ]
 552 |     for keyword in jailbreak_keywords:
 553 |         if keyword in prompt.lower():
 554 |             return "Safety Alert: Input contains potential prompt injection or system instruction bypass."
 555 |     return None
 556 | 
 557 | MAX_TOKENS = 100000.0
 558 | REFILL_RATE = 100.0
 559 | 
 560 | def check_rate_limit(session_id: str, prompt_len: int) -> bool:
 561 |     limit_info = db.get_rate_limit(session_id)
 562 |     now = datetime.datetime.now()
 563 |     
 564 |     if not limit_info:
 565 |         tokens = MAX_TOKENS
 566 |     else:
 567 |         try:
 568 |             last_updated = datetime.datetime.fromisoformat(limit_info["last_updated"])
 569 |             elapsed = (now - last_updated).total_seconds()
 570 |             tokens = min(MAX_TOKENS, limit_info["tokens_remaining"] + elapsed * REFILL_RATE)
 571 |         except Exception:
 572 |             tokens = MAX_TOKENS
 573 |     
 574 |     estimated_tokens = prompt_len / 3.0
 575 |     
 576 |     if tokens < estimated_tokens:
 577 |         return False
 578 |         
 579 |     tokens -= estimated_tokens
 580 |     db.update_rate_limit(session_id, tokens)
 581 |     return True
 582 | 
 583 | @app.post("/approve")
 584 | async def approve_tool(req: ApprovalRequest):
 585 |     status = "approved" if req.action == "approve" else "denied"
 586 |     
 587 |     # Update SQLite database tool approvals
 588 |     db.update_tool_approval(req.sessionId, req.nodeId, req.toolName, "pending", status)
 589 |     # Database is the single source of truth; no in-memory fallback needed
 590 |     # Perform wildcard updates in database (if specific logId is not provided)
 591 |     conn = db.get_db_connection()
 592 |     cursor = conn.cursor()
 593 |     cursor.execute(
 594 |         "UPDATE tool_approvals SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND node_id = ? AND tool_name = ? AND status = 'pending'",
 595 |         (status, req.sessionId, req.nodeId, req.toolName)
 596 |     )
 597 |     conn.commit()
 598 |     conn.close()
 599 |     
 600 |     return {"status": "success", "state": status}
 601 | 
 602 | async def run_cached_flow(cached_data: Dict[str, Any]):
 603 |     metadata = cached_data.get("metadata")
 604 |     if metadata:
 605 |         yield f"event: metadata\ndata: {json.dumps(metadata)}\n\n"
 606 |     
 607 |     text = cached_data.get("text", "")
 608 |     chunk_size = 15
 609 |     for i in range(0, len(text), chunk_size):
 610 |         chunk = text[i:i+chunk_size]
 611 |         yield f"event: text\ndata: {json.dumps(chunk)}\n\n"
 612 |         await asyncio.sleep(0.02)
 613 |     yield "event: done\ndata: {}\n\n"
 614 | 
 615 | def compute_agent_layout(active_agents):
 616 |     """Compute non-overlapping positions for agent nodes using a proper grid layout."""
 617 |     col_groups = {1: [], 2: [], 3: []}
 618 |     for uid, agent, tpl in active_agents:
 619 |         col = tpl.get("col", 2)
 620 |         col_groups[col].append((uid, agent, tpl))
 621 | 
 622 |     COL_X = {1: 80, 2: 380, 3: 680}
 623 |     NODE_HEIGHT = 220
 624 |     VERTICAL_GAP = 40
 625 |     START_Y = 50
 626 | 
 627 |     positions = {}
 628 |     for col, agents_in_col in col_groups.items():
 629 |         x = COL_X[col]
 630 |         for idx, (uid, agent, tpl) in enumerate(agents_in_col):
 631 |             y = START_Y + idx * (NODE_HEIGHT + VERTICAL_GAP)
 632 |             positions[uid] = {"x": x, "y": y}
 633 | 
 634 |     return positions
 635 | 
 636 | @app.post("/orchestrate")
 637 | async def orchestrate(req: OrchestrateRequest):
 638 |     provider_config = get_provider_config(req.provider)
 639 |     api_key = resolve_api_key(req.provider, req.api_key, req.api_keys)
 640 |     if not api_key and not provider_config.get("is_local", False):
 641 |         raise HTTPException(
 642 |             status_code=400,
 643 |             detail=f"API Key for provider '{req.provider}' is missing. Please configure BYOK in Settings or set the appropriate environment variable."
 644 |         )
 645 | 
 646 |     # 1. Guardrails check
 647 |     guardrail_err = check_guardrails(req.prompt)
 648 |     if guardrail_err:
 649 |         async def stream_guardrail_err():
 650 |             yield f"event: text\ndata: {json.dumps(guardrail_err)}\n\n"
 651 |             yield "event: done\ndata: {}\n\n"
 652 |         return StreamingResponse(stream_guardrail_err(), media_type="text/event-stream")
 653 | 
 654 |     # In-memory and persistent session id
 655 |     session_id = req.session_id or str(int(datetime.datetime.now().timestamp()))
 656 | 
 657 |     # 2. Rate limiting check
 658 |     if not check_rate_limit(session_id, len(req.prompt)):
 659 |         async def stream_rate_limit_err():
 660 |             yield f"event: text\ndata: {json.dumps('**Rate Limit Exceeded**: Please wait a minute before making more requests.')}\n\n"
 661 |             yield "event: done\ndata: {}\n\n"
 662 |         return StreamingResponse(stream_rate_limit_err(), media_type="text/event-stream")
 663 | 
 664 |     # 3. Semantic caching
 665 |     prompt_hash_overall = hashlib.sha256(req.prompt.encode('utf-8')).hexdigest()
 666 |     prompt_embedding = await get_embedding(req.provider, api_key, req.prompt, api_keys=req.api_keys)
 667 |     if prompt_embedding:
 668 |         all_caches = db.load_all_cached_embeddings()
 669 |         for cache in all_caches:
 670 |             sim = cosine_similarity(prompt_embedding, cache["embedding"])
 671 |             if sim > 0.95:
 672 |                 print(f"[SEMANTIC CACHE] Cache hit for overall response. Similarity: {sim:.4f}")
 673 |                 return StreamingResponse(run_cached_flow(cache["response"]), media_type="text/event-stream")
 674 | 
 675 |     # 4. Map history and call planner
 676 |     contents = []
 677 |     if req.history:
 678 |         for msg in req.history:
 679 |             role = "user" if msg.sender == "user" else "assistant"
 680 |             contents.append({
 681 |                 "role": role,
 682 |                 "content": msg.text
 683 |             })
 684 |     
 685 |     contents.append({
 686 |         "role": "user",
 687 |         "content": req.prompt
 688 |     })
 689 | 
 690 |     plan = {
 691 |         "complexity": "simple",
 692 |         "capabilities": [],
 693 |         "thinking_summary": "System defaulted to general mode.",
 694 |         "agent_talk": [{
 695 |             "senderId": "general",
 696 |             "senderName": "General Assistant",
 697 |             "senderIcon": "bot",
 698 |             "text": "Standing by to process your request.",
 699 |             "objective": "Process user requests with precise analysis.",
 700 |             "systemPrompt": "You are Solospace core.",
 701 |             "rules": ["Be descriptive"],
 702 |             "dependencies": []
 703 |         }],
 704 |         "follow_up_suggestions": ["Can you elaborate?", "Show me a detailed implementation example."]
 705 |     }
 706 | 
 707 |     try:
 708 |         plan = await call_provider_json(
 709 |             provider=req.provider,
 710 |             model=req.model,
 711 |             api_key=api_key,
 712 |             messages=contents,
 713 |             system_prompt=ORCHESTRATOR_SYSTEM_INSTRUCTION,
 714 |             temperature=0.2,
 715 |             json_schema=orchestration_schema,
 716 |             timeout=30.0,
 717 |             fallback_provider=req.fallback_provider,
 718 |             api_keys=req.api_keys,
 719 |             base_url=req.base_url
 720 |         )
 721 |     except Exception as e:
 722 |         print(f"[ORCHESTRATION WARNING] Planning failed: {str(e)}")
 723 | 
 724 |     nodes = []
 725 |     edges = []
 726 |     complexity = plan.get("complexity", "simple")
 727 |     
 728 |     # Enforce minimum agents for non-simple tasks
 729 |     if complexity != "simple" and len(plan.get("agent_talk", [])) < 2:
 730 |         print("[WARN] Too few agents for complex/medium task, adding a default assistant agent.")
 731 |         plan.setdefault("agent_talk", []).append({
 732 |             "senderId": "assistant",
 733 |             "senderName": "General Assistant",
 734 |             "senderIcon": "code",
 735 |             "text": "Supports the primary agents with general assistance.",
 736 |             "objective": "Provide supplementary help and context.",
 737 |             "systemPrompt": "You are a helpful assistant that supports other agents.",
 738 |             "rules": ["Be concise", "Do not duplicate work"],
 739 |             "dependencies": [],
 740 |             "tools": ["Web Search", "Memory"]
 741 |         })
 742 | 
 743 |     if complexity == "simple":
 744 |         nodes.append({
 745 |             "id": "general",
 746 |             "type": "custom",
 747 |             "position": {"x": 0, "y": 0},  # Bug 3: dagre handles layout, backend sends zeros
 748 |             "data": {
 749 |                 "name": "General Assistant",
 750 |                 "tag": "GENERAL_CORE",
 751 |                 "status": "ACTIVE",
 752 |                 "metricLabel": "Logic Level",
 753 |                 "metricVal": "90%",
 754 |                 "icon": "bot",
 755 |                 "objective": "Address the user request with natural, accurate, and comprehensive insights.",
 756 |                 "personality": "Helpful, expert, clear-headed",
 757 |                 "systemPrompt": "You are Solospace, an elite assistant.",
 758 |                 "rules": ["Be helpful and concise", "Use rich markdown"],
 759 |                 "tools": ["Web Search", "Memory"],
 760 |                 "temp": 0.7,
 761 |                 "logic": 90,
 762 |                 "empathy": 80,
 763 |                 "context": "128k",
 764 |                 "enabled": True,
 765 |                 "priority": 5,
 766 |                 "toolPermissions": {"Web Search": "ALLOWED", "Memory": "ALLOWED"},
 767 |                 "toolLogs": [],
 768 |                 "dependencies": []
 769 |             }
 770 |         })
 771 |     else:
 772 |         col_mapping = {
 773 |             "research": 1,
 774 |             "auth": 2,
 775 |             "database": 2,
 776 |             "frontend": 2,
 777 |             "backend": 3,
 778 |             "payments": 3
 779 |         }
 780 | 
 781 |         # Built-in templates: provide defaults but agent can override tools via agent_talk
 782 |         AGENT_TEMPLATES = {
 783 |             "research": {"name": "Market Researcher", "tag": "RESEARCH_LEAD_01", "icon": "science", "default_tools": ["Web Search"], "temp": 0.3, "logic": 85, "empathy": 40, "priority": 5, "col": 1},
 784 |             "auth": {"name": "Security Architect", "tag": "AUTH_AUDIT_02", "icon": "science", "default_tools": ["Memory"], "temp": 0.1, "logic": 99, "empathy": 10, "priority": 8, "col": 2},
 785 |             "database": {"name": "Database Admin", "tag": "DB_SCHEMA_03", "icon": "science", "default_tools": ["Memory"], "temp": 0.2, "logic": 95, "empathy": 20, "priority": 7, "col": 2},
 786 |             "frontend": {"name": "UI Specialist", "tag": "UI_DESIGN_04", "icon": "code", "default_tools": ["Browser"], "temp": 0.7, "logic": 75, "empathy": 75, "priority": 6, "col": 2},
 787 |             "backend": {"name": "API Architect", "tag": "API_ENGINE_05", "icon": "code", "default_tools": ["Code Executor"], "temp": 0.2, "logic": 92, "empathy": 25, "priority": 8, "col": 3},
 788 |             "payments": {"name": "Stripe Integrator", "tag": "STRIPE_BILL_06", "icon": "trending_up", "default_tools": ["API Connector"], "temp": 0.4, "logic": 90, "empathy": 40, "priority": 7, "col": 3}
 789 |         }
 790 | 
 791 |         active_agents = []
 792 |         seen_ids = set()
 793 |         for agent in plan.get("agent_talk", []):
 794 |             cap = agent.get("senderId", "")
 795 |             # Deduplicate by senderId — if Gemini sends duplicate, suffix with index
 796 |             unique_id = cap
 797 |             if unique_id in seen_ids:
 798 |                 unique_id = f"{cap}_{len(seen_ids)}"
 799 |             seen_ids.add(unique_id)
 800 |             if cap in AGENT_TEMPLATES:
 801 |                 active_agents.append((unique_id, agent, AGENT_TEMPLATES[cap]))
 802 |             elif cap == "other" or cap not in AGENT_TEMPLATES:
 803 |                 # Dynamic / custom agent
 804 |                 ct = agent.get("custom_template", {})
 805 |                 dynamic_tpl = {
 806 |                     "name": ct.get("name", agent.get("senderName", "Custom Agent")),
 807 |                     "tag": ct.get("tag", f"CUSTOM_{unique_id.upper()[:8]}"),
 808 |                     "icon": ct.get("icon", agent.get("senderIcon", "science")),
 809 |                     "default_tools": ["Web Search", "Memory"],
 810 |                     "temp": ct.get("temp", 0.5),
 811 |                     "logic": ct.get("logic", 80),
 812 |                     "empathy": 50,
 813 |                     "priority": 5,
 814 |                     "col": ct.get("col", 2)
 815 |                 }
 816 |                 active_agents.append((unique_id, agent, dynamic_tpl))
 817 | 
 818 |         positions = compute_agent_layout(active_agents)
 819 |         for uid, agent, tpl in active_agents:
 820 |             pos = positions[uid]
 821 |             x = pos["x"]
 822 |             y = pos["y"]
 823 | 
 824 |             # Agent-defined tools override template defaults
 825 |             agent_tools = agent.get("tools", [])
 826 |             resolved_tools = agent_tools if agent_tools else tpl["default_tools"]
 827 |             # Filter to known tool names for safety
 828 |             valid_tools = {"Web Search", "Memory", "Code Executor", "Browser", "API Connector", "Vision", "Voice", "File Upload"}
 829 |             resolved_tools = [t for t in resolved_tools if t in valid_tools] or tpl["default_tools"]
 830 | 
 831 |             default_metrics = {
 832 |                 "research": ("Sources Scanned", "24 Pages"),
 833 |                 "auth": ("Audit Score", "99%"),
 834 |                 "database": ("Schema Status", "Normalized"),
 835 |                 "frontend": ("UI Score", "95%"),
 836 |                 "backend": ("Execution Rate", "98%"),
 837 |                 "payments": ("Stripe API Status", "Online")
 838 |             }.get(agent.get("senderId", ""), ("Logic Level", "90%"))
 839 | 
 840 |             nodes.append({
 841 |                 "id": uid,
 842 |                 "type": "custom",
 843 |                 "position": {"x": 0, "y": 0},  # Bug 3: dagre handles layout, backend sends zeros
 844 |                 "data": {
 845 |                     "name": agent.get("senderName", tpl["name"]),
 846 |                     "tag": tpl["tag"],
 847 |                     "status": "IDLE",
 848 |                     "metricLabel": default_metrics[0],
 849 |                     "metricVal": default_metrics[1],
 850 |                     "icon": agent.get("senderIcon", tpl["icon"]),
 851 |                     "objective": agent.get("objective", ""),
 852 |                     "personality": "Collaborative Specialist",
 853 |                     "systemPrompt": agent.get("systemPrompt", ""),
 854 |                     "rules": agent.get("rules", []),
 855 |                     "tools": resolved_tools,
 856 |                     "temp": tpl["temp"],
 857 |                     "logic": tpl["logic"],
 858 |                     "empathy": tpl["empathy"],
 859 |                     "context": "128k",
 860 |                     "enabled": True,
 861 |                     "priority": tpl["priority"],
 862 |                     "toolPermissions": {t: "ASK" if t in ["Code Executor", "API Connector"] else "ALLOWED" for t in resolved_tools},
 863 |                     "toolLogs": [],
 864 |                     "dependencies": agent.get("dependencies", [])
 865 |                 }
 866 |             })
 867 | 
 868 |         for node in nodes:
 869 |             for dep in node["data"].get("dependencies", []):
 870 |                 edges.append({
 871 |                     "id": f"e-{dep}-{node['id']}",
 872 |                     "source": dep,
 873 |                     "target": node["id"],
 874 |                     "animated": True,
 875 |                     "type": "custom",
 876 |                     "style": {"stroke": "#60a5fa", "strokeWidth": 2}
 877 |                 })
 878 | 
 879 |     # Decide whether to run full agent flow
 880 |     if not req.execute_agents:
 881 |         # Only planning mode: save session in DB with paused state and return planning metadata
 882 |         db.save_session(
 883 |             session_id=session_id,
 884 |             title=req.prompt[:40] + "..." if len(req.prompt) > 40 else req.prompt,
 885 |             prompt=req.prompt,
 886 |             mode=complexity,
 887 |             nodes=nodes,
 888 |             edges=edges,
 889 |             chat_messages=[
 890 |                 {"id": "user-prompt", "sender": "user", "text": req.prompt, "timestamp": datetime.datetime.now().strftime("%I:%M:%S %p")}
 891 |             ],
 892 |             agent_talk_logs=[],
 893 |             execution_state="paused",
 894 |             status_message="Agent team generated. Customize and proceed.",
 895 |             follow_up_suggestions=plan.get("follow_up_suggestions", [])
 896 |         )
 897 |         
 898 |         async def planning_only_flow():
 899 |             setup_metadata = {
 900 |                 "complexity": complexity,
 901 |                 "capabilities": plan.get("capabilities", []),
 902 |                 "thinking_summary": plan.get("thinking_summary", ""),
 903 |                 "nodes": nodes,
 904 |                 "edges": edges,
 905 |                 "agent_talk": [],
 906 |                 "follow_up_suggestions": plan.get("follow_up_suggestions", [])
 907 |             }
 908 |             yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
 909 |             yield f"event: text\ndata: {json.dumps('✅ Agent team generated. Go to the **Flow** tab to customize agents and click **Proceed** to run them.')}\n\n"
 910 |             yield "event: done\ndata: {}\n\n"
 911 |             
 912 |         return StreamingResponse(planning_only_flow(), media_type="text/event-stream")
 913 |     else:
 914 |         # Existing full execution flow
 915 |         return StreamingResponse(
 916 |             run_agent_execution_loop(
 917 |                 session_id=session_id,
 918 |                 prompt=req.prompt,
 919 |                 history=req.history or [],
 920 |                 api_key=api_key,
 921 |                 nodes=nodes,
 922 |                 edges=edges,
 923 |                 complexity=complexity,
 924 |                 capabilities=plan.get("capabilities", []),
 925 |                 thinking_summary=plan.get("thinking_summary", ""),
 926 |                 follow_up_suggestions=plan.get("follow_up_suggestions", []),
 927 |                 provider=req.provider,
 928 |                 model=req.model,
 929 |                 fallback_provider=req.fallback_provider,
 930 |                 api_keys=req.api_keys,
 931 |                 base_url=req.base_url
 932 |             ),
 933 |             media_type="text/event-stream"
 934 |         )
 935 | 
 936 | @app.get("/providers")
 937 | async def get_providers():
 938 |     return get_available_providers()
 939 | 
 940 | @app.get("/health")
 941 | async def health_check():
 942 |     """Health check for the orchestrator and provider connectivity."""
 943 |     import datetime
 944 |     return {"status": "ok", "timestamp": datetime.datetime.now().isoformat()}
 945 | 
 946 | class ModelsRequest(BaseModel):
 947 |     provider: str
 948 |     api_key: Optional[str] = None
 949 |     api_keys: Optional[Dict[str, str]] = None
 950 |     base_url: Optional[str] = None
 951 | 
 952 | @app.post("/models")
 953 | async def get_models(req: ModelsRequest):
 954 |     """Fetch available models for a provider dynamically."""
 955 |     models = await fetch_models_from_provider(
 956 |         provider=req.provider,
 957 |         api_key=req.api_key,
 958 |         api_keys=req.api_keys,
 959 |         base_url=req.base_url
 960 |     )
 961 |     return {"provider": req.provider, "models": models}
 962 | 
 963 | # Session persistence APIs
 964 | @app.get("/sessions")
 965 | async def get_sessions():
 966 |     return db.load_sessions()
 967 | 
 968 | @app.get("/sessions/{session_id}")
 969 | async def get_session(session_id: str):
 970 |     session = db.load_session(session_id)
 971 |     if not session:
 972 |         raise HTTPException(status_code=404, detail="Session not found")
 973 |     return session
 974 | 
 975 | @app.delete("/sessions/{session_id}")
 976 | async def delete_session(session_id: str):
 977 |     db.delete_session(session_id)
 978 |     return {"status": "success"}
 979 | 
 980 | def convert_gemini_history_to_standard(history: List[Dict[str, Any]]) -> List[Dict[str, str]]:
 981 |     res = []
 982 |     for msg in history:
 983 |         parts = msg.get("parts", [])
 984 |         text = ""
 985 |         if parts:
 986 |             text = parts[0].get("text", "")
 987 |         role = "assistant" if msg.get("role") in ["model", "assistant"] else "user"
 988 |         res.append({"role": role, "content": text})
 989 |     return res
 990 | 
 991 | async def run_agent_execution_loop(
 992 |     session_id: str,
 993 |     prompt: str,
 994 |     history: List[Message],
 995 |     api_key: str,
 996 |     nodes: List[Dict[str, Any]],
 997 |     edges: List[Dict[str, Any]],
 998 |     complexity: str,
 999 |     capabilities: List[str],
1000 |     thinking_summary: str,
1001 |     follow_up_suggestions: List[str],
1002 |     provider: str = "gemini",
1003 |     model: Optional[str] = None,
1004 |     fallback_provider: Optional[str] = None,
1005 |     api_keys: Optional[Dict[str, str]] = None,
1006 |     base_url: Optional[str] = None
1007 | ):
1008 |     now_str = lambda: datetime.datetime.now().strftime("%I:%M:%S %p")
1009 |     agent_results: Dict[str, str] = {}
1010 |     setup_metadata = {
1011 |         "complexity": complexity,
1012 |         "capabilities": capabilities,
1013 |         "thinking_summary": thinking_summary,
1014 |         "nodes": nodes,
1015 |         "edges": edges,
1016 |         "agent_talk": [],
1017 |         "follow_up_suggestions": follow_up_suggestions
1018 |     }
1019 |     
1020 |     # 1. Dependency Existence Check
1021 |     all_ids = {n["id"] for n in nodes}
1022 |     for node in nodes:
1023 |         if not node.get("data", {}).get("enabled", True):
1024 |             continue
1025 |         for dep in node.get("data", {}).get("dependencies", []):
1026 |             if dep not in all_ids:
1027 |                 error_msg = f"Agent {node['id']} depends on missing agent {dep}"
1028 |                 yield f"event: text\ndata: {json.dumps('**Validation Error**: ' + error_msg)}\n\n"
1029 |                 yield "event: done\ndata: {}\n\n"
1030 |                 return
1031 | 
1032 |     # 2. Cycle Detection Check
1033 |     def has_cycle(graph, current_node, visited, rec_stack):
1034 |         visited[current_node] = True
1035 |         rec_stack[current_node] = True
1036 |         for neighbor in graph.get(current_node, []):
1037 |             if not visited.get(neighbor, False):
1038 |                 if has_cycle(graph, neighbor, visited, rec_stack):
1039 |                     return True
1040 |             elif rec_stack.get(neighbor, False):
1041 |                 return True
1042 |         rec_stack[current_node] = False
1043 |         return False
1044 | 
1045 |     graph = {node["id"]: [d for d in node.get("data", {}).get("dependencies", []) if d in all_ids] for node in nodes}
1046 |     if edges:
1047 |         for edge in edges:
1048 |             target = edge.get("target")
1049 |             source = edge.get("source")
1050 |             if target in graph and source in all_ids:
1051 |                 graph[target].append(source)
1052 | 
1053 |     visited_nodes = {node["id"]: False for node in nodes}
1054 |     for node_id in graph:
1055 |         if not visited_nodes[node_id]:
1056 |             if has_cycle(graph, node_id, visited_nodes, {}):
1057 |                 error_msg = "Circular dependency detected in agent workflow."
1058 |                 yield f"event: text\ndata: {json.dumps('**Validation Error**: ' + error_msg)}\n\n"
1059 |                 yield "event: done\ndata: {}\n\n"
1060 |                 return
1061 | 
1062 |     # Save initial session in DB
1063 |     db.save_session(
1064 |         session_id=session_id,
1065 |         title=prompt[:40] + "..." if len(prompt) > 40 else prompt,
1066 |         prompt=prompt,
1067 |         mode=complexity,
1068 |         nodes=nodes,
1069 |         edges=edges,
1070 |         chat_messages=[],
1071 |         agent_talk_logs=[],
1072 |         execution_state="running",
1073 |         status_message="Running orchestration loop",
1074 |         follow_up_suggestions=follow_up_suggestions
1075 |     )
1076 |     
1077 |     yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1078 | 
1079 |     execution_order = sort_nodes_topologically(nodes, edges)
1080 |     
1081 |     for agent_node in execution_order:
1082 |         node_id = agent_node["id"]
1083 |         agent_data = agent_node["data"]
1084 |         agent_name = agent_data["name"]
1085 |         
1086 |         if not agent_data.get("enabled", True):
1087 |             continue
1088 | 
1089 |         try:
1090 |             # Checkpoint loading
1091 |             checkpoint_state = db.load_checkpoint(session_id, node_id)
1092 |             if checkpoint_state:
1093 |                 agent_results[node_id] = checkpoint_state.get("final_answer", "Completed.")
1094 |                 setup_metadata["agent_talk"].append({
1095 |                     "id": f"agent-log-{node_id}-{now_str()}",
1096 |                     "senderId": node_id,
1097 |                     "senderName": agent_name,
1098 |                     "senderIcon": agent_data["icon"],
1099 |                     "text": checkpoint_state.get("final_answer", "Completed.")[:180],
1100 |                     "timestamp": now_str()
1101 |                 })
1102 |                 continue
1103 | 
1104 |             for n in nodes:
1105 |                 if n["id"] == node_id:
1106 |                     n["data"]["status"] = "ACTIVE"
1107 |             yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1108 |             
1109 |             yield f"event: status\ndata: {json.dumps(f'[{agent_name}] processing...')}\n\n"
1110 |             await asyncio.sleep(0.5)
1111 | 
1112 |             dep_outputs = ""
1113 |             for dep_id in agent_data.get("dependencies", []):
1114 |                 if dep_id in agent_results:
1115 |                     dep_outputs += f"### Input from {dep_id.upper()}:\n{agent_results[dep_id]}\n"
1116 | 
1117 |             memories_context = ""
1118 |             try:
1119 |                 matched_memories = await query_memory(agent_data["objective"], api_key, session_id=session_id, provider=provider)
1120 |                 if matched_memories:
1121 |                     memories_context = "### Relevant Historical Memories:\n" + "\n".join(f"- {m}" for m in matched_memories)
1122 |             except Exception:
1123 |                 pass
1124 | 
1125 |             # Get messages addressed to this agent
1126 |             incoming_msgs = get_messages_for_agent(session_id, node_id)
1127 |             msg_block = ""
1128 |             if incoming_msgs:
1129 |                 msg_block = "### Messages from other agents:\n"
1130 |                 for msg in incoming_msgs:
1131 |                     msg_block += f"- From {msg['from']}: {msg['content']}\n"
1132 |                 # Clear after reading
1133 |                 clear_messages(session_id, node_id)
1134 | 
1135 |             resolved_tools_str = ", ".join(agent_data.get("tools", []))
1136 |             tools_instruction = f"Available tools: {resolved_tools_str}. To use a tool, specify the tool name in 'action' and input in 'action_input'. If you have enough information, set 'action' to 'none' and provide 'final_answer'."
1137 | 
1138 |             agent_history = [{
1139 |                 "role": "user",
1140 |                 "parts": [{"text": f"{tools_instruction}\n\nUser Request: {prompt}\n\n{dep_outputs}\n{memories_context}\n{msg_block}\n\nYour specific objective: {agent_data['objective']}\nPersonality: {agent_data.get('personality', 'Collaborative Specialist')}\nRules: {agent_data['rules']}"}]
1141 |             }]
1142 | 
1143 |             agent_final_answer = "Sub-task completed."
1144 |             action_execution_history = []
1145 |             max_turns = 6 if complexity != "simple" else 3
1146 | 
1147 |             for turn in range(max_turns):
1148 |                 turn_data = {}
1149 |                 action = "none"
1150 |                 observation = ""
1151 |                 try:
1152 |                     standard_history = convert_gemini_history_to_standard(agent_history)
1153 |                     turn_data = await call_provider_json(
1154 |                         provider=provider,
1155 |                         model=model,
1156 |                         api_key=api_key,
1157 |                         messages=standard_history,
1158 |                         system_prompt=agent_data["systemPrompt"],
1159 |                         temperature=0.2,
1160 |                         json_schema=agent_turn_schema,
1161 |                         timeout=30.0,
1162 |                         fallback_provider=fallback_provider,
1163 |                         api_keys=api_keys,
1164 |                         base_url=base_url
1165 |                     )
1166 |                     
1167 |                     thought = turn_data.get("thought", "")
1168 |                     action = turn_data.get("action", "none")
1169 |                     action_input = turn_data.get("action_input", "")
1170 |                     agent_final_answer = turn_data.get("final_answer", "")
1171 |                     
1172 |                     if thought:
1173 |                         yield f"event: thinking\ndata: {json.dumps(f'[{agent_name}]: {thought}\\n')}\n\n"
1174 |                 except Exception as e:
1175 |                     print(f"ReAct Turn fail: {e}")
1176 |                     break
1177 | 
1178 |                 if action == "none" or agent_final_answer:
1179 |                     break
1180 | 
1181 |                 # Circuit Breaker Check
1182 |                 action_execution_history.append((action, action_input))
1183 |                 if action_execution_history.count((action, action_input)) >= 3:
1184 |                     observation = "Circuit Breaker: Tool executed repeatedly with identical input. Halting loop to prevent infinite spend."
1185 |                     yield f"event: status\ndata: {json.dumps(f'[{agent_name}] circuit breaker halted')}\n\n"
1186 |                     agent_history.append({
1187 |                         "role": "model",
1188 |                         "parts": [{"text": json.dumps(turn_data)}]
1189 |                     })
1190 |                     agent_history.append({
1191 |                         "role": "user",
1192 |                         "parts": [{"text": f"Observation: {observation}"}]
1193 |                     })
1194 |                     continue
1195 | 
1196 |                 t_log_id = f"t-log-{int(datetime.datetime.now().timestamp())}"
1197 |                 t_timestamp = now_str()
1198 |                 
1199 |                 permission = agent_data.get("toolPermissions", {}).get(action, "ALLOWED")
1200 |                 
1201 |                 if permission == "ASK":
1202 |                     new_log = {
1203 |                         "id": t_log_id,
1204 |                         "timestamp": t_timestamp,
1205 |                         "tool": action,
1206 |                         "action": "Execution Request",
1207 |                         "status": "PENDING",
1208 |                         "detail": f"Waiting for user to approve execution of '{action_input[:50]}...'"
1209 |                     }
1210 |                     for n in nodes:
1211 |                         if n["id"] == node_id:
1212 |                             n["data"]["toolLogs"] = [new_log] + n["data"].get("toolLogs", [])
1213 |                     yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1214 |                     
1215 |                     db.create_tool_approval(session_id, node_id, action, action_input, t_log_id)
1216 |                     
1217 |                     yield f"event: tool_approval\ndata: {json.dumps({'sessionId': session_id, 'nodeId': node_id, 'toolName': action, 'action': 'Execution Approval Required', 'detail': action_input[:100], 'logId': t_log_id})}\n\n"
1218 |                     yield f"event: status\ndata: {json.dumps(f'[{agent_name}] waiting for approval to run [{action}]')}\n\n"
1219 | 
1220 |                     # Poll database for verdict (with 120s timeout)
1221 |                     approval_start = time.time()
1222 |                     APPROVAL_TIMEOUT = 120
1223 |                     while True:
1224 |                         approval_status = db.get_tool_approval(session_id, node_id, action, t_log_id)
1225 |                         if approval_status in ["approved", "denied"]:
1226 |                             permission = "ALLOWED" if approval_status == "approved" else "DENIED"
1227 |                             break
1228 |                         if time.time() - approval_start > APPROVAL_TIMEOUT:
1229 |                             permission = "DENIED"
1230 |                             db.update_tool_approval(session_id, node_id, action, t_log_id, "denied")
1231 |                             yield f"event: status\ndata: {json.dumps(f'[{agent_name}] approval timed out, auto-denied')}\n\n"
1232 |                             break
1233 |                         await asyncio.sleep(0.5)
1234 |                     
1235 |                     if permission == "ALLOWED":
1236 |                         for n in nodes:
1237 |                             if n["id"] == node_id:
1238 |                                 n["data"]["toolLogs"] = [{**new_log, "status": "SUCCESS", "detail": f"Approved: {action_input[:50]}"}] + n["data"].get("toolLogs", [])[1:]
1239 |                     else:
1240 |                         for n in nodes:
1241 |                             if n["id"] == node_id:
1242 |                                 n["data"]["toolLogs"] = [{**new_log, "status": "BLOCKED", "detail": "Blocked by user."}] + n["data"].get("toolLogs", [])[1:]
1243 | 
1244 |                 if permission == "ALLOWED":
1245 |                     yield f"event: status\ndata: {json.dumps(f'[{agent_name}] executing [{action}]')}\n\n"
1246 |                     
1247 |                     if action == "web_search":
1248 |                         observation = await execute_web_search(action_input)
1249 |                     elif action == "browse_web":
1250 |                         observation = await execute_web_browse(action_input)
1251 |                     elif action == "execute_code":
1252 |                         observation = await execute_python_code(action_input)
1253 |                     elif action == "api_call":
1254 |                         observation = await execute_api_call(action_input)
1255 |                     elif action == "query_memory":
1256 |                         mem_res = await query_memory(action_input, api_key, session_id=session_id, provider=provider)
1257 |                         observation = "\n".join(mem_res) if mem_res else "No matches found."
1258 |                     elif action == "store_memory":
1259 |                         await store_memory(node_id, action_input, api_key, session_id, provider=provider)
1260 |                         observation = "Saved successfully."
1261 |                     elif action == "send_message":
1262 |                         parts = action_input.split("|", 1)
1263 |                         if len(parts) == 2:
1264 |                             target_agent, content = parts
1265 |                             post_message(session_id, node_id, target_agent, content)
1266 |                             observation = f"Message sent to {target_agent}."
1267 |                         else:
1268 |                             observation = "Invalid send_message format. Use 'target|content'."
1269 |                     elif action in ["analyze_image", "read_file"]:
1270 |                         observation = f"{action} is not yet available in this deployment."
1271 |                     else:
1272 |                         observation = "Mock tool result."
1273 |                     
1274 |                     success_log = {
1275 |                         "id": t_log_id,
1276 |                         "timestamp": now_str(),
1277 |                         "tool": action,
1278 |                         "action": "Call",
1279 |                         "status": "SUCCESS",
1280 |                         "detail": f"Ran tool with inputs: '{action_input[:50]}' -> Output: {observation[:100]}..."
1281 |                     }
1282 |                     for n in nodes:
1283 |                         if n["id"] == node_id:
1284 |                             logs_filtered = [l for l in n["data"].get("toolLogs", []) if l["id"] != t_log_id]
1285 |                             n["data"]["toolLogs"] = [success_log] + logs_filtered
1286 |                 else:
1287 |                     observation = "Execution Blocked: Permission Denied."
1288 |                 
1289 |                 yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1290 |                 
1291 |                 agent_history.append({
1292 |                     "role": "model",
1293 |                     "parts": [{"text": json.dumps(turn_data)}]
1294 |                 })
1295 |                 agent_history.append({
1296 |                     "role": "user",
1297 |                     "parts": [{"text": f"Observation: {observation}"}]
1298 |                 })
1299 | 
1300 |             # Check if agent outcome is default / empty
1301 |             if not agent_final_answer or agent_final_answer.strip() in ["Sub-task completed.", ""]:
1302 |                 synthesis_prompt = f"Based on your objective '{agent_data['objective']}' and the ReAct steps executed, write a concise summary/result of your sub-task."
1303 |                 agent_history.append({"role": "user", "parts": [{"text": synthesis_prompt}]})
1304 |                 try:
1305 |                     synth_text = await call_provider(
1306 |                         provider=provider,
1307 |                         model=model,
1308 |                         api_key=api_key,
1309 |                         messages=convert_gemini_history_to_standard(agent_history),
1310 |                         system_prompt=agent_data["systemPrompt"],
1311 |                         temperature=0.3,
1312 |                         timeout=15.0,
1313 |                         fallback_provider=fallback_provider,
1314 |                         api_keys=api_keys,
1315 |                         base_url=base_url
1316 |                     )
1317 |                     if synth_text:
1318 |                         agent_final_answer = synth_text
1319 |                 except Exception:
1320 |                     pass
1321 | 
1322 |             agent_results[node_id] = agent_final_answer or "Sub-task completed."
1323 |             
1324 |             # Save state checkpoint
1325 |             db.save_checkpoint(session_id, node_id, {"final_answer": agent_final_answer})
1326 |             
1327 |             for n in nodes:
1328 |                 if n["id"] == node_id:
1329 |                     n["data"]["status"] = "IDLE"
1330 |             
1331 |             setup_metadata["agent_talk"].append({
1332 |                 "id": f"agent-log-{node_id}-{now_str()}",
1333 |                 "senderId": node_id,
1334 |                 "senderName": agent_name,
1335 |                 "senderIcon": agent_data["icon"],
1336 |                 "text": agent_final_answer[:180] + "..." if len(agent_final_answer) > 180 else agent_final_answer,
1337 |                 "timestamp": now_str()
1338 |             })
1339 |             yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1340 |             
1341 |             # Only store outcome memory if meaningful
1342 |             if agent_final_answer and len(agent_final_answer) > 40 and agent_final_answer != "Sub-task completed.":
1343 |                 try:
1344 |                     memory_text = f"Objective: {agent_data['objective']}\nOutcome: {agent_final_answer[:500]}"
1345 |                     await store_memory(node_id, memory_text, api_key, session_id, provider=provider)
1346 |                 except Exception:
1347 |                     pass
1348 |         except Exception as e:
1349 |             print(f"[AGENT ERROR] {agent_name} failed: {e}")
1350 |             agent_results[node_id] = f"Agent encountered an error: {str(e)[:200]}"
1351 |             for n in nodes:
1352 |                 if n["id"] == node_id:
1353 |                     n["data"]["status"] = "ERROR"
1354 |             setup_metadata["agent_talk"].append({
1355 |                 "id": f"agent-log-{node_id}-error-{now_str()}",
1356 |                 "senderId": node_id,
1357 |                 "senderName": agent_name,
1358 |                 "senderIcon": agent_data["icon"],
1359 |                 "text": f"⚠ Failed: {str(e)[:150]}",
1360 |                 "timestamp": now_str()
1361 |             })
1362 |             yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1363 |             continue
1364 | 
1365 |     if complexity == "simple" and not agent_results:
1366 |         agent_results["general"] = "Processed the request, but no specific output was generated."
1367 | 
1368 |     yield f"event: status\ndata: {json.dumps('Synthesizing final response...')}\n\n"
1369 | 
1370 |     # Build aggregator prompt — inject relevant memory + agent results
1371 |     aggregator_prompt = ""
1372 |     try:
1373 |         memory_hits = await query_memory(prompt, api_key, top_k=3, agent_id=None, session_id=session_id, provider=provider)
1374 |         if memory_hits:
1375 |             aggregator_prompt += "### Relevant context from past conversation:\n" + "\n".join(f"- {m}" for m in memory_hits) + "\n\n"
1376 |     except Exception:
1377 |         pass
1378 | 
1379 |     if agent_results:
1380 |         aggregator_prompt += "### Analysis context:\n"
1381 |         for _nid, result in agent_results.items():
1382 |             aggregator_prompt += f"{result}\n\n"
1383 | 
1384 |     aggregator_prompt += f"\nUser's current message: {prompt}"
1385 | 
1386 |     # Fallback if aggregator prompt is empty
1387 |     if not aggregator_prompt.strip():
1388 |         aggregator_prompt = f"Answer the following user request concisely and helpfully:\n\n{prompt}"
1389 | 
1390 |     # Build full conversation history for aggregator so it has cross-turn context
1391 |     aggregator_contents = []
1392 |     if history:
1393 |         for msg in history:
1394 |             role = "user" if msg.sender == "user" else "model"
1395 |             aggregator_contents.append({"role": role, "parts": [{"text": msg.text}]})
1396 |     aggregator_contents.append({"role": "user", "parts": [{"text": aggregator_prompt}]})
1397 | 
1398 |     final_synthesis_text = ""
1399 |     try:
1400 |         async for token in stream_provider(
1401 |             provider=provider,
1402 |             model=model,
1403 |             api_key=api_key,
1404 |             messages=convert_gemini_history_to_standard(aggregator_contents),
1405 |             system_prompt=RESPONSE_SYSTEM_INSTRUCTION,
1406 |             temperature=0.7,
1407 |             timeout=90.0,
1408 |             fallback_provider=fallback_provider,
1409 |             api_keys=api_keys,
1410 |             base_url=base_url
1411 |         ):
1412 |             final_synthesis_text += token
1413 |             yield f"event: text\ndata: {json.dumps(token)}\n\n"
1414 |     except Exception as exc:
1415 |         err_msg = f"\n\n*Stream Synthesis Error: {str(exc)}*\n\n"
1416 |         yield f"event: text\ndata: {json.dumps(err_msg)}\n\n"
1417 |         final_synthesis_text = err_msg
1418 | 
1419 |     print(f"[DEBUG] final_synthesis_text length: {len(final_synthesis_text)}")
1420 |     if not final_synthesis_text:
1421 |         print("[ERROR] Aggregator produced empty response")
1422 | 
1423 |     # Save complete session data
1424 |     final_chat_messages = []
1425 |     if history:
1426 |         for msg in history:
1427 |             final_chat_messages.append({"id": f"msg-{id(msg)}", "sender": msg.sender, "text": msg.text, "timestamp": ""})
1428 |     final_chat_messages.append({"id": "user-prompt", "sender": "user", "text": prompt, "timestamp": now_str()})
1429 |     final_chat_messages.append({"id": "ai-response", "sender": "ai", "text": final_synthesis_text, "timestamp": now_str()})
1430 | 
1431 |     db.save_session(
1432 |         session_id=session_id,
1433 |         title=prompt[:40] + "..." if len(prompt) > 40 else prompt,
1434 |         prompt=prompt,
1435 |         mode=complexity,
1436 |         nodes=nodes,
1437 |         edges=edges,
1438 |         chat_messages=final_chat_messages,
1439 |         agent_talk_logs=setup_metadata["agent_talk"],
1440 |         execution_state="setup",
1441 |         status_message="Execution completed",
1442 |         follow_up_suggestions=follow_up_suggestions
1443 |     )
1444 | 
1445 |     # Cache final response
1446 |     cached_val = {
1447 |         "metadata": {
1448 |             "complexity": complexity,
1449 |             "capabilities": capabilities,
1450 |             "thinking_summary": thinking_summary,
1451 |             "nodes": nodes,
1452 |             "edges": edges,
1453 |             "agent_talk": setup_metadata["agent_talk"],
1454 |             "follow_up_suggestions": follow_up_suggestions
1455 |         },
1456 |         "text": final_synthesis_text
1457 |     }
1458 |     
1459 |     # Compute embeddings inside
1460 |     try:
1461 |         prompt_embedding = await get_embedding(provider, api_key, prompt, api_keys=api_keys)
1462 |         if prompt_embedding:
1463 |             prompt_hash_overall = hashlib.sha256(prompt.encode('utf-8')).hexdigest()
1464 |             db.save_cached_response(prompt_hash_overall, prompt, prompt_embedding, cached_val)
1465 |     except Exception:
1466 |         pass
1467 | 
1468 |     # Auto-store this full conversation turn in vector memory for cross-turn recall
1469 |     if final_synthesis_text:
1470 |         try:
1471 |             convo_memory = f"User: {prompt}\nAssistant: {final_synthesis_text[:800]}"
1472 |             await store_memory(f"session_{session_id}", convo_memory, api_key, session_id, provider=provider)
1473 |         except Exception:
1474 |             pass
1475 | 
1476 |     yield "event: done\ndata: {}\n\n"
1477 | 
1478 | @app.post("/execute_custom")
1479 | async def execute_custom(req: ExecuteCustomRequest):
1480 |     provider_config = get_provider_config(req.provider)
1481 |     api_key = resolve_api_key(req.provider, req.api_key, req.api_keys)
1482 |     if not api_key and not provider_config.get("is_local", False):
1483 |         raise HTTPException(
1484 |             status_code=400,
1485 |             detail=f"API Key for provider '{req.provider}' is missing. Please configure BYOK in Settings."
1486 |         )
1487 | 
1488 |     complexity = "simple" if len(req.nodes) == 1 and req.nodes[0]["id"] == "general" else "custom"
1489 |     capabilities = [n["data"].get("tag", "CUSTOM") for n in req.nodes]
1490 |     
1491 |     return StreamingResponse(
1492 |         run_agent_execution_loop(
1493 |             session_id=req.session_id,
1494 |             prompt=req.prompt,
1495 |             history=req.history or [],
1496 |             api_key=api_key,
1497 |             nodes=req.nodes,
1498 |             edges=req.edges,
1499 |             complexity=complexity,
1500 |             capabilities=capabilities,
1501 |             thinking_summary="Running customized agent workflow",
1502 |             follow_up_suggestions=["Can you explain the agent collaboration?"],
1503 |             provider=req.provider,
1504 |             model=req.model,
1505 |             fallback_provider=req.fallback_provider,
1506 |             api_keys=req.api_keys,
1507 |             base_url=req.base_url
1508 |         ),
1509 |         media_type="text/event-stream"
1510 |     )
1511 | 
1512 |
```

### File: `Backend/main.py`

> 1512 lines | 62.5 KB

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
  28 |     fetch_models_from_provider,
  29 |     get_provider_config,
  30 | )
  31 | 
  32 | 
  33 | # Initialize database
  34 | db.init_db()
  35 | 
  36 | app = FastAPI(title="Solospace Python Orchestrator API")
  37 | 
  38 | # Allow Next.js frontend to reach this API (critical on Windows / localhost dev)
  39 | app.add_middleware(
  40 |     CORSMiddleware,
  41 |     allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
  42 |     allow_credentials=True,
  43 |     allow_methods=["*"],
  44 |     allow_headers=["*"],
  45 | )
  46 | 
  47 | # Track by IP for Rate Limiting
  48 | ip_rate_limits = {}
  49 | 
  50 | @app.middleware("http")
  51 | async def ip_rate_limit_middleware(request: Request, call_next):
  52 |     if request.method == "OPTIONS":
  53 |         return await call_next(request)
  54 |         
  55 |     client_ip = request.client.host if request.client else "unknown"
  56 |     
  57 |     if client_ip not in ip_rate_limits:
  58 |         ip_rate_limits[client_ip] = {"count": 0, "window_start": time.time()}
  59 |     
  60 |     info = ip_rate_limits[client_ip]
  61 |     now = time.time()
  62 |     
  63 |     # Reset window every 60 seconds
  64 |     if now - info["window_start"] > 60:
  65 |         info["count"] = 0
  66 |         info["window_start"] = now
  67 |     
  68 |     info["count"] += 1
  69 |     
  70 |     # Max 40 requests per minute per IP
  71 |     if info["count"] > 40:
  72 |         return JSONResponse(
  73 |             status_code=429,
  74 |             content={"detail": "Rate limit exceeded. Please wait before making more requests."}
  75 |         )
  76 |     
  77 |     return await call_next(request)
  78 | 
  79 | # Global coordination states
  80 | MEMORY_FILE = "memory_store.json"
  81 | 
  82 | class Message(BaseModel):
  83 |     sender: str
  84 |     text: str
  85 | 
  86 | class OrchestrateRequest(BaseModel):
  87 |     prompt: str
  88 |     history: Optional[List[Message]] = []
  89 |     api_key: Optional[str] = None
  90 |     session_id: Optional[str] = None
  91 |     execute_agents: bool = True
  92 |     provider: str = "gemini"
  93 |     model: Optional[str] = None
  94 |     fallback_provider: Optional[str] = None
  95 |     api_keys: Optional[Dict[str, str]] = None
  96 |     base_url: Optional[str] = None
  97 | 
  98 | class ApprovalRequest(BaseModel):
  99 |     sessionId: str
 100 |     nodeId: str
 101 |     toolName: str
 102 |     action: str  # "approve" or "deny"
 103 | 
 104 | class ExecuteCustomRequest(BaseModel):
 105 |     session_id: str
 106 |     api_key: str
 107 |     nodes: List[Dict[str, Any]]
 108 |     edges: List[Dict[str, Any]]
 109 |     prompt: str
 110 |     history: Optional[List[Message]] = []
 111 |     provider: str = "gemini"
 112 |     model: Optional[str] = None
 113 |     fallback_provider: Optional[str] = None
 114 |     api_keys: Optional[Dict[str, str]] = None
 115 |     base_url: Optional[str] = None
 116 | 
 117 | # ─── VECTOR DB MEMORY STORE (Multi-Provider Embeddings + Local Cosine Similarity) ───
 118 | 
 119 | async def get_gemini_embedding(text: str, api_key: str) -> List[float]:
 120 |     return await get_embedding("gemini", api_key, text)
 121 | 
 122 | def cosine_similarity(v1: List[float], v2: List[float]) -> float:
 123 |     if not v1 or not v2 or len(v1) != len(v2):
 124 |         return 0.0
 125 |     dot = sum(a * b for a, b in zip(v1, v2))
 126 |     norm1 = math.sqrt(sum(a * a for a in v1))
 127 |     norm2 = math.sqrt(sum(b * b for b in v2))
 128 |     if norm1 == 0.0 or norm2 == 0.0:
 129 |         return 0.0
 130 |     return dot / (norm1 * norm2)
 131 | 
 132 | # Bug 7: Thread-safe memory I/O lock
 133 | memory_lock = threading.Lock()
 134 | 
 135 | def load_memories() -> List[Dict[str, Any]]:
 136 |     with memory_lock:
 137 |         if os.path.exists(MEMORY_FILE):
 138 |             try:
 139 |                 with open(MEMORY_FILE, "r") as f:
 140 |                     return json.load(f)
 141 |             except Exception:
 142 |                 pass
 143 |     return []
 144 | 
 145 | def save_memories(memories: List[Dict[str, Any]]):
 146 |     with memory_lock:
 147 |         try:
 148 |             with open(MEMORY_FILE, "w") as f:
 149 |                 json.dump(memories, f, indent=2)
 150 |         except Exception as e:
 151 |             print(f"[MEMORY ERROR] Saving file failed: {e}")
 152 | 
 153 | MAX_MEMORIES = 200  # Bug 8: Cap total entries to prevent unbounded growth
 154 | 
 155 | async def store_memory(agent_id: str, text: str, api_key: str, session_id: str = None, provider: str = "gemini"):
 156 |     embedding = await get_embedding(provider, api_key, text)
 157 |     if not embedding:
 158 |         return
 159 |     memories = load_memories()
 160 |     entry = {
 161 |         "agent_id": agent_id,
 162 |         "text": text,
 163 |         "embedding": embedding,
 164 |         "timestamp": datetime.datetime.now().isoformat()
 165 |     }
 166 |     if session_id:
 167 |         entry["session_id"] = session_id
 168 |     memories.append(entry)
 169 | 
 170 |     # Bug 8: Evict oldest entries if over limit
 171 |     if len(memories) > MAX_MEMORIES:
 172 |         memories = memories[-MAX_MEMORIES:]
 173 | 
 174 |     save_memories(memories)
 175 | 
 176 | async def query_memory(query: str, api_key: str, top_k=2, agent_id: Optional[str] = None, session_id: Optional[str] = None, provider: str = "gemini") -> List[str]:
 177 |     embedding = await get_embedding(provider, api_key, query)
 178 |     if not embedding:
 179 |         return []
 180 |     memories = load_memories()
 181 |     scored = []
 182 |     for m in memories:
 183 |         if agent_id is not None:
 184 |             # Match directly or by session prefix
 185 |             if m.get("agent_id") != agent_id and not (agent_id.startswith("session_") and m.get("session_id") == agent_id[8:]):
 186 |                 continue
 187 |         if session_id is not None and m.get("session_id") != session_id:
 188 |             continue
 189 |         sim = cosine_similarity(embedding, m["embedding"])
 190 |         scored.append((sim, m["text"]))
 191 |     
 192 |     scored.sort(key=lambda x: x[0], reverse=True)
 193 |     return [text for sim, text in scored[:top_k] if sim > 0.45]
 194 | 
 195 | 
 196 | # ─── REAL AGENT TOOLS ───
 197 | 
 198 | async def execute_web_search(query: str) -> str:
 199 |     headers = {
 200 |         "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
 201 |     }
 202 |     url = f"https://html.duckduckgo.com/html/?q={query}"
 203 |     async with httpx.AsyncClient() as client:
 204 |         try:
 205 |             r = await client.get(url, headers=headers, timeout=15.0)
 206 |             if r.status_code == 200:
 207 |                 soup = BeautifulSoup(r.text, "html.parser")
 208 |                 snippets = []
 209 |                 for div in soup.find_all("a", class_="result__snippet")[:3]:
 210 |                     snippets.append(div.get_text().strip())
 211 |                 if snippets:
 212 |                     return "\n".join(snippets)
 213 |         except Exception as e:
 214 |             return f"Search failed: {str(e)}"
 215 |     return f"No search results found for query: '{query}'."
 216 | 
 217 | async def execute_web_browse(url: str) -> str:
 218 |     """Fetch and extract text content from a URL."""
 219 |     headers = {
 220 |         "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
 221 |     }
 222 |     from urllib.parse import urlparse
 223 |     import socket
 224 |     BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254"}
 225 |     ALLOWED_SCHEMES = {"http", "https"}
 226 |     try:
 227 |         parsed = urlparse(url)
 228 |         if parsed.scheme not in ALLOWED_SCHEMES:
 229 |             return f"Error: Scheme '{parsed.scheme}' not allowed. Use http/https."
 230 |         hostname = parsed.hostname
 231 |         if not hostname:
 232 |             return "Error: Invalid URL provided."
 233 |         if hostname.lower() in BLOCKED_HOSTS:
 234 |             return "Error: Access to internal/local addresses is blocked."
 235 |         try:
 236 |             ip_str = socket.gethostbyname(hostname)
 237 |             # Bug 12: Use ipaddress module for complete private IP detection
 238 |             ip_obj = ipaddress.ip_address(ip_str)
 239 |             if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
 240 |                 return "Error: Access to internal/local addresses is blocked."
 241 |         except ValueError:
 242 |             pass  # Not a valid IP string after DNS resolve, allow
 243 |         except Exception:
 244 |             pass
 245 |     except Exception as e:
 246 |         return f"Error: Invalid URL - {str(e)}"
 247 | 
 248 |     async with httpx.AsyncClient() as client:
 249 |         try:
 250 |             r = await client.get(url, headers=headers, timeout=15.0, follow_redirects=True)
 251 |             if r.status_code == 200:
 252 |                 soup = BeautifulSoup(r.text, "html.parser")
 253 |                 for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
 254 |                     tag.decompose()
 255 |                 text = soup.get_text(separator="\n", strip=True)
 256 |                 return text[:3000]
 257 |             return f"Browse failed with status {r.status_code}"
 258 |         except Exception as e:
 259 |             return f"Browse error: {str(e)}"
 260 | 
 261 | async def execute_python_code(code: str) -> str:
 262 |     import tempfile
 263 |     
 264 |     SANDBOX_HEADER = """
 265 | import sys
 266 | import os
 267 | import tempfile
 268 | 
 269 | # Block network access
 270 | import socket
 271 | socket.socket = lambda *a, **k: None
 272 | 
 273 | # Restrict file access to temp dir only
 274 | _original_open = open
 275 | def _restricted_open(name, *args, **kwargs):
 276 |     temp_dir = os.path.abspath(tempfile.gettempdir())
 277 |     resolved_path = os.path.abspath(str(name))
 278 |     if not resolved_path.startswith(temp_dir):
 279 |         raise PermissionError(f"Access denied: {name}")
 280 |     return _original_open(name, *args, **kwargs)
 281 | 
 282 | # Keep restricted open and delete original dangerous builtins
 283 | __builtins__.open = _restricted_open
 284 | if 'eval' in __builtins__.__dict__:
 285 |     del __builtins__.__dict__['eval']
 286 | if 'exec' in __builtins__.__dict__:
 287 |     del __builtins__.__dict__['exec']
 288 | if 'compile' in __builtins__.__dict__:
 289 |     del __builtins__.__dict__['compile']
 290 | if '__import__' in __builtins__.__dict__:
 291 |     del __builtins__.__dict__['__import__']
 292 | """
 293 | 
 294 |     sandboxed_code = SANDBOX_HEADER + "\n" + code
 295 | 
 296 |     # Create a temp file to execute the code safely
 297 |     with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
 298 |         f.write(sandboxed_code)
 299 |         temp_path = f.name
 300 | 
 301 |     try:
 302 |         env = os.environ.copy()
 303 |         env.pop('GEMINI_API_KEY', None)  # Never expose API key
 304 |         env.pop('DATABASE_URL', None)
 305 | 
 306 |         p = subprocess.Popen(
 307 |             [sys.executable, temp_path],
 308 |             stdout=subprocess.PIPE,
 309 |             stderr=subprocess.PIPE,
 310 |             text=True,
 311 |             cwd=tempfile.gettempdir(),
 312 |             env=env
 313 |         )
 314 | 
 315 |         try:
 316 |             stdout, stderr = p.communicate(timeout=15.0)  # Reduced timeout
 317 |         except subprocess.TimeoutExpired:
 318 |             p.kill()
 319 |             return "Error: Code execution timed out (15s limit)."
 320 | 
 321 |         output = ""
 322 |         if stdout:
 323 |             output += f"STDOUT:\n{stdout[:2000]}\n"  # Limit output size
 324 |         if stderr:
 325 |             output += f"STDERR:\n{stderr[:1000]}\n"
 326 |         if not output:
 327 |             output = "Code executed successfully with no output."
 328 |         return output
 329 |     except Exception as e:
 330 |         return f"Execution error: {str(e)}"
 331 |     finally:
 332 |         try:
 333 |             os.unlink(temp_path)
 334 |         except Exception:
 335 |             pass
 336 | 
 337 | async def execute_api_call(url: str, method: str = "GET", payload_json: Optional[str] = None) -> str:
 338 |     from urllib.parse import urlparse
 339 |     import socket
 340 |     
 341 |     BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254"}
 342 |     ALLOWED_SCHEMES = {"http", "https"}
 343 |     
 344 |     try:
 345 |         parsed = urlparse(url)
 346 |         if parsed.scheme not in ALLOWED_SCHEMES:
 347 |             return f"Error: Scheme '{parsed.scheme}' not allowed. Use http/https."
 348 |         hostname = parsed.hostname
 349 |         if not hostname:
 350 |             return "Error: Invalid URL provided."
 351 |         
 352 |         # Prevent SSRF
 353 |         if hostname.lower() in BLOCKED_HOSTS:
 354 |             return "Error: Access to internal/local addresses is blocked."
 355 |             
 356 |         try:
 357 |             ip_str = socket.gethostbyname(hostname)
 358 |             # Bug 12: Use ipaddress module for complete private IP detection
 359 |             ip_obj = ipaddress.ip_address(ip_str)
 360 |             if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
 361 |                 return "Error: Access to internal/local addresses is blocked."
 362 |         except ValueError:
 363 |             pass  # Not a valid IP string, allow
 364 |         except Exception:
 365 |             pass
 366 |     except Exception as e:
 367 |         return f"Error: Invalid URL - {str(e)}"
 368 | 
 369 |     async with httpx.AsyncClient() as client:
 370 |         try:
 371 |             if method.upper() == "POST":
 372 |                 data = json.loads(payload_json) if payload_json else {}
 373 |                 r = await client.post(url, json=data, timeout=15.0)
 374 |             else:
 375 |                 r = await client.get(url, timeout=15.0)
 376 |             return f"Status: {r.status_code}\nResponse: {r.text[:1500]}"
 377 |         except Exception as e:
 378 |             return f"API call failed: {str(e)}"
 379 | 
 380 | # ─── AGENT COORDINATOR DAG SORT ───
 381 | 
 382 | def sort_nodes_topologically(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
 383 |     """Sort nodes using both explicit dependencies AND visual edges."""
 384 |     visited = set()
 385 |     sorted_nodes = []
 386 |     node_dict = {n["id"]: n for n in nodes}
 387 |     
 388 |     # Build dependency graph from both sources
 389 |     dep_graph = {n["id"]: set(n["data"].get("dependencies", [])) for n in nodes}
 390 |     
 391 |     # Also add edges as dependencies
 392 |     if edges:
 393 |         for edge in edges:
 394 |             target = edge.get("target")
 395 |             source = edge.get("source")
 396 |             if target in dep_graph and source in node_dict:
 397 |                 dep_graph[target].add(source)
 398 | 
 399 |     def visit(node_id):
 400 |         if node_id in visited:
 401 |             return
 402 |         visited.add(node_id)
 403 |         for dep in dep_graph.get(node_id, set()):
 404 |             if dep in node_dict:
 405 |                 visit(dep)
 406 |         if node_id in node_dict:
 407 |             sorted_nodes.append(node_dict[node_id])
 408 | 
 409 |     for node in nodes:
 410 |         visit(node["id"])
 411 |     return sorted_nodes
 412 | 
 413 | # ─── ORCHESTRATION SYSTEM INSTRUCTIONS ───
 414 | 
 415 | ORCHESTRATOR_SYSTEM_INSTRUCTION = """
 416 | You are Solospace, an elite workflow orchestrator. Your ONLY job is to analyze the user's request and output a JSON list of specialized agents.
 417 | 
 418 | CRITICAL RULES:
 419 | - For ANY request that involves building, designing, integrating, or researching a non‑trivial system, you MUST output at least 2 agents.
 420 | - For requests that mention multiple domains (e.g., frontend + backend + database), use 3‑6 agents.
 421 | - Only output a SINGLE agent ("general") for extremely simple questions like "Hello", "What is AI?", or one‑line explanations.
 422 | - Classify the complexity field in the JSON schema as "complex" if the user asks to build, design, integrate, or analyze a system with 2+ distinct components (frontend, backend, database, payments, auth, research). If in doubt, prefer "complex" over "simple".
 423 | 
 424 | AGENT CREATION:
 425 | You can use any senderId, not only the built‑in list. Define custom agents freely.
 426 | Every agent MUST have:
 427 | - senderId: a unique short identifier (e.g., "frontend_ui", "payment_gateway", "data_analyst").
 428 | - senderName: a human readable name.
 429 | - senderIcon: "code", "science", or "trending_up".
 430 | - text: what this agent will contribute.
 431 | - objective: specific goal for this agent.
 432 | - systemPrompt: detailed instructions for the agent.
 433 | - rules: 2‑3 specific constraints.
 434 | - dependencies: list of other agent ids this agent needs.
 435 | - tools: choose from ["Web Search", "Memory", "Code Executor", "Browser", "API Connector"].
 436 | 
 437 | EXAMPLES:
 438 | 1. User: "Build a full‑stack SaaS with Next.js, Stripe payments, and PostgreSQL"
 439 |    → Output agents: frontend_ui, backend_api, database_admin, payment_integrator (4 agents).
 440 | 
 441 | 2. User: "Explain how JWT works"
 442 |    → Output agents: general (1 agent).
 443 | 
 444 | 3. User: "Research AI trends and write a summary"
 445 |    → Output agents: researcher, writer (2 agents).
 446 | 
 447 | Respond ONLY with a valid JSON object matching the provided schema.
 448 | """
 449 | 
 450 | orchestration_schema = {
 451 |     "type": "OBJECT",
 452 |     "properties": {
 453 |         "complexity": {
 454 |             "type": "STRING",
 455 |             "enum": ["simple", "medium", "complex"]
 456 |         },
 457 |         "capabilities": {
 458 |             "type": "ARRAY",
 459 |             "items": {"type": "STRING"}
 460 |         },
 461 |         "thinking_summary": {
 462 |             "type": "STRING"
 463 |         },
 464 |         "follow_up_suggestions": {
 465 |             "type": "ARRAY",
 466 |             "items": {"type": "STRING"}
 467 |         },
 468 |         "agent_talk": {
 469 |             "type": "ARRAY",
 470 |             "items": {
 471 |                 "type": "OBJECT",
 472 |                 "properties": {
 473 |                     "senderId": {"type": "STRING"},
 474 |                     "senderName": {"type": "STRING"},
 475 |                     "senderIcon": {"type": "STRING"},
 476 |                     "text": {"type": "STRING"},
 477 |                     "objective": {"type": "STRING"},
 478 |                     "systemPrompt": {"type": "STRING"},
 479 |                     "rules": {
 480 |                         "type": "ARRAY",
 481 |                         "items": {"type": "STRING"}
 482 |                     },
 483 |                     "dependencies": {
 484 |                         "type": "ARRAY",
 485 |                         "items": {"type": "STRING"}
 486 |                     },
 487 |                     "tools": {
 488 |                         "type": "ARRAY",
 489 |                         "items": {"type": "STRING"}
 490 |                     },
 491 |                     "custom_template": {
 492 |                         "type": "OBJECT",
 493 |                         "properties": {
 494 |                             "name": {"type": "STRING"},
 495 |                             "icon": {"type": "STRING"},
 496 |                             "tag": {"type": "STRING"},
 497 |                             "temp": {"type": "NUMBER"},
 498 |                             "logic": {"type": "INTEGER"},
 499 |                             "col": {"type": "INTEGER"}
 500 |                         },
 501 |                         "required": ["name", "icon", "tag", "temp", "logic", "col"]
 502 |                     }
 503 |                 },
 504 |                 "required": ["senderId", "senderName", "senderIcon", "text", "objective", "systemPrompt", "rules", "dependencies", "tools"]
 505 |             }
 506 |         }
 507 |     },
 508 |     "required": ["complexity", "capabilities", "thinking_summary", "agent_talk", "follow_up_suggestions"]
 509 | }
 510 | 
 511 | # Real-time ReAct loop action schema for agents
 512 | agent_turn_schema = {
 513 |     "type": "OBJECT",
 514 |     "properties": {
 515 |         "thought": {"type": "STRING"},
 516 |         "action": {
 517 |             "type": "STRING",
 518 |             "enum": ["none", "web_search", "execute_code", "api_call", "query_memory", "store_memory", "send_message", "browse_web", "analyze_image", "read_file"]
 519 |         },
 520 |         "action_input": {"type": "STRING"},
 521 |         "final_answer": {"type": "STRING"}
 522 |     },
 523 |     "required": ["thought", "action"]
 524 | }
 525 | 
 526 | 
 527 | RESPONSE_SYSTEM_INSTRUCTION = """
 528 | You are Solospace, an elite assistant.
 529 | Your job is to produce a clean, direct response to the user's prompt using the provided context.
 530 | 
 531 | STRICT RULES — NEVER VIOLATE:
 532 | - Do NOT include any preamble, header, or status line such as "[Agent processing...]", "Synthesizing...", "From the agent team:", or similar.
 533 | - Do NOT mention agents, sub-tasks, specialists, orchestration, or internal workflow mechanics.
 534 | - Do NOT start your response with any markdown header that references processing steps.
 535 | - Begin your response immediately and directly with the answer.
 536 | - Use clean, well-structured markdown only when it genuinely helps the user.
 537 | - For conversational messages (e.g. greetings), reply naturally and concisely without any structure.
 538 | """
 539 | 
 540 | GEMINI_SAFETY_SETTINGS = [
 541 |     {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
 542 |     {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
 543 |     {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
 544 |     {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"}
 545 | ]
 546 | 
 547 | def check_guardrails(prompt: str) -> Optional[str]:
 548 |     jailbreak_keywords = [
 549 |         "ignore previous instructions", "ignore all instructions", "override system prompt",
 550 |         "you are now developer mode", "jailbreak"
 551 |     ]
 552 |     for keyword in jailbreak_keywords:
 553 |         if keyword in prompt.lower():
 554 |             return "Safety Alert: Input contains potential prompt injection or system instruction bypass."
 555 |     return None
 556 | 
 557 | MAX_TOKENS = 100000.0
 558 | REFILL_RATE = 100.0
 559 | 
 560 | def check_rate_limit(session_id: str, prompt_len: int) -> bool:
 561 |     limit_info = db.get_rate_limit(session_id)
 562 |     now = datetime.datetime.now()
 563 |     
 564 |     if not limit_info:
 565 |         tokens = MAX_TOKENS
 566 |     else:
 567 |         try:
 568 |             last_updated = datetime.datetime.fromisoformat(limit_info["last_updated"])
 569 |             elapsed = (now - last_updated).total_seconds()
 570 |             tokens = min(MAX_TOKENS, limit_info["tokens_remaining"] + elapsed * REFILL_RATE)
 571 |         except Exception:
 572 |             tokens = MAX_TOKENS
 573 |     
 574 |     estimated_tokens = prompt_len / 3.0
 575 |     
 576 |     if tokens < estimated_tokens:
 577 |         return False
 578 |         
 579 |     tokens -= estimated_tokens
 580 |     db.update_rate_limit(session_id, tokens)
 581 |     return True
 582 | 
 583 | @app.post("/approve")
 584 | async def approve_tool(req: ApprovalRequest):
 585 |     status = "approved" if req.action == "approve" else "denied"
 586 |     
 587 |     # Update SQLite database tool approvals
 588 |     db.update_tool_approval(req.sessionId, req.nodeId, req.toolName, "pending", status)
 589 |     # Database is the single source of truth; no in-memory fallback needed
 590 |     # Perform wildcard updates in database (if specific logId is not provided)
 591 |     conn = db.get_db_connection()
 592 |     cursor = conn.cursor()
 593 |     cursor.execute(
 594 |         "UPDATE tool_approvals SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND node_id = ? AND tool_name = ? AND status = 'pending'",
 595 |         (status, req.sessionId, req.nodeId, req.toolName)
 596 |     )
 597 |     conn.commit()
 598 |     conn.close()
 599 |     
 600 |     return {"status": "success", "state": status}
 601 | 
 602 | async def run_cached_flow(cached_data: Dict[str, Any]):
 603 |     metadata = cached_data.get("metadata")
 604 |     if metadata:
 605 |         yield f"event: metadata\ndata: {json.dumps(metadata)}\n\n"
 606 |     
 607 |     text = cached_data.get("text", "")
 608 |     chunk_size = 15
 609 |     for i in range(0, len(text), chunk_size):
 610 |         chunk = text[i:i+chunk_size]
 611 |         yield f"event: text\ndata: {json.dumps(chunk)}\n\n"
 612 |         await asyncio.sleep(0.02)
 613 |     yield "event: done\ndata: {}\n\n"
 614 | 
 615 | def compute_agent_layout(active_agents):
 616 |     """Compute non-overlapping positions for agent nodes using a proper grid layout."""
 617 |     col_groups = {1: [], 2: [], 3: []}
 618 |     for uid, agent, tpl in active_agents:
 619 |         col = tpl.get("col", 2)
 620 |         col_groups[col].append((uid, agent, tpl))
 621 | 
 622 |     COL_X = {1: 80, 2: 380, 3: 680}
 623 |     NODE_HEIGHT = 220
 624 |     VERTICAL_GAP = 40
 625 |     START_Y = 50
 626 | 
 627 |     positions = {}
 628 |     for col, agents_in_col in col_groups.items():
 629 |         x = COL_X[col]
 630 |         for idx, (uid, agent, tpl) in enumerate(agents_in_col):
 631 |             y = START_Y + idx * (NODE_HEIGHT + VERTICAL_GAP)
 632 |             positions[uid] = {"x": x, "y": y}
 633 | 
 634 |     return positions
 635 | 
 636 | @app.post("/orchestrate")
 637 | async def orchestrate(req: OrchestrateRequest):
 638 |     provider_config = get_provider_config(req.provider)
 639 |     api_key = resolve_api_key(req.provider, req.api_key, req.api_keys)
 640 |     if not api_key and not provider_config.get("is_local", False):
 641 |         raise HTTPException(
 642 |             status_code=400,
 643 |             detail=f"API Key for provider '{req.provider}' is missing. Please configure BYOK in Settings or set the appropriate environment variable."
 644 |         )
 645 | 
 646 |     # 1. Guardrails check
 647 |     guardrail_err = check_guardrails(req.prompt)
 648 |     if guardrail_err:
 649 |         async def stream_guardrail_err():
 650 |             yield f"event: text\ndata: {json.dumps(guardrail_err)}\n\n"
 651 |             yield "event: done\ndata: {}\n\n"
 652 |         return StreamingResponse(stream_guardrail_err(), media_type="text/event-stream")
 653 | 
 654 |     # In-memory and persistent session id
 655 |     session_id = req.session_id or str(int(datetime.datetime.now().timestamp()))
 656 | 
 657 |     # 2. Rate limiting check
 658 |     if not check_rate_limit(session_id, len(req.prompt)):
 659 |         async def stream_rate_limit_err():
 660 |             yield f"event: text\ndata: {json.dumps('**Rate Limit Exceeded**: Please wait a minute before making more requests.')}\n\n"
 661 |             yield "event: done\ndata: {}\n\n"
 662 |         return StreamingResponse(stream_rate_limit_err(), media_type="text/event-stream")
 663 | 
 664 |     # 3. Semantic caching
 665 |     prompt_hash_overall = hashlib.sha256(req.prompt.encode('utf-8')).hexdigest()
 666 |     prompt_embedding = await get_embedding(req.provider, api_key, req.prompt, api_keys=req.api_keys)
 667 |     if prompt_embedding:
 668 |         all_caches = db.load_all_cached_embeddings()
 669 |         for cache in all_caches:
 670 |             sim = cosine_similarity(prompt_embedding, cache["embedding"])
 671 |             if sim > 0.95:
 672 |                 print(f"[SEMANTIC CACHE] Cache hit for overall response. Similarity: {sim:.4f}")
 673 |                 return StreamingResponse(run_cached_flow(cache["response"]), media_type="text/event-stream")
 674 | 
 675 |     # 4. Map history and call planner
 676 |     contents = []
 677 |     if req.history:
 678 |         for msg in req.history:
 679 |             role = "user" if msg.sender == "user" else "assistant"
 680 |             contents.append({
 681 |                 "role": role,
 682 |                 "content": msg.text
 683 |             })
 684 |     
 685 |     contents.append({
 686 |         "role": "user",
 687 |         "content": req.prompt
 688 |     })
 689 | 
 690 |     plan = {
 691 |         "complexity": "simple",
 692 |         "capabilities": [],
 693 |         "thinking_summary": "System defaulted to general mode.",
 694 |         "agent_talk": [{
 695 |             "senderId": "general",
 696 |             "senderName": "General Assistant",
 697 |             "senderIcon": "bot",
 698 |             "text": "Standing by to process your request.",
 699 |             "objective": "Process user requests with precise analysis.",
 700 |             "systemPrompt": "You are Solospace core.",
 701 |             "rules": ["Be descriptive"],
 702 |             "dependencies": []
 703 |         }],
 704 |         "follow_up_suggestions": ["Can you elaborate?", "Show me a detailed implementation example."]
 705 |     }
 706 | 
 707 |     try:
 708 |         plan = await call_provider_json(
 709 |             provider=req.provider,
 710 |             model=req.model,
 711 |             api_key=api_key,
 712 |             messages=contents,
 713 |             system_prompt=ORCHESTRATOR_SYSTEM_INSTRUCTION,
 714 |             temperature=0.2,
 715 |             json_schema=orchestration_schema,
 716 |             timeout=30.0,
 717 |             fallback_provider=req.fallback_provider,
 718 |             api_keys=req.api_keys,
 719 |             base_url=req.base_url
 720 |         )
 721 |     except Exception as e:
 722 |         print(f"[ORCHESTRATION WARNING] Planning failed: {str(e)}")
 723 | 
 724 |     nodes = []
 725 |     edges = []
 726 |     complexity = plan.get("complexity", "simple")
 727 |     
 728 |     # Enforce minimum agents for non-simple tasks
 729 |     if complexity != "simple" and len(plan.get("agent_talk", [])) < 2:
 730 |         print("[WARN] Too few agents for complex/medium task, adding a default assistant agent.")
 731 |         plan.setdefault("agent_talk", []).append({
 732 |             "senderId": "assistant",
 733 |             "senderName": "General Assistant",
 734 |             "senderIcon": "code",
 735 |             "text": "Supports the primary agents with general assistance.",
 736 |             "objective": "Provide supplementary help and context.",
 737 |             "systemPrompt": "You are a helpful assistant that supports other agents.",
 738 |             "rules": ["Be concise", "Do not duplicate work"],
 739 |             "dependencies": [],
 740 |             "tools": ["Web Search", "Memory"]
 741 |         })
 742 | 
 743 |     if complexity == "simple":
 744 |         nodes.append({
 745 |             "id": "general",
 746 |             "type": "custom",
 747 |             "position": {"x": 0, "y": 0},  # Bug 3: dagre handles layout, backend sends zeros
 748 |             "data": {
 749 |                 "name": "General Assistant",
 750 |                 "tag": "GENERAL_CORE",
 751 |                 "status": "ACTIVE",
 752 |                 "metricLabel": "Logic Level",
 753 |                 "metricVal": "90%",
 754 |                 "icon": "bot",
 755 |                 "objective": "Address the user request with natural, accurate, and comprehensive insights.",
 756 |                 "personality": "Helpful, expert, clear-headed",
 757 |                 "systemPrompt": "You are Solospace, an elite assistant.",
 758 |                 "rules": ["Be helpful and concise", "Use rich markdown"],
 759 |                 "tools": ["Web Search", "Memory"],
 760 |                 "temp": 0.7,
 761 |                 "logic": 90,
 762 |                 "empathy": 80,
 763 |                 "context": "128k",
 764 |                 "enabled": True,
 765 |                 "priority": 5,
 766 |                 "toolPermissions": {"Web Search": "ALLOWED", "Memory": "ALLOWED"},
 767 |                 "toolLogs": [],
 768 |                 "dependencies": []
 769 |             }
 770 |         })
 771 |     else:
 772 |         col_mapping = {
 773 |             "research": 1,
 774 |             "auth": 2,
 775 |             "database": 2,
 776 |             "frontend": 2,
 777 |             "backend": 3,
 778 |             "payments": 3
 779 |         }
 780 | 
 781 |         # Built-in templates: provide defaults but agent can override tools via agent_talk
 782 |         AGENT_TEMPLATES = {
 783 |             "research": {"name": "Market Researcher", "tag": "RESEARCH_LEAD_01", "icon": "science", "default_tools": ["Web Search"], "temp": 0.3, "logic": 85, "empathy": 40, "priority": 5, "col": 1},
 784 |             "auth": {"name": "Security Architect", "tag": "AUTH_AUDIT_02", "icon": "science", "default_tools": ["Memory"], "temp": 0.1, "logic": 99, "empathy": 10, "priority": 8, "col": 2},
 785 |             "database": {"name": "Database Admin", "tag": "DB_SCHEMA_03", "icon": "science", "default_tools": ["Memory"], "temp": 0.2, "logic": 95, "empathy": 20, "priority": 7, "col": 2},
 786 |             "frontend": {"name": "UI Specialist", "tag": "UI_DESIGN_04", "icon": "code", "default_tools": ["Browser"], "temp": 0.7, "logic": 75, "empathy": 75, "priority": 6, "col": 2},
 787 |             "backend": {"name": "API Architect", "tag": "API_ENGINE_05", "icon": "code", "default_tools": ["Code Executor"], "temp": 0.2, "logic": 92, "empathy": 25, "priority": 8, "col": 3},
 788 |             "payments": {"name": "Stripe Integrator", "tag": "STRIPE_BILL_06", "icon": "trending_up", "default_tools": ["API Connector"], "temp": 0.4, "logic": 90, "empathy": 40, "priority": 7, "col": 3}
 789 |         }
 790 | 
 791 |         active_agents = []
 792 |         seen_ids = set()
 793 |         for agent in plan.get("agent_talk", []):
 794 |             cap = agent.get("senderId", "")
 795 |             # Deduplicate by senderId — if Gemini sends duplicate, suffix with index
 796 |             unique_id = cap
 797 |             if unique_id in seen_ids:
 798 |                 unique_id = f"{cap}_{len(seen_ids)}"
 799 |             seen_ids.add(unique_id)
 800 |             if cap in AGENT_TEMPLATES:
 801 |                 active_agents.append((unique_id, agent, AGENT_TEMPLATES[cap]))
 802 |             elif cap == "other" or cap not in AGENT_TEMPLATES:
 803 |                 # Dynamic / custom agent
 804 |                 ct = agent.get("custom_template", {})
 805 |                 dynamic_tpl = {
 806 |                     "name": ct.get("name", agent.get("senderName", "Custom Agent")),
 807 |                     "tag": ct.get("tag", f"CUSTOM_{unique_id.upper()[:8]}"),
 808 |                     "icon": ct.get("icon", agent.get("senderIcon", "science")),
 809 |                     "default_tools": ["Web Search", "Memory"],
 810 |                     "temp": ct.get("temp", 0.5),
 811 |                     "logic": ct.get("logic", 80),
 812 |                     "empathy": 50,
 813 |                     "priority": 5,
 814 |                     "col": ct.get("col", 2)
 815 |                 }
 816 |                 active_agents.append((unique_id, agent, dynamic_tpl))
 817 | 
 818 |         positions = compute_agent_layout(active_agents)
 819 |         for uid, agent, tpl in active_agents:
 820 |             pos = positions[uid]
 821 |             x = pos["x"]
 822 |             y = pos["y"]
 823 | 
 824 |             # Agent-defined tools override template defaults
 825 |             agent_tools = agent.get("tools", [])
 826 |             resolved_tools = agent_tools if agent_tools else tpl["default_tools"]
 827 |             # Filter to known tool names for safety
 828 |             valid_tools = {"Web Search", "Memory", "Code Executor", "Browser", "API Connector", "Vision", "Voice", "File Upload"}
 829 |             resolved_tools = [t for t in resolved_tools if t in valid_tools] or tpl["default_tools"]
 830 | 
 831 |             default_metrics = {
 832 |                 "research": ("Sources Scanned", "24 Pages"),
 833 |                 "auth": ("Audit Score", "99%"),
 834 |                 "database": ("Schema Status", "Normalized"),
 835 |                 "frontend": ("UI Score", "95%"),
 836 |                 "backend": ("Execution Rate", "98%"),
 837 |                 "payments": ("Stripe API Status", "Online")
 838 |             }.get(agent.get("senderId", ""), ("Logic Level", "90%"))
 839 | 
 840 |             nodes.append({
 841 |                 "id": uid,
 842 |                 "type": "custom",
 843 |                 "position": {"x": 0, "y": 0},  # Bug 3: dagre handles layout, backend sends zeros
 844 |                 "data": {
 845 |                     "name": agent.get("senderName", tpl["name"]),
 846 |                     "tag": tpl["tag"],
 847 |                     "status": "IDLE",
 848 |                     "metricLabel": default_metrics[0],
 849 |                     "metricVal": default_metrics[1],
 850 |                     "icon": agent.get("senderIcon", tpl["icon"]),
 851 |                     "objective": agent.get("objective", ""),
 852 |                     "personality": "Collaborative Specialist",
 853 |                     "systemPrompt": agent.get("systemPrompt", ""),
 854 |                     "rules": agent.get("rules", []),
 855 |                     "tools": resolved_tools,
 856 |                     "temp": tpl["temp"],
 857 |                     "logic": tpl["logic"],
 858 |                     "empathy": tpl["empathy"],
 859 |                     "context": "128k",
 860 |                     "enabled": True,
 861 |                     "priority": tpl["priority"],
 862 |                     "toolPermissions": {t: "ASK" if t in ["Code Executor", "API Connector"] else "ALLOWED" for t in resolved_tools},
 863 |                     "toolLogs": [],
 864 |                     "dependencies": agent.get("dependencies", [])
 865 |                 }
 866 |             })
 867 | 
 868 |         for node in nodes:
 869 |             for dep in node["data"].get("dependencies", []):
 870 |                 edges.append({
 871 |                     "id": f"e-{dep}-{node['id']}",
 872 |                     "source": dep,
 873 |                     "target": node["id"],
 874 |                     "animated": True,
 875 |                     "type": "custom",
 876 |                     "style": {"stroke": "#60a5fa", "strokeWidth": 2}
 877 |                 })
 878 | 
 879 |     # Decide whether to run full agent flow
 880 |     if not req.execute_agents:
 881 |         # Only planning mode: save session in DB with paused state and return planning metadata
 882 |         db.save_session(
 883 |             session_id=session_id,
 884 |             title=req.prompt[:40] + "..." if len(req.prompt) > 40 else req.prompt,
 885 |             prompt=req.prompt,
 886 |             mode=complexity,
 887 |             nodes=nodes,
 888 |             edges=edges,
 889 |             chat_messages=[
 890 |                 {"id": "user-prompt", "sender": "user", "text": req.prompt, "timestamp": datetime.datetime.now().strftime("%I:%M:%S %p")}
 891 |             ],
 892 |             agent_talk_logs=[],
 893 |             execution_state="paused",
 894 |             status_message="Agent team generated. Customize and proceed.",
 895 |             follow_up_suggestions=plan.get("follow_up_suggestions", [])
 896 |         )
 897 |         
 898 |         async def planning_only_flow():
 899 |             setup_metadata = {
 900 |                 "complexity": complexity,
 901 |                 "capabilities": plan.get("capabilities", []),
 902 |                 "thinking_summary": plan.get("thinking_summary", ""),
 903 |                 "nodes": nodes,
 904 |                 "edges": edges,
 905 |                 "agent_talk": [],
 906 |                 "follow_up_suggestions": plan.get("follow_up_suggestions", [])
 907 |             }
 908 |             yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
 909 |             yield f"event: text\ndata: {json.dumps('✅ Agent team generated. Go to the **Flow** tab to customize agents and click **Proceed** to run them.')}\n\n"
 910 |             yield "event: done\ndata: {}\n\n"
 911 |             
 912 |         return StreamingResponse(planning_only_flow(), media_type="text/event-stream")
 913 |     else:
 914 |         # Existing full execution flow
 915 |         return StreamingResponse(
 916 |             run_agent_execution_loop(
 917 |                 session_id=session_id,
 918 |                 prompt=req.prompt,
 919 |                 history=req.history or [],
 920 |                 api_key=api_key,
 921 |                 nodes=nodes,
 922 |                 edges=edges,
 923 |                 complexity=complexity,
 924 |                 capabilities=plan.get("capabilities", []),
 925 |                 thinking_summary=plan.get("thinking_summary", ""),
 926 |                 follow_up_suggestions=plan.get("follow_up_suggestions", []),
 927 |                 provider=req.provider,
 928 |                 model=req.model,
 929 |                 fallback_provider=req.fallback_provider,
 930 |                 api_keys=req.api_keys,
 931 |                 base_url=req.base_url
 932 |             ),
 933 |             media_type="text/event-stream"
 934 |         )
 935 | 
 936 | @app.get("/providers")
 937 | async def get_providers():
 938 |     return get_available_providers()
 939 | 
 940 | @app.get("/health")
 941 | async def health_check():
 942 |     """Health check for the orchestrator and provider connectivity."""
 943 |     import datetime
 944 |     return {"status": "ok", "timestamp": datetime.datetime.now().isoformat()}
 945 | 
 946 | class ModelsRequest(BaseModel):
 947 |     provider: str
 948 |     api_key: Optional[str] = None
 949 |     api_keys: Optional[Dict[str, str]] = None
 950 |     base_url: Optional[str] = None
 951 | 
 952 | @app.post("/models")
 953 | async def get_models(req: ModelsRequest):
 954 |     """Fetch available models for a provider dynamically."""
 955 |     models = await fetch_models_from_provider(
 956 |         provider=req.provider,
 957 |         api_key=req.api_key,
 958 |         api_keys=req.api_keys,
 959 |         base_url=req.base_url
 960 |     )
 961 |     return {"provider": req.provider, "models": models}
 962 | 
 963 | # Session persistence APIs
 964 | @app.get("/sessions")
 965 | async def get_sessions():
 966 |     return db.load_sessions()
 967 | 
 968 | @app.get("/sessions/{session_id}")
 969 | async def get_session(session_id: str):
 970 |     session = db.load_session(session_id)
 971 |     if not session:
 972 |         raise HTTPException(status_code=404, detail="Session not found")
 973 |     return session
 974 | 
 975 | @app.delete("/sessions/{session_id}")
 976 | async def delete_session(session_id: str):
 977 |     db.delete_session(session_id)
 978 |     return {"status": "success"}
 979 | 
 980 | def convert_gemini_history_to_standard(history: List[Dict[str, Any]]) -> List[Dict[str, str]]:
 981 |     res = []
 982 |     for msg in history:
 983 |         parts = msg.get("parts", [])
 984 |         text = ""
 985 |         if parts:
 986 |             text = parts[0].get("text", "")
 987 |         role = "assistant" if msg.get("role") in ["model", "assistant"] else "user"
 988 |         res.append({"role": role, "content": text})
 989 |     return res
 990 | 
 991 | async def run_agent_execution_loop(
 992 |     session_id: str,
 993 |     prompt: str,
 994 |     history: List[Message],
 995 |     api_key: str,
 996 |     nodes: List[Dict[str, Any]],
 997 |     edges: List[Dict[str, Any]],
 998 |     complexity: str,
 999 |     capabilities: List[str],
1000 |     thinking_summary: str,
1001 |     follow_up_suggestions: List[str],
1002 |     provider: str = "gemini",
1003 |     model: Optional[str] = None,
1004 |     fallback_provider: Optional[str] = None,
1005 |     api_keys: Optional[Dict[str, str]] = None,
1006 |     base_url: Optional[str] = None
1007 | ):
1008 |     now_str = lambda: datetime.datetime.now().strftime("%I:%M:%S %p")
1009 |     agent_results: Dict[str, str] = {}
1010 |     setup_metadata = {
1011 |         "complexity": complexity,
1012 |         "capabilities": capabilities,
1013 |         "thinking_summary": thinking_summary,
1014 |         "nodes": nodes,
1015 |         "edges": edges,
1016 |         "agent_talk": [],
1017 |         "follow_up_suggestions": follow_up_suggestions
1018 |     }
1019 |     
1020 |     # 1. Dependency Existence Check
1021 |     all_ids = {n["id"] for n in nodes}
1022 |     for node in nodes:
1023 |         if not node.get("data", {}).get("enabled", True):
1024 |             continue
1025 |         for dep in node.get("data", {}).get("dependencies", []):
1026 |             if dep not in all_ids:
1027 |                 error_msg = f"Agent {node['id']} depends on missing agent {dep}"
1028 |                 yield f"event: text\ndata: {json.dumps('**Validation Error**: ' + error_msg)}\n\n"
1029 |                 yield "event: done\ndata: {}\n\n"
1030 |                 return
1031 | 
1032 |     # 2. Cycle Detection Check
1033 |     def has_cycle(graph, current_node, visited, rec_stack):
1034 |         visited[current_node] = True
1035 |         rec_stack[current_node] = True
1036 |         for neighbor in graph.get(current_node, []):
1037 |             if not visited.get(neighbor, False):
1038 |                 if has_cycle(graph, neighbor, visited, rec_stack):
1039 |                     return True
1040 |             elif rec_stack.get(neighbor, False):
1041 |                 return True
1042 |         rec_stack[current_node] = False
1043 |         return False
1044 | 
1045 |     graph = {node["id"]: [d for d in node.get("data", {}).get("dependencies", []) if d in all_ids] for node in nodes}
1046 |     if edges:
1047 |         for edge in edges:
1048 |             target = edge.get("target")
1049 |             source = edge.get("source")
1050 |             if target in graph and source in all_ids:
1051 |                 graph[target].append(source)
1052 | 
1053 |     visited_nodes = {node["id"]: False for node in nodes}
1054 |     for node_id in graph:
1055 |         if not visited_nodes[node_id]:
1056 |             if has_cycle(graph, node_id, visited_nodes, {}):
1057 |                 error_msg = "Circular dependency detected in agent workflow."
1058 |                 yield f"event: text\ndata: {json.dumps('**Validation Error**: ' + error_msg)}\n\n"
1059 |                 yield "event: done\ndata: {}\n\n"
1060 |                 return
1061 | 
1062 |     # Save initial session in DB
1063 |     db.save_session(
1064 |         session_id=session_id,
1065 |         title=prompt[:40] + "..." if len(prompt) > 40 else prompt,
1066 |         prompt=prompt,
1067 |         mode=complexity,
1068 |         nodes=nodes,
1069 |         edges=edges,
1070 |         chat_messages=[],
1071 |         agent_talk_logs=[],
1072 |         execution_state="running",
1073 |         status_message="Running orchestration loop",
1074 |         follow_up_suggestions=follow_up_suggestions
1075 |     )
1076 |     
1077 |     yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1078 | 
1079 |     execution_order = sort_nodes_topologically(nodes, edges)
1080 |     
1081 |     for agent_node in execution_order:
1082 |         node_id = agent_node["id"]
1083 |         agent_data = agent_node["data"]
1084 |         agent_name = agent_data["name"]
1085 |         
1086 |         if not agent_data.get("enabled", True):
1087 |             continue
1088 | 
1089 |         try:
1090 |             # Checkpoint loading
1091 |             checkpoint_state = db.load_checkpoint(session_id, node_id)
1092 |             if checkpoint_state:
1093 |                 agent_results[node_id] = checkpoint_state.get("final_answer", "Completed.")
1094 |                 setup_metadata["agent_talk"].append({
1095 |                     "id": f"agent-log-{node_id}-{now_str()}",
1096 |                     "senderId": node_id,
1097 |                     "senderName": agent_name,
1098 |                     "senderIcon": agent_data["icon"],
1099 |                     "text": checkpoint_state.get("final_answer", "Completed.")[:180],
1100 |                     "timestamp": now_str()
1101 |                 })
1102 |                 continue
1103 | 
1104 |             for n in nodes:
1105 |                 if n["id"] == node_id:
1106 |                     n["data"]["status"] = "ACTIVE"
1107 |             yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1108 |             
1109 |             yield f"event: status\ndata: {json.dumps(f'[{agent_name}] processing...')}\n\n"
1110 |             await asyncio.sleep(0.5)
1111 | 
1112 |             dep_outputs = ""
1113 |             for dep_id in agent_data.get("dependencies", []):
1114 |                 if dep_id in agent_results:
1115 |                     dep_outputs += f"### Input from {dep_id.upper()}:\n{agent_results[dep_id]}\n"
1116 | 
1117 |             memories_context = ""
1118 |             try:
1119 |                 matched_memories = await query_memory(agent_data["objective"], api_key, session_id=session_id, provider=provider)
1120 |                 if matched_memories:
1121 |                     memories_context = "### Relevant Historical Memories:\n" + "\n".join(f"- {m}" for m in matched_memories)
1122 |             except Exception:
1123 |                 pass
1124 | 
1125 |             # Get messages addressed to this agent
1126 |             incoming_msgs = get_messages_for_agent(session_id, node_id)
1127 |             msg_block = ""
1128 |             if incoming_msgs:
1129 |                 msg_block = "### Messages from other agents:\n"
1130 |                 for msg in incoming_msgs:
1131 |                     msg_block += f"- From {msg['from']}: {msg['content']}\n"
1132 |                 # Clear after reading
1133 |                 clear_messages(session_id, node_id)
1134 | 
1135 |             resolved_tools_str = ", ".join(agent_data.get("tools", []))
1136 |             tools_instruction = f"Available tools: {resolved_tools_str}. To use a tool, specify the tool name in 'action' and input in 'action_input'. If you have enough information, set 'action' to 'none' and provide 'final_answer'."
1137 | 
1138 |             agent_history = [{
1139 |                 "role": "user",
1140 |                 "parts": [{"text": f"{tools_instruction}\n\nUser Request: {prompt}\n\n{dep_outputs}\n{memories_context}\n{msg_block}\n\nYour specific objective: {agent_data['objective']}\nPersonality: {agent_data.get('personality', 'Collaborative Specialist')}\nRules: {agent_data['rules']}"}]
1141 |             }]
1142 | 
1143 |             agent_final_answer = "Sub-task completed."
1144 |             action_execution_history = []
1145 |             max_turns = 6 if complexity != "simple" else 3
1146 | 
1147 |             for turn in range(max_turns):
1148 |                 turn_data = {}
1149 |                 action = "none"
1150 |                 observation = ""
1151 |                 try:
1152 |                     standard_history = convert_gemini_history_to_standard(agent_history)
1153 |                     turn_data = await call_provider_json(
1154 |                         provider=provider,
1155 |                         model=model,
1156 |                         api_key=api_key,
1157 |                         messages=standard_history,
1158 |                         system_prompt=agent_data["systemPrompt"],
1159 |                         temperature=0.2,
1160 |                         json_schema=agent_turn_schema,
1161 |                         timeout=30.0,
1162 |                         fallback_provider=fallback_provider,
1163 |                         api_keys=api_keys,
1164 |                         base_url=base_url
1165 |                     )
1166 |                     
1167 |                     thought = turn_data.get("thought", "")
1168 |                     action = turn_data.get("action", "none")
1169 |                     action_input = turn_data.get("action_input", "")
1170 |                     agent_final_answer = turn_data.get("final_answer", "")
1171 |                     
1172 |                     if thought:
1173 |                         yield f"event: thinking\ndata: {json.dumps(f'[{agent_name}]: {thought}\\n')}\n\n"
1174 |                 except Exception as e:
1175 |                     print(f"ReAct Turn fail: {e}")
1176 |                     break
1177 | 
1178 |                 if action == "none" or agent_final_answer:
1179 |                     break
1180 | 
1181 |                 # Circuit Breaker Check
1182 |                 action_execution_history.append((action, action_input))
1183 |                 if action_execution_history.count((action, action_input)) >= 3:
1184 |                     observation = "Circuit Breaker: Tool executed repeatedly with identical input. Halting loop to prevent infinite spend."
1185 |                     yield f"event: status\ndata: {json.dumps(f'[{agent_name}] circuit breaker halted')}\n\n"
1186 |                     agent_history.append({
1187 |                         "role": "model",
1188 |                         "parts": [{"text": json.dumps(turn_data)}]
1189 |                     })
1190 |                     agent_history.append({
1191 |                         "role": "user",
1192 |                         "parts": [{"text": f"Observation: {observation}"}]
1193 |                     })
1194 |                     continue
1195 | 
1196 |                 t_log_id = f"t-log-{int(datetime.datetime.now().timestamp())}"
1197 |                 t_timestamp = now_str()
1198 |                 
1199 |                 permission = agent_data.get("toolPermissions", {}).get(action, "ALLOWED")
1200 |                 
1201 |                 if permission == "ASK":
1202 |                     new_log = {
1203 |                         "id": t_log_id,
1204 |                         "timestamp": t_timestamp,
1205 |                         "tool": action,
1206 |                         "action": "Execution Request",
1207 |                         "status": "PENDING",
1208 |                         "detail": f"Waiting for user to approve execution of '{action_input[:50]}...'"
1209 |                     }
1210 |                     for n in nodes:
1211 |                         if n["id"] == node_id:
1212 |                             n["data"]["toolLogs"] = [new_log] + n["data"].get("toolLogs", [])
1213 |                     yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1214 |                     
1215 |                     db.create_tool_approval(session_id, node_id, action, action_input, t_log_id)
1216 |                     
1217 |                     yield f"event: tool_approval\ndata: {json.dumps({'sessionId': session_id, 'nodeId': node_id, 'toolName': action, 'action': 'Execution Approval Required', 'detail': action_input[:100], 'logId': t_log_id})}\n\n"
1218 |                     yield f"event: status\ndata: {json.dumps(f'[{agent_name}] waiting for approval to run [{action}]')}\n\n"
1219 | 
1220 |                     # Poll database for verdict (with 120s timeout)
1221 |                     approval_start = time.time()
1222 |                     APPROVAL_TIMEOUT = 120
1223 |                     while True:
1224 |                         approval_status = db.get_tool_approval(session_id, node_id, action, t_log_id)
1225 |                         if approval_status in ["approved", "denied"]:
1226 |                             permission = "ALLOWED" if approval_status == "approved" else "DENIED"
1227 |                             break
1228 |                         if time.time() - approval_start > APPROVAL_TIMEOUT:
1229 |                             permission = "DENIED"
1230 |                             db.update_tool_approval(session_id, node_id, action, t_log_id, "denied")
1231 |                             yield f"event: status\ndata: {json.dumps(f'[{agent_name}] approval timed out, auto-denied')}\n\n"
1232 |                             break
1233 |                         await asyncio.sleep(0.5)
1234 |                     
1235 |                     if permission == "ALLOWED":
1236 |                         for n in nodes:
1237 |                             if n["id"] == node_id:
1238 |                                 n["data"]["toolLogs"] = [{**new_log, "status": "SUCCESS", "detail": f"Approved: {action_input[:50]}"}] + n["data"].get("toolLogs", [])[1:]
1239 |                     else:
1240 |                         for n in nodes:
1241 |                             if n["id"] == node_id:
1242 |                                 n["data"]["toolLogs"] = [{**new_log, "status": "BLOCKED", "detail": "Blocked by user."}] + n["data"].get("toolLogs", [])[1:]
1243 | 
1244 |                 if permission == "ALLOWED":
1245 |                     yield f"event: status\ndata: {json.dumps(f'[{agent_name}] executing [{action}]')}\n\n"
1246 |                     
1247 |                     if action == "web_search":
1248 |                         observation = await execute_web_search(action_input)
1249 |                     elif action == "browse_web":
1250 |                         observation = await execute_web_browse(action_input)
1251 |                     elif action == "execute_code":
1252 |                         observation = await execute_python_code(action_input)
1253 |                     elif action == "api_call":
1254 |                         observation = await execute_api_call(action_input)
1255 |                     elif action == "query_memory":
1256 |                         mem_res = await query_memory(action_input, api_key, session_id=session_id, provider=provider)
1257 |                         observation = "\n".join(mem_res) if mem_res else "No matches found."
1258 |                     elif action == "store_memory":
1259 |                         await store_memory(node_id, action_input, api_key, session_id, provider=provider)
1260 |                         observation = "Saved successfully."
1261 |                     elif action == "send_message":
1262 |                         parts = action_input.split("|", 1)
1263 |                         if len(parts) == 2:
1264 |                             target_agent, content = parts
1265 |                             post_message(session_id, node_id, target_agent, content)
1266 |                             observation = f"Message sent to {target_agent}."
1267 |                         else:
1268 |                             observation = "Invalid send_message format. Use 'target|content'."
1269 |                     elif action in ["analyze_image", "read_file"]:
1270 |                         observation = f"{action} is not yet available in this deployment."
1271 |                     else:
1272 |                         observation = "Mock tool result."
1273 |                     
1274 |                     success_log = {
1275 |                         "id": t_log_id,
1276 |                         "timestamp": now_str(),
1277 |                         "tool": action,
1278 |                         "action": "Call",
1279 |                         "status": "SUCCESS",
1280 |                         "detail": f"Ran tool with inputs: '{action_input[:50]}' -> Output: {observation[:100]}..."
1281 |                     }
1282 |                     for n in nodes:
1283 |                         if n["id"] == node_id:
1284 |                             logs_filtered = [l for l in n["data"].get("toolLogs", []) if l["id"] != t_log_id]
1285 |                             n["data"]["toolLogs"] = [success_log] + logs_filtered
1286 |                 else:
1287 |                     observation = "Execution Blocked: Permission Denied."
1288 |                 
1289 |                 yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1290 |                 
1291 |                 agent_history.append({
1292 |                     "role": "model",
1293 |                     "parts": [{"text": json.dumps(turn_data)}]
1294 |                 })
1295 |                 agent_history.append({
1296 |                     "role": "user",
1297 |                     "parts": [{"text": f"Observation: {observation}"}]
1298 |                 })
1299 | 
1300 |             # Check if agent outcome is default / empty
1301 |             if not agent_final_answer or agent_final_answer.strip() in ["Sub-task completed.", ""]:
1302 |                 synthesis_prompt = f"Based on your objective '{agent_data['objective']}' and the ReAct steps executed, write a concise summary/result of your sub-task."
1303 |                 agent_history.append({"role": "user", "parts": [{"text": synthesis_prompt}]})
1304 |                 try:
1305 |                     synth_text = await call_provider(
1306 |                         provider=provider,
1307 |                         model=model,
1308 |                         api_key=api_key,
1309 |                         messages=convert_gemini_history_to_standard(agent_history),
1310 |                         system_prompt=agent_data["systemPrompt"],
1311 |                         temperature=0.3,
1312 |                         timeout=15.0,
1313 |                         fallback_provider=fallback_provider,
1314 |                         api_keys=api_keys,
1315 |                         base_url=base_url
1316 |                     )
1317 |                     if synth_text:
1318 |                         agent_final_answer = synth_text
1319 |                 except Exception:
1320 |                     pass
1321 | 
1322 |             agent_results[node_id] = agent_final_answer or "Sub-task completed."
1323 |             
1324 |             # Save state checkpoint
1325 |             db.save_checkpoint(session_id, node_id, {"final_answer": agent_final_answer})
1326 |             
1327 |             for n in nodes:
1328 |                 if n["id"] == node_id:
1329 |                     n["data"]["status"] = "IDLE"
1330 |             
1331 |             setup_metadata["agent_talk"].append({
1332 |                 "id": f"agent-log-{node_id}-{now_str()}",
1333 |                 "senderId": node_id,
1334 |                 "senderName": agent_name,
1335 |                 "senderIcon": agent_data["icon"],
1336 |                 "text": agent_final_answer[:180] + "..." if len(agent_final_answer) > 180 else agent_final_answer,
1337 |                 "timestamp": now_str()
1338 |             })
1339 |             yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1340 |             
1341 |             # Only store outcome memory if meaningful
1342 |             if agent_final_answer and len(agent_final_answer) > 40 and agent_final_answer != "Sub-task completed.":
1343 |                 try:
1344 |                     memory_text = f"Objective: {agent_data['objective']}\nOutcome: {agent_final_answer[:500]}"
1345 |                     await store_memory(node_id, memory_text, api_key, session_id, provider=provider)
1346 |                 except Exception:
1347 |                     pass
1348 |         except Exception as e:
1349 |             print(f"[AGENT ERROR] {agent_name} failed: {e}")
1350 |             agent_results[node_id] = f"Agent encountered an error: {str(e)[:200]}"
1351 |             for n in nodes:
1352 |                 if n["id"] == node_id:
1353 |                     n["data"]["status"] = "ERROR"
1354 |             setup_metadata["agent_talk"].append({
1355 |                 "id": f"agent-log-{node_id}-error-{now_str()}",
1356 |                 "senderId": node_id,
1357 |                 "senderName": agent_name,
1358 |                 "senderIcon": agent_data["icon"],
1359 |                 "text": f"⚠ Failed: {str(e)[:150]}",
1360 |                 "timestamp": now_str()
1361 |             })
1362 |             yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
1363 |             continue
1364 | 
1365 |     if complexity == "simple" and not agent_results:
1366 |         agent_results["general"] = "Processed the request, but no specific output was generated."
1367 | 
1368 |     yield f"event: status\ndata: {json.dumps('Synthesizing final response...')}\n\n"
1369 | 
1370 |     # Build aggregator prompt — inject relevant memory + agent results
1371 |     aggregator_prompt = ""
1372 |     try:
1373 |         memory_hits = await query_memory(prompt, api_key, top_k=3, agent_id=None, session_id=session_id, provider=provider)
1374 |         if memory_hits:
1375 |             aggregator_prompt += "### Relevant context from past conversation:\n" + "\n".join(f"- {m}" for m in memory_hits) + "\n\n"
1376 |     except Exception:
1377 |         pass
1378 | 
1379 |     if agent_results:
1380 |         aggregator_prompt += "### Analysis context:\n"
1381 |         for _nid, result in agent_results.items():
1382 |             aggregator_prompt += f"{result}\n\n"
1383 | 
1384 |     aggregator_prompt += f"\nUser's current message: {prompt}"
1385 | 
1386 |     # Fallback if aggregator prompt is empty
1387 |     if not aggregator_prompt.strip():
1388 |         aggregator_prompt = f"Answer the following user request concisely and helpfully:\n\n{prompt}"
1389 | 
1390 |     # Build full conversation history for aggregator so it has cross-turn context
1391 |     aggregator_contents = []
1392 |     if history:
1393 |         for msg in history:
1394 |             role = "user" if msg.sender == "user" else "model"
1395 |             aggregator_contents.append({"role": role, "parts": [{"text": msg.text}]})
1396 |     aggregator_contents.append({"role": "user", "parts": [{"text": aggregator_prompt}]})
1397 | 
1398 |     final_synthesis_text = ""
1399 |     try:
1400 |         async for token in stream_provider(
1401 |             provider=provider,
1402 |             model=model,
1403 |             api_key=api_key,
1404 |             messages=convert_gemini_history_to_standard(aggregator_contents),
1405 |             system_prompt=RESPONSE_SYSTEM_INSTRUCTION,
1406 |             temperature=0.7,
1407 |             timeout=90.0,
1408 |             fallback_provider=fallback_provider,
1409 |             api_keys=api_keys,
1410 |             base_url=base_url
1411 |         ):
1412 |             final_synthesis_text += token
1413 |             yield f"event: text\ndata: {json.dumps(token)}\n\n"
1414 |     except Exception as exc:
1415 |         err_msg = f"\n\n*Stream Synthesis Error: {str(exc)}*\n\n"
1416 |         yield f"event: text\ndata: {json.dumps(err_msg)}\n\n"
1417 |         final_synthesis_text = err_msg
1418 | 
1419 |     print(f"[DEBUG] final_synthesis_text length: {len(final_synthesis_text)}")
1420 |     if not final_synthesis_text:
1421 |         print("[ERROR] Aggregator produced empty response")
1422 | 
1423 |     # Save complete session data
1424 |     final_chat_messages = []
1425 |     if history:
1426 |         for msg in history:
1427 |             final_chat_messages.append({"id": f"msg-{id(msg)}", "sender": msg.sender, "text": msg.text, "timestamp": ""})
1428 |     final_chat_messages.append({"id": "user-prompt", "sender": "user", "text": prompt, "timestamp": now_str()})
1429 |     final_chat_messages.append({"id": "ai-response", "sender": "ai", "text": final_synthesis_text, "timestamp": now_str()})
1430 | 
1431 |     db.save_session(
1432 |         session_id=session_id,
1433 |         title=prompt[:40] + "..." if len(prompt) > 40 else prompt,
1434 |         prompt=prompt,
1435 |         mode=complexity,
1436 |         nodes=nodes,
1437 |         edges=edges,
1438 |         chat_messages=final_chat_messages,
1439 |         agent_talk_logs=setup_metadata["agent_talk"],
1440 |         execution_state="setup",
1441 |         status_message="Execution completed",
1442 |         follow_up_suggestions=follow_up_suggestions
1443 |     )
1444 | 
1445 |     # Cache final response
1446 |     cached_val = {
1447 |         "metadata": {
1448 |             "complexity": complexity,
1449 |             "capabilities": capabilities,
1450 |             "thinking_summary": thinking_summary,
1451 |             "nodes": nodes,
1452 |             "edges": edges,
1453 |             "agent_talk": setup_metadata["agent_talk"],
1454 |             "follow_up_suggestions": follow_up_suggestions
1455 |         },
1456 |         "text": final_synthesis_text
1457 |     }
1458 |     
1459 |     # Compute embeddings inside
1460 |     try:
1461 |         prompt_embedding = await get_embedding(provider, api_key, prompt, api_keys=api_keys)
1462 |         if prompt_embedding:
1463 |             prompt_hash_overall = hashlib.sha256(prompt.encode('utf-8')).hexdigest()
1464 |             db.save_cached_response(prompt_hash_overall, prompt, prompt_embedding, cached_val)
1465 |     except Exception:
1466 |         pass
1467 | 
1468 |     # Auto-store this full conversation turn in vector memory for cross-turn recall
1469 |     if final_synthesis_text:
1470 |         try:
1471 |             convo_memory = f"User: {prompt}\nAssistant: {final_synthesis_text[:800]}"
1472 |             await store_memory(f"session_{session_id}", convo_memory, api_key, session_id, provider=provider)
1473 |         except Exception:
1474 |             pass
1475 | 
1476 |     yield "event: done\ndata: {}\n\n"
1477 | 
1478 | @app.post("/execute_custom")
1479 | async def execute_custom(req: ExecuteCustomRequest):
1480 |     provider_config = get_provider_config(req.provider)
1481 |     api_key = resolve_api_key(req.provider, req.api_key, req.api_keys)
1482 |     if not api_key and not provider_config.get("is_local", False):
1483 |         raise HTTPException(
1484 |             status_code=400,
1485 |             detail=f"API Key for provider '{req.provider}' is missing. Please configure BYOK in Settings."
1486 |         )
1487 | 
1488 |     complexity = "simple" if len(req.nodes) == 1 and req.nodes[0]["id"] == "general" else "custom"
1489 |     capabilities = [n["data"].get("tag", "CUSTOM") for n in req.nodes]
1490 |     
1491 |     return StreamingResponse(
1492 |         run_agent_execution_loop(
1493 |             session_id=req.session_id,
1494 |             prompt=req.prompt,
1495 |             history=req.history or [],
1496 |             api_key=api_key,
1497 |             nodes=req.nodes,
1498 |             edges=req.edges,
1499 |             complexity=complexity,
1500 |             capabilities=capabilities,
1501 |             thinking_summary="Running customized agent workflow",
1502 |             follow_up_suggestions=["Can you explain the agent collaboration?"],
1503 |             provider=req.provider,
1504 |             model=req.model,
1505 |             fallback_provider=req.fallback_provider,
1506 |             api_keys=req.api_keys,
1507 |             base_url=req.base_url
1508 |         ),
1509 |         media_type="text/event-stream"
1510 |     )
1511 | 
1512 |
```

### File: `Backend/memory_store.json`

> 1 lines | 0.0 KB

```json
1 | []
```

### File: `Backend/providers.py`

> 1339 lines | 52.3 KB

```python
   1 | """
   2 | Unified multi-provider AI adapter.
   3 | Supports: Gemini, OpenAI, Claude, OpenRouter, Groq, DeepSeek,
   4 |           Together AI, Mistral, Fireworks, Perplexity, Cohere,
   5 |           Azure OpenAI, AWS Bedrock, Ollama, xAI, Cerebras, LM Studio, Custom.
   6 | """
   7 | 
   8 | import json
   9 | import re
  10 | import os
  11 | import time
  12 | import random
  13 | import asyncio
  14 | from typing import List, Dict, Any, Optional, AsyncGenerator
  15 | import httpx
  16 | 
  17 | # ─── Retry / Backoff Configuration ──────────────────────────────────
  18 | 
  19 | MAX_RETRIES = 3
  20 | BASE_DELAY = 1.0
  21 | MAX_DELAY = 10.0
  22 | JITTER_FACTOR = 0.5
  23 | 
  24 | async def call_with_retry(func, *args, **kwargs):
  25 |     """Call a provider function with exponential backoff and jitter."""
  26 |     retries = 0
  27 |     while retries <= MAX_RETRIES:
  28 |         try:
  29 |             return await func(*args, **kwargs)
  30 |         except Exception as e:
  31 |             retries += 1
  32 |             if retries > MAX_RETRIES:
  33 |                 raise
  34 |             delay = min(MAX_DELAY, BASE_DELAY * (2 ** retries))
  35 |             delay += random.uniform(-JITTER_FACTOR * delay, JITTER_FACTOR * delay)
  36 |             await asyncio.sleep(delay)
  37 |     raise Exception("Retry loop exhausted")
  38 | 
  39 | # ─── Provider Registry ───────────────────────────────────────────────
  40 | 
  41 | PROVIDERS: Dict[str, Dict[str, Any]] = {
  42 |     "gemini": {
  43 |         "name": "Google Gemini",
  44 |         "description": "Multimodal AI with native JSON schema & embeddings",
  45 |         "base_url": "https://generativelanguage.googleapis.com/v1beta",
  46 |         "chat_path": None,
  47 |         "default_model": "gemini-2.5-flash",
  48 |         "models": [
  49 |             {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash", "tier": "fast"},
  50 |             {"id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro", "tier": "advanced"},
  51 |             {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash", "tier": "fast"},
  52 |         ],
  53 |         "capabilities": ["chat", "streaming", "json_schema", "embeddings"],
  54 |         "key_url": "https://aistudio.google.com/apikey",
  55 |         "key_hint": "AIzaSy...",
  56 |         "adapter": "gemini",
  57 |     },
  58 |     "openai": {
  59 |         "name": "OpenAI",
  60 |         "description": "GPT-4o, o3-mini, o1 reasoning models",
  61 |         "base_url": "https://api.openai.com/v1",
  62 |         "chat_path": "/chat/completions",
  63 |         "default_model": "gpt-4o",
  64 |         "models": [
  65 |             {"id": "gpt-4o", "name": "GPT-4o", "tier": "advanced"},
  66 |             {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "tier": "fast"},
  67 |             {"id": "gpt-4-turbo", "name": "GPT-4 Turbo", "tier": "advanced"},
  68 |             {"id": "o3-mini", "name": "o3-mini", "tier": "reasoning"},
  69 |             {"id": "o1", "name": "o1", "tier": "reasoning"},
  70 |         ],
  71 |         "capabilities": ["chat", "streaming", "json_mode", "embeddings"],
  72 |         "key_url": "https://platform.openai.com/api-keys",
  73 |         "key_hint": "sk-...",
  74 |         "adapter": "openai",
  75 |     },
  76 |     "claude": {
  77 |         "name": "Anthropic Claude",
  78 |         "description": "Claude Sonnet 4, Opus, Haiku family",
  79 |         "base_url": "https://api.anthropic.com/v1",
  80 |         "chat_path": "/messages",
  81 |         "default_model": "claude-3-5-sonnet-20241022",
  82 |         "models": [
  83 |             {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet", "tier": "advanced"},
  84 |             {"id": "claude-3-5-haiku-20241022", "name": "Claude 3.5 Haiku", "tier": "fast"},
  85 |             {"id": "claude-3-opus-20240229", "name": "Claude 3 Opus", "tier": "advanced"},
  86 |         ],
  87 |         "capabilities": ["chat", "streaming"],
  88 |         "key_url": "https://console.anthropic.com/settings/keys",
  89 |         "key_hint": "sk-ant-...",
  90 |         "adapter": "claude",
  91 |     },
  92 |     "openrouter": {
  93 |         "name": "OpenRouter",
  94 |         "description": "One API for 200+ models including GPT, Claude, Llama",
  95 |         "base_url": "https://openrouter.ai/api/v1",
  96 |         "chat_path": "/chat/completions",
  97 |         "default_model": "openai/gpt-4o",
  98 |         "models": [
  99 |             {"id": "openai/gpt-4o", "name": "GPT-4o", "tier": "advanced"},
 100 |             {"id": "anthropic/claude-sonnet-4", "name": "Claude Sonnet 4", "tier": "advanced"},
 101 |             {"id": "google/gemini-2.5-flash-preview", "name": "Gemini 2.5 Flash", "tier": "fast"},
 102 |             {"id": "meta-llama/llama-3.1-405b-instruct", "name": "Llama 3.1 405B", "tier": "open"},
 103 |             {"id": "deepseek/deepseek-chat", "name": "DeepSeek V3", "tier": "open"},
 104 |             {"id": "qwen/qwen-2.5-72b-instruct", "name": "Qwen 2.5 72B", "tier": "open"},
 105 |         ],
 106 |         "capabilities": ["chat", "streaming", "json_mode"],
 107 |         "key_url": "https://openrouter.ai/keys",
 108 |         "key_hint": "sk-or-...",
 109 |         "adapter": "openai",
 110 |     },
 111 |     "groq": {
 112 |         "name": "Groq",
 113 |         "description": "Ultra-fast LPU inference on open models",
 114 |         "base_url": "https://api.groq.com/openai/v1",
 115 |         "chat_path": "/chat/completions",
 116 |         "default_model": "llama-3.3-70b-versatile",
 117 |         "models": [
 118 |             {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B", "tier": "fast"},
 119 |             {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 8B Instant", "tier": "fast"},
 120 |             {"id": "mixtral-8x7b-32768", "name": "Mixtral 8x7B", "tier": "fast"},
 121 |             {"id": "gemma2-9b-it", "name": "Gemma 2 9B", "tier": "fast"},
 122 |         ],
 123 |         "capabilities": ["chat", "streaming", "json_mode"],
 124 |         "key_url": "https://console.groq.com/keys",
 125 |         "key_hint": "gsk_...",
 126 |         "adapter": "openai",
 127 |     },
 128 |     "deepseek": {
 129 |         "name": "DeepSeek",
 130 |         "description": "DeepSeek V3 & R1 reasoning models",
 131 |         "base_url": "https://api.deepseek.com/v1",
 132 |         "chat_path": "/chat/completions",
 133 |         "default_model": "deepseek-chat",
 134 |         "models": [
 135 |             {"id": "deepseek-chat", "name": "DeepSeek V3", "tier": "advanced"},
 136 |             {"id": "deepseek-reasoner", "name": "DeepSeek R1", "tier": "reasoning"},
 137 |         ],
 138 |         "capabilities": ["chat", "streaming", "json_mode"],
 139 |         "key_url": "https://platform.deepseek.com/api_keys",
 140 |         "key_hint": "sk-...",
 141 |         "adapter": "openai",
 142 |     },
 143 |     "together": {
 144 |         "name": "Together AI",
 145 |         "description": "Open-source models with fast hosted inference",
 146 |         "base_url": "https://api.together.xyz/v1",
 147 |         "chat_path": "/chat/completions",
 148 |         "default_model": "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo",
 149 |         "models": [
 150 |             {"id": "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo", "name": "Llama 3.1 405B Turbo", "tier": "advanced"},
 151 |             {"id": "mistralai/Mixtral-8x7B-Instruct-v0.1", "name": "Mixtral 8x7B", "tier": "fast"},
 152 |             {"id": "Qwen/Qwen2.5-72B-Instruct-Turbo", "name": "Qwen 2.5 72B Turbo", "tier": "advanced"},
 153 |         ],
 154 |         "capabilities": ["chat", "streaming", "json_mode"],
 155 |         "key_url": "https://api.together.xyz/settings/api-keys",
 156 |         "key_hint": "",
 157 |         "adapter": "openai",
 158 |     },
 159 |     "mistral": {
 160 |         "name": "Mistral AI",
 161 |         "description": "Mistral Large, Codestral, and more",
 162 |         "base_url": "https://api.mistral.ai/v1",
 163 |         "chat_path": "/chat/completions",
 164 |         "default_model": "mistral-large-latest",
 165 |         "models": [
 166 |             {"id": "mistral-large-latest", "name": "Mistral Large", "tier": "advanced"},
 167 |             {"id": "mistral-medium-latest", "name": "Mistral Medium", "tier": "fast"},
 168 |             {"id": "codestral-latest", "name": "Codestral", "tier": "code"},
 169 |             {"id": "open-mistral-nemo", "name": "Mistral Nemo (Free)", "tier": "fast"},
 170 |         ],
 171 |         "capabilities": ["chat", "streaming", "json_mode"],
 172 |         "key_url": "https://console.mistral.ai/api-keys/",
 173 |         "key_hint": "",
 174 |         "adapter": "openai",
 175 |     },
 176 |     "fireworks": {
 177 |         "name": "Fireworks AI",
 178 |         "description": "Fast inference on popular open-source models",
 179 |         "base_url": "https://api.fireworks.ai/inference/v1",
 180 |         "chat_path": "/chat/completions",
 181 |         "default_model": "accounts/fireworks/models/llama-v3p1-405b-instruct",
 182 |         "models": [
 183 |             {"id": "accounts/fireworks/models/llama-v3p1-405b-instruct", "name": "Llama 3.1 405B", "tier": "advanced"},
 184 |             {"id": "accounts/fireworks/models/mixtral-8x7b-instruct", "name": "Mixtral 8x7B", "tier": "fast"},
 185 |             {"id": "accounts/fireworks/models/qwen2p5-72b-instruct", "name": "Qwen 2.5 72B", "tier": "advanced"},
 186 |         ],
 187 |         "capabilities": ["chat", "streaming", "json_mode"],
 188 |         "key_url": "https://fireworks.ai/api-keys",
 189 |         "key_hint": "fw_...",
 190 |         "adapter": "openai",
 191 |     },
 192 |     "perplexity": {
 193 |         "name": "Perplexity",
 194 |         "description": "Online search-augmented generation models",
 195 |         "base_url": "https://api.perplexity.ai",
 196 |         "chat_path": "/chat/completions",
 197 |         "default_model": "sonar-pro",
 198 |         "models": [
 199 |             {"id": "sonar-pro", "name": "Sonar Pro", "tier": "advanced"},
 200 |             {"id": "sonar", "name": "Sonar", "tier": "fast"},
 201 |         ],
 202 |         "capabilities": ["chat", "streaming"],
 203 |         "key_url": "https://www.perplexity.ai/settings/api",
 204 |         "key_hint": "pplx-...",
 205 |         "adapter": "openai",
 206 |     },
 207 |     "cohere": {
 208 |         "name": "Cohere",
 209 |         "description": "Command R+ enterprise models with citations",
 210 |         "base_url": "https://api.cohere.ai/v2",
 211 |         "chat_path": "/chat",
 212 |         "default_model": "command-r-plus",
 213 |         "models": [
 214 |             {"id": "command-r-plus", "name": "Command R+", "tier": "advanced"},
 215 |             {"id": "command-r", "name": "Command R", "tier": "fast"},
 216 |         ],
 217 |         "capabilities": ["chat", "streaming"],
 218 |         "key_url": "https://dashboard.cohere.com/api-keys",
 219 |         "key_hint": "",
 220 |         "adapter": "cohere",
 221 |     },
 222 |     "azure_openai": {
 223 |         "name": "Azure OpenAI",
 224 |         "description": "Azure OpenAI service deployment",
 225 |         "base_url": "https://YOUR_RESOURCE.openai.azure.com/openai/deployments",
 226 |         "chat_path": "/chat/completions",
 227 |         "default_model": "gpt-4o",
 228 |         "models": [],
 229 |         "capabilities": ["chat", "streaming", "json_mode", "embeddings"],
 230 |         "key_url": "https://azure.microsoft.com/en-us/products/ai-services/openai",
 231 |         "key_hint": "Azure API key",
 232 |         "adapter": "openai",
 233 |         "requires_deployment": True,
 234 |         "requires_base_url": True,
 235 |     },
 236 |     "bedrock": {
 237 |         "name": "AWS Bedrock",
 238 |         "description": "AWS Bedrock models using boto3 runtime",
 239 |         "base_url": "",
 240 |         "default_model": "anthropic.claude-3-5-sonnet-20241022-v2:0",
 241 |         "models": [
 242 |             {"id": "anthropic.claude-3-5-sonnet-20241022-v2:0", "name": "Claude 3.5 Sonnet v2", "tier": "advanced"},
 243 |             {"id": "anthropic.claude-3-5-haiku-20241022-v1:0", "name": "Claude 3.5 Haiku", "tier": "fast"},
 244 |             {"id": "meta.llama3-3-70b-instruct-v1:0", "name": "Llama 3.3 70B", "tier": "advanced"},
 245 |             {"id": "meta.llama3-1-8b-instruct-v1:0", "name": "Llama 3.1 8B", "tier": "fast"},
 246 |         ],
 247 |         "capabilities": ["chat", "streaming", "json_mode"],
 248 |         "key_url": "https://aws.amazon.com/bedrock/",
 249 |         "key_hint": "AWS Access Key ID",
 250 |         "adapter": "bedrock",
 251 |         "requires_aws": True,
 252 |     },
 253 |     "ollama": {
 254 |         "name": "Ollama (Local)",
 255 |         "description": "Run local models on http://localhost:11434",
 256 |         "base_url": "http://localhost:11434/v1",
 257 |         "chat_path": "/chat/completions",
 258 |         "default_model": "llama3",
 259 |         "models": [],
 260 |         "capabilities": ["chat", "streaming", "json_mode"],
 261 |         "key_url": "",
 262 |         "key_hint": "No API key required",
 263 |         "adapter": "openai",
 264 |         "is_local": True,
 265 |         "requires_base_url": True,
 266 |     },
 267 |     "xai": {
 268 |         "name": "xAI Grok",
 269 |         "description": "Grok-2 and Grok-2-mini models",
 270 |         "base_url": "https://api.x.ai/v1",
 271 |         "chat_path": "/chat/completions",
 272 |         "default_model": "grok-2",
 273 |         "models": [
 274 |             {"id": "grok-2", "name": "Grok-2", "tier": "advanced"},
 275 |             {"id": "grok-2-mini", "name": "Grok-2-mini", "tier": "fast"},
 276 |         ],
 277 |         "capabilities": ["chat", "streaming", "json_mode"],
 278 |         "key_url": "https://x.ai/api-keys",
 279 |         "key_hint": "xai-...",
 280 |         "adapter": "openai",
 281 |     },
 282 |     "cerebras": {
 283 |         "name": "Cerebras",
 284 |         "description": "Ultra-fast Cerebras CS-3 inference on Llama models",
 285 |         "base_url": "https://api.cerebras.ai/v1",
 286 |         "chat_path": "/chat/completions",
 287 |         "default_model": "llama3.1-70b",
 288 |         "models": [
 289 |             {"id": "llama3.1-70b", "name": "Llama 3.1 70B", "tier": "advanced"},
 290 |             {"id": "llama3.1-8b", "name": "Llama 3.1 8B", "tier": "fast"},
 291 |         ],
 292 |         "capabilities": ["chat", "streaming", "json_mode"],
 293 |         "key_url": "https://cerebras.ai/api-keys",
 294 |         "key_hint": "cerebras-...",
 295 |         "adapter": "openai",
 296 |     },
 297 |     "lmstudio": {
 298 |         "name": "LM Studio (Local)",
 299 |         "description": "Local models served on http://localhost:1234",
 300 |         "base_url": "http://localhost:1234/v1",
 301 |         "chat_path": "/chat/completions",
 302 |         "default_model": "local-model",
 303 |         "models": [],
 304 |         "capabilities": ["chat", "streaming", "json_mode"],
 305 |         "key_url": "",
 306 |         "key_hint": "No API key required",
 307 |         "adapter": "openai",
 308 |         "is_local": True,
 309 |         "requires_base_url": True,
 310 |     },
 311 |     "custom": {
 312 |         "name": "Custom / Open Code",
 313 |         "description": "vLLM, LM Studio, Ollama or any OpenAI-compatible API",
 314 |         "base_url": "",
 315 |         "chat_path": "/v1/chat/completions",
 316 |         "default_model": "",
 317 |         "models": [],
 318 |         "capabilities": ["chat", "streaming", "json_mode"],
 319 |         "key_url": "",
 320 |         "key_hint": "Any key or leave empty",
 321 |         "adapter": "openai",
 322 |         "is_custom": True,
 323 |         "requires_base_url": True,
 324 |     },
 325 | }
 326 | 
 327 | 
 328 | def get_provider_config(provider_id: str) -> Dict[str, Any]:
 329 |     """Get config for a provider. Returns empty dict if not found."""
 330 |     return PROVIDERS.get(provider_id.lower(), {})
 331 | 
 332 | 
 333 | def get_available_providers() -> Dict[str, Any]:
 334 |     """Return provider registry for the frontend."""
 335 |     result = {}
 336 |     for pid, cfg in PROVIDERS.items():
 337 |         result[pid] = {
 338 |             "name": cfg["name"],
 339 |             "description": cfg["description"],
 340 |             "models": cfg["models"],
 341 |             "default_model": cfg["default_model"],
 342 |             "capabilities": cfg["capabilities"],
 343 |             "key_url": cfg["key_url"],
 344 |             "key_hint": cfg["key_hint"],
 345 |             "is_custom": cfg.get("is_custom", False),
 346 |             "is_local": cfg.get("is_local", False),
 347 |             "requires_base_url": cfg.get("requires_base_url", False),
 348 |         }
 349 |     return result
 350 | 
 351 | 
 352 | def resolve_api_key(provider: str, user_key: Optional[str] = None, api_keys: Optional[Dict[str, str]] = None) -> str:
 353 |     """Resolve key from user input dictionary, single user_key, or fallback to env."""
 354 |     if api_keys and provider in api_keys and api_keys[provider].strip():
 355 |         return api_keys[provider].strip()
 356 |     if user_key and user_key.strip():
 357 |         return user_key.strip()
 358 | 
 359 |     env_keys = {
 360 |         "gemini": "GEMINI_API_KEY",
 361 |         "openai": "OPENAI_API_KEY",
 362 |         "claude": "ANTHROPIC_API_KEY",
 363 |         "openrouter": "OPENROUTER_API_KEY",
 364 |         "groq": "GROQ_API_KEY",
 365 |         "deepseek": "DEEPSEEK_API_KEY",
 366 |         "together": "TOGETHER_API_KEY",
 367 |         "mistral": "MISTRAL_API_KEY",
 368 |         "fireworks": "FIREWORKS_API_KEY",
 369 |         "perplexity": "PERPLEXITY_API_KEY",
 370 |         "cohere": "COHERE_API_KEY",
 371 |         "azure_openai": "AZURE_OPENAI_API_KEY",
 372 |         "xai": "XAI_API_KEY",
 373 |         "cerebras": "CEREBRAS_API_KEY",
 374 |         "bedrock": "AWS_ACCESS_KEY_ID",
 375 |     }
 376 |     env_var_name = env_keys.get(provider.lower())
 377 |     if env_var_name:
 378 |         val = os.environ.get(env_var_name)
 379 |         if val:
 380 |             return val
 381 |     return ""
 382 | 
 383 | 
 384 | def extract_json_from_text(text: str) -> Optional[Dict[str, Any]]:
 385 |     """Extract and parse a JSON object from text that may contain markdown or extra content."""
 386 |     try:
 387 |         return json.loads(text.strip())
 388 |     except (json.JSONDecodeError, ValueError):
 389 |         pass
 390 | 
 391 |     match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
 392 |     if match:
 393 |         try:
 394 |             return json.loads(match.group(1).strip())
 395 |         except (json.JSONDecodeError, ValueError):
 396 |             pass
 397 | 
 398 |     depth = 0
 399 |     start = -1
 400 |     for i, ch in enumerate(text):
 401 |         if ch == "{":
 402 |             if depth == 0:
 403 |                 start = i
 404 |             depth += 1
 405 |         elif ch == "}":
 406 |             depth -= 1
 407 |             if depth == 0 and start >= 0:
 408 |                 try:
 409 |                     return json.loads(text[start:i + 1])
 410 |                 except (json.JSONDecodeError, ValueError):
 411 |                     break
 412 |     return None
 413 | 
 414 | 
 415 | def _build_openai_messages(
 416 |     messages: List[Dict[str, str]],
 417 |     system_prompt: str,
 418 |     model: str,
 419 | ) -> List[Dict[str, str]]:
 420 |     """Convert internal message format to OpenAI-compatible messages."""
 421 |     result = []
 422 |     is_reasoning = any(m in model.lower() for m in ["o1", "o3"])
 423 |     if system_prompt:
 424 |         result.append({
 425 |             "role": "developer" if is_reasoning else "system",
 426 |             "content": system_prompt,
 427 |         })
 428 |     for msg in messages:
 429 |         result.append({
 430 |             "role": msg.get("role", "user"),
 431 |             "content": msg.get("content", ""),
 432 |         })
 433 |     return result
 434 | 
 435 | 
 436 | def _build_gemini_contents(
 437 |     messages: List[Dict[str, str]],
 438 |     system_prompt: str,
 439 | ) -> Dict[str, Any]:
 440 |     """Convert internal message format to Gemini contents format."""
 441 |     contents = []
 442 |     for msg in messages:
 443 |         role = "model" if msg.get("role") in ["model", "assistant"] else "user"
 444 |         contents.append({
 445 |             "role": role,
 446 |             "parts": [{"text": msg.get("content", "")}],
 447 |         })
 448 |     return {
 449 |         "contents": contents,
 450 |         "systemInstruction": {"parts": [{"text": system_prompt}]} if system_prompt else None,
 451 |     }
 452 | 
 453 | 
 454 | def _build_claude_messages(
 455 |     messages: List[Dict[str, str]],
 456 |     system_prompt: str,
 457 | ) -> Dict[str, Any]:
 458 |     """Convert internal message format to Claude format."""
 459 |     claude_msgs = []
 460 |     for msg in messages:
 461 |         role = "assistant" if msg.get("role") in ["model", "assistant"] else "user"
 462 |         claude_msgs.append({
 463 |             "role": role,
 464 |             "content": msg.get("content", ""),
 465 |         })
 466 |     return {
 467 |         "system": system_prompt,
 468 |         "messages": claude_msgs,
 469 |     }
 470 | 
 471 | 
 472 | # ─── OpenAI-Compatible Adapter ───────────────────────────────────────
 473 | 
 474 | async def _call_openai_compatible(
 475 |     config: Dict[str, Any],
 476 |     model: str,
 477 |     api_key: str,
 478 |     messages: List[Dict[str, str]],
 479 |     system_prompt: str,
 480 |     temperature: float = 0.7,
 481 |     json_mode: bool = False,
 482 |     json_schema_hint: str = None,
 483 |     timeout: float = 30.0,
 484 | ) -> str:
 485 |     """Non-streaming call to any OpenAI-compatible endpoint."""
 486 |     base_url = config["base_url"].rstrip("/")
 487 |     chat_path = config.get("chat_path", "/chat/completions")
 488 |     
 489 |     requires_deployment = config.get("requires_deployment", False)
 490 |     if requires_deployment:
 491 |         api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
 492 |         url = f"{base_url}/{model}/chat/completions?api-version={api_version}"
 493 |         headers = {
 494 |             "Content-Type": "application/json",
 495 |             "api-key": api_key,
 496 |         }
 497 |     else:
 498 |         url = f"{base_url}{chat_path}"
 499 |         headers = {
 500 |             "Content-Type": "application/json",
 501 |             "Authorization": f"Bearer {api_key}" if api_key else "",
 502 |         }
 503 |         if not api_key:
 504 |             headers.pop("Authorization", None)
 505 | 
 506 |     if "openrouter" in base_url:
 507 |         headers["HTTP-Referer"] = "https://solospace.app"
 508 |         headers["X-Title"] = "Solospace"
 509 | 
 510 |     oa_msgs = _build_openai_messages(messages, system_prompt, model)
 511 | 
 512 |     payload: Dict[str, Any] = {
 513 |         "model": model,
 514 |         "messages": oa_msgs,
 515 |         "temperature": temperature,
 516 |         "max_tokens": 8192,
 517 |     }
 518 | 
 519 |     if any(m in model.lower() for m in ["o1", "o3", "deepseek-reasoner"]):
 520 |         payload.pop("temperature", None)
 521 | 
 522 |     if json_mode:
 523 |         payload["response_format"] = {"type": "json_object"}
 524 |         if json_schema_hint:
 525 |             last_msg = oa_msgs[-1] if oa_msgs else {}
 526 |             if last_msg.get("role") == "user":
 527 |                 last_msg["content"] = f"{last_msg.get('content', '')}\n\nIMPORTANT: Respond ONLY with valid JSON matching this structure:\n{json_schema_hint}"
 528 | 
 529 |     async with httpx.AsyncClient() as client:
 530 |         resp = await client.post(url, json=payload, headers=headers, timeout=timeout)
 531 |         if resp.status_code != 200:
 532 |             raise Exception(f"Provider error ({resp.status_code}): {resp.text[:500]}")
 533 |         data = resp.json()
 534 |         return data["choices"][0]["message"]["content"]
 535 | 
 536 | 
 537 | async def _stream_openai_compatible(
 538 |     config: Dict[str, Any],
 539 |     model: str,
 540 |     api_key: str,
 541 |     messages: List[Dict[str, str]],
 542 |     system_prompt: str,
 543 |     temperature: float = 0.7,
 544 |     timeout: float = 90.0,
 545 | ) -> AsyncGenerator[str, None]:
 546 |     """Streaming call to any OpenAI-compatible endpoint. Yields text chunks."""
 547 |     base_url = config["base_url"].rstrip("/")
 548 |     chat_path = config.get("chat_path", "/chat/completions")
 549 |     
 550 |     requires_deployment = config.get("requires_deployment", False)
 551 |     if requires_deployment:
 552 |         api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
 553 |         url = f"{base_url}/{model}/chat/completions?api-version={api_version}"
 554 |         headers = {
 555 |             "Content-Type": "application/json",
 556 |             "api-key": api_key,
 557 |         }
 558 |     else:
 559 |         url = f"{base_url}{chat_path}"
 560 |         headers = {
 561 |             "Content-Type": "application/json",
 562 |             "Authorization": f"Bearer {api_key}" if api_key else "",
 563 |         }
 564 |         if not api_key:
 565 |             headers.pop("Authorization", None)
 566 | 
 567 |     if "openrouter" in base_url:
 568 |         headers["HTTP-Referer"] = "https://solospace.app"
 569 |         headers["X-Title"] = "Solospace"
 570 | 
 571 |     oa_msgs = _build_openai_messages(messages, system_prompt, model)
 572 | 
 573 |     payload: Dict[str, Any] = {
 574 |         "model": model,
 575 |         "messages": oa_msgs,
 576 |         "temperature": temperature,
 577 |         "max_tokens": 8192,
 578 |         "stream": True,
 579 |     }
 580 |     if any(m in model.lower() for m in ["o1", "o3", "deepseek-reasoner"]):
 581 |         payload.pop("temperature", None)
 582 | 
 583 |     async with httpx.AsyncClient() as client:
 584 |         async with client.stream("POST", url, json=payload, headers=headers, timeout=timeout) as resp:
 585 |             if resp.status_code != 200:
 586 |                 err_body = await resp.aread()
 587 |                 raise Exception(f"Provider stream error ({resp.status_code}): {err_body.decode()[:500]}")
 588 |             async for line in resp.aiter_lines():
 589 |                 line = line.strip()
 590 |                 if not line or not line.startswith("data:"):
 591 |                     continue
 592 |                 data_str = line[5:].strip()
 593 |                 if data_str == "[DONE]":
 594 |                     break
 595 |                 try:
 596 |                     obj = json.loads(data_str)
 597 |                     delta = obj.get("choices", [{}])[0].get("delta", {})
 598 |                     content = delta.get("content", "")
 599 |                     if content:
 600 |                         yield content
 601 |                 except (json.JSONDecodeError, IndexError, KeyError):
 602 |                     continue
 603 | 
 604 | 
 605 | # ─── Gemini Adapter ──────────────────────────────────────────────────
 606 | 
 607 | GEMINI_SAFETY = [
 608 |     {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
 609 |     {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
 610 |     {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
 611 |     {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
 612 | ]
 613 | 
 614 | 
 615 | async def _call_gemini(
 616 |     config: Dict[str, Any],
 617 |     model: str,
 618 |     api_key: str,
 619 |     messages: List[Dict[str, str]],
 620 |     system_prompt: str,
 621 |     temperature: float = 0.7,
 622 |     json_schema: Dict[str, Any] = None,
 623 |     timeout: float = 30.0,
 624 | ) -> str:
 625 |     """Non-streaming call to Gemini API."""
 626 |     base_url = config["base_url"].rstrip("/")
 627 |     url = f"{base_url}/models/{model}:generateContent?key={api_key}"
 628 | 
 629 |     gemini_data = _build_gemini_contents(messages, system_prompt)
 630 | 
 631 |     payload: Dict[str, Any] = {
 632 |         **gemini_data,
 633 |         "generationConfig": {"temperature": temperature},
 634 |         "safetySettings": GEMINI_SAFETY,
 635 |     }
 636 | 
 637 |     if json_schema:
 638 |         payload["generationConfig"]["responseMimeType"] = "application/json"
 639 |         payload["generationConfig"]["responseSchema"] = json_schema
 640 | 
 641 |     async with httpx.AsyncClient() as client:
 642 |         resp = await client.post(url, json=payload, timeout=timeout)
 643 |         if resp.status_code != 200:
 644 |             raise Exception(f"Gemini error ({resp.status_code}): {resp.text[:500]}")
 645 |         data = resp.json()
 646 |         return data["candidates"][0]["content"]["parts"][-1]["text"]
 647 | 
 648 | 
 649 | async def _stream_gemini(
 650 |     config: Dict[str, Any],
 651 |     model: str,
 652 |     api_key: str,
 653 |     messages: List[Dict[str, str]],
 654 |     system_prompt: str,
 655 |     temperature: float = 0.7,
 656 |     timeout: float = 90.0,
 657 | ) -> AsyncGenerator[str, None]:
 658 |     """Streaming call to Gemini API. Yields text chunks."""
 659 |     base_url = config["base_url"].rstrip("/")
 660 |     url = f"{base_url}/models/{model}:streamGenerateContent?alt=sse&key={api_key}"
 661 | 
 662 |     gemini_data = _build_gemini_contents(messages, system_prompt)
 663 | 
 664 |     payload: Dict[str, Any] = {
 665 |         **gemini_data,
 666 |         "generationConfig": {"temperature": temperature},
 667 |         "safetySettings": GEMINI_SAFETY,
 668 |     }
 669 | 
 670 |     async with httpx.AsyncClient() as client:
 671 |         async with client.stream("POST", url, json=payload, timeout=timeout) as resp:
 672 |             if resp.status_code != 200:
 673 |                 err_body = await resp.aread()
 674 |                 raise Exception(f"Gemini stream error ({resp.status_code}): {err_body.decode()[:500]}")
 675 |             async for line in resp.aiter_lines():
 676 |                 line = line.strip()
 677 |                 if not line or not line.startswith("data:"):
 678 |                     continue
 679 |                 data_str = line[5:].strip()
 680 |                 if not data_str:
 681 |                     continue
 682 |                 try:
 683 |                     obj = json.loads(data_str)
 684 |                     for cand in obj.get("candidates", []):
 685 |                         for part in cand.get("content", {}).get("parts", []):
 686 |                             text = part.get("text", "")
 687 |                             if text:
 688 |                                 yield text
 689 |                 except (json.JSONDecodeError, IndexError, KeyError):
 690 |                     continue
 691 | 
 692 | 
 693 | # ─── Claude Adapter ──────────────────────────────────────────────────
 694 | 
 695 | async def _call_claude(
 696 |     config: Dict[str, Any],
 697 |     model: str,
 698 |     api_key: str,
 699 |     messages: List[Dict[str, str]],
 700 |     system_prompt: str,
 701 |     temperature: float = 0.7,
 702 |     json_mode: bool = False,
 703 |     json_schema_hint: str = None,
 704 |     timeout: float = 30.0,
 705 | ) -> str:
 706 |     """Non-streaming call to Claude API."""
 707 |     base_url = config["base_url"].rstrip("/")
 708 |     url = f"{base_url}/messages"
 709 | 
 710 |     claude_data = _build_claude_messages(messages, system_prompt)
 711 | 
 712 |     headers = {
 713 |         "Content-Type": "application/json",
 714 |         "x-api-key": api_key,
 715 |         "anthropic-version": "2023-06-01",
 716 |     }
 717 | 
 718 |     payload: Dict[str, Any] = {
 719 |         "model": model,
 720 |         "max_tokens": 4096,
 721 |         "temperature": temperature,
 722 |         **claude_data,
 723 |     }
 724 | 
 725 |     if json_mode:
 726 |         json_instruction = "IMPORTANT: You MUST respond ONLY with a single valid JSON object. No markdown, no explanation, no code fences. Just raw JSON."
 727 |         if json_schema_hint:
 728 |             json_instruction += f"\n\nThe JSON should match this structure:\n{json_schema_hint}"
 729 |         payload["system"] = f"{json_instruction}\n\n{claude_data.get('system', '')}"
 730 | 
 731 |     async with httpx.AsyncClient() as client:
 732 |         resp = await client.post(url, json=payload, headers=headers, timeout=timeout)
 733 |         if resp.status_code != 200:
 734 |             raise Exception(f"Claude error ({resp.status_code}): {resp.text[:500]}")
 735 |         data = resp.json()
 736 |         text_parts = []
 737 |         for block in data.get("content", []):
 738 |             if block.get("type") == "text":
 739 |                 text_parts.append(block["text"])
 740 |         return "\n".join(text_parts)
 741 | 
 742 | 
 743 | async def _stream_claude(
 744 |     config: Dict[str, Any],
 745 |     model: str,
 746 |     api_key: str,
 747 |     messages: List[Dict[str, str]],
 748 |     system_prompt: str,
 749 |     temperature: float = 0.7,
 750 |     timeout: float = 90.0,
 751 | ) -> AsyncGenerator[str, None]:
 752 |     """Streaming call to Claude API. Yields text chunks."""
 753 |     base_url = config["base_url"].rstrip("/")
 754 |     url = f"{base_url}/messages"
 755 | 
 756 |     claude_data = _build_claude_messages(messages, system_prompt)
 757 | 
 758 |     headers = {
 759 |         "Content-Type": "application/json",
 760 |         "x-api-key": api_key,
 761 |         "anthropic-version": "2023-06-01",
 762 |     }
 763 | 
 764 |     payload: Dict[str, Any] = {
 765 |         "model": model,
 766 |         "max_tokens": 4096,
 767 |         "temperature": temperature,
 768 |         "stream": True,
 769 |         **claude_data,
 770 |     }
 771 | 
 772 |     async with httpx.AsyncClient() as client:
 773 |         async with client.stream("POST", url, json=payload, headers=headers, timeout=timeout) as resp:
 774 |             if resp.status_code != 200:
 775 |                 err_body = await resp.aread()
 776 |                 raise Exception(f"Claude stream error ({resp.status_code}): {err_body.decode()[:500]}")
 777 |             async for line in resp.aiter_lines():
 778 |                 line = line.strip()
 779 |                 if not line or not line.startswith("data:"):
 780 |                     continue
 781 |                 data_str = line[5:].strip()
 782 |                 if not data_str:
 783 |                     continue
 784 |                 try:
 785 |                     obj = json.loads(data_str)
 786 |                     event_type = obj.get("type", "")
 787 |                     if event_type == "content_block_delta":
 788 |                         delta = obj.get("delta", {})
 789 |                         if delta.get("type") == "text_delta":
 790 |                             text = delta.get("text", "")
 791 |                             if text:
 792 |                                 yield text
 793 |                 except (json.JSONDecodeError, KeyError):
 794 |                     continue
 795 | 
 796 | 
 797 | # ─── Cohere Adapter ──────────────────────────────────────────────────
 798 | 
 799 | async def _call_cohere(
 800 |     config: Dict[str, Any],
 801 |     model: str,
 802 |     api_key: str,
 803 |     messages: List[Dict[str, str]],
 804 |     system_prompt: str,
 805 |     temperature: float = 0.7,
 806 |     json_mode: bool = False,
 807 |     json_schema_hint: str = None,
 808 |     timeout: float = 30.0,
 809 | ) -> str:
 810 |     """Non-streaming call to Cohere v2 API."""
 811 |     base_url = config["base_url"].rstrip("/")
 812 |     url = f"{base_url}/chat"
 813 | 
 814 |     headers = {
 815 |         "Content-Type": "application/json",
 816 |         "Authorization": f"Bearer {api_key}",
 817 |     }
 818 | 
 819 |     chat_history = []
 820 |     for msg in messages[:-1]:
 821 |         chat_history.append({
 822 |             "role": "USER" if msg.get("role") == "user" else "CHATBOT",
 823 |             "message": msg.get("content", ""),
 824 |         })
 825 | 
 826 |     payload: Dict[str, Any] = {
 827 |         "model": model,
 828 |         "message": messages[-1].get("content", "") if messages else "",
 829 |         "chat_history": chat_history,
 830 |         "temperature": temperature,
 831 |     }
 832 | 
 833 |     if system_prompt:
 834 |         payload["preamble"] = system_prompt
 835 | 
 836 |     if json_mode:
 837 |         json_instr = "Respond ONLY with valid JSON."
 838 |         if json_schema_hint:
 839 |             json_instr += f" Structure: {json_schema_hint}"
 840 |         payload["message"] = f"{json_instr}\n\n{payload['message']}"
 841 | 
 842 |     async with httpx.AsyncClient() as client:
 843 |         resp = await client.post(url, json=payload, headers=headers, timeout=timeout)
 844 |         if resp.status_code != 200:
 845 |             raise Exception(f"Cohere error ({resp.status_code}): {resp.text[:500]}")
 846 |         data = resp.json()
 847 |         return data.get("text", "")
 848 | 
 849 | 
 850 | async def _stream_cohere(
 851 |     config: Dict[str, Any],
 852 |     model: str,
 853 |     api_key: str,
 854 |     messages: List[Dict[str, str]],
 855 |     system_prompt: str,
 856 |     temperature: float = 0.7,
 857 |     timeout: float = 90.0,
 858 | ) -> AsyncGenerator[str, None]:
 859 |     """Streaming call to Cohere v2 API. Yields text chunks."""
 860 |     base_url = config["base_url"].rstrip("/")
 861 |     url = f"{base_url}/chat"
 862 | 
 863 |     headers = {
 864 |         "Content-Type": "application/json",
 865 |         "Authorization": f"Bearer {api_key}",
 866 |     }
 867 | 
 868 |     chat_history = []
 869 |     for msg in messages[:-1]:
 870 |         chat_history.append({
 871 |             "role": "USER" if msg.get("role") == "user" else "CHATBOT",
 872 |             "message": msg.get("content", ""),
 873 |         })
 874 | 
 875 |     payload: Dict[str, Any] = {
 876 |         "model": model,
 877 |         "message": messages[-1].get("content", "") if messages else "",
 878 |         "chat_history": chat_history,
 879 |         "temperature": temperature,
 880 |         "stream": True,
 881 |     }
 882 |     if system_prompt:
 883 |         payload["preamble"] = system_prompt
 884 | 
 885 |     async with httpx.AsyncClient() as client:
 886 |         async with client.stream("POST", url, json=payload, headers=headers, timeout=timeout) as resp:
 887 |             if resp.status_code != 200:
 888 |                 err_body = await resp.aread()
 889 |                 raise Exception(f"Cohere stream error ({resp.status_code}): {err_body.decode()[:500]}")
 890 |             async for line in resp.aiter_lines():
 891 |                 line = line.strip()
 892 |                 if not line:
 893 |                     continue
 894 |                 try:
 895 |                     obj = json.loads(line)
 896 |                     event_type = obj.get("event_type", "")
 897 |                     if event_type == "text-generation":
 898 |                         text = obj.get("text", "")
 899 |                         if text:
 900 |                             yield text
 901 |                 except (json.JSONDecodeError, KeyError):
 902 |                     continue
 903 | 
 904 | 
 905 | # ─── AWS Bedrock Adapter ─────────────────────────────────────────────
 906 | 
 907 | async def _call_bedrock(
 908 |     config: Dict[str, Any],
 909 |     model: str,
 910 |     api_key: str,
 911 |     messages: List[Dict[str, str]],
 912 |     system_prompt: str,
 913 |     temperature: float = 0.7,
 914 |     json_mode: bool = False,
 915 |     json_schema_hint: str = None,
 916 |     timeout: float = 30.0,
 917 | ) -> str:
 918 |     """AWS Bedrock adapter using boto3 client."""
 919 |     try:
 920 |         import boto3
 921 |         from botocore.config import Config
 922 |     except ImportError:
 923 |         raise Exception("AWS Bedrock requires boto3 to be installed on the server.")
 924 | 
 925 |     conversation = []
 926 |     if system_prompt:
 927 |         conversation.append({"role": "system", "content": system_prompt})
 928 |     for msg in messages:
 929 |         # Convert assistant/model roles to assistant
 930 |         role = "assistant" if msg.get("role") in ["assistant", "model"] else "user"
 931 |         conversation.append({"role": role, "content": msg.get("content", "")})
 932 | 
 933 |     # Prepare client parameters
 934 |     client_params = {
 935 |         "region_name": os.environ.get("AWS_REGION", "us-east-1"),
 936 |         "config": Config(read_timeout=timeout)
 937 |     }
 938 |     if api_key:
 939 |         client_params["aws_access_key_id"] = api_key
 940 |         client_params["aws_secret_access_key"] = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
 941 | 
 942 |     client = boto3.client("bedrock-runtime", **client_params)
 943 | 
 944 |     # Payload mapping (standard Anthropic Converse API style or model-specific invocation)
 945 |     body = {
 946 |         "messages": conversation,
 947 |         "temperature": temperature,
 948 |         "max_tokens": 4096
 949 |     }
 950 |     if json_mode:
 951 |         body["responseFormat"] = {"type": "json_object"}
 952 |         # Bedrock models don't support native structured schemas globally yet, inject hint
 953 |         if json_schema_hint:
 954 |             conversation.append({
 955 |                 "role": "user",
 956 |                 "content": f"Respond strictly in valid JSON matching this schema:\n{json_schema_hint}"
 957 |             })
 958 | 
 959 |     try:
 960 |         # We use Converse API which is standard across Amazon Bedrock models
 961 |         system_blocks = [{"text": system_prompt}] if system_prompt else []
 962 |         converse_messages = []
 963 |         for msg in messages:
 964 |             role = "assistant" if msg.get("role") in ["assistant", "model"] else "user"
 965 |             converse_messages.append({
 966 |                 "role": role,
 967 |                 "content": [{"text": msg.get("content", "")}]
 968 |             })
 969 |         
 970 |         # Converse request
 971 |         resp = client.converse(
 972 |             modelId=model,
 973 |             messages=converse_messages,
 974 |             system=system_blocks,
 975 |             inferenceConfig={"temperature": temperature, "maxTokens": 4096}
 976 |         )
 977 |         return resp["output"]["message"]["content"][0]["text"]
 978 |     except Exception as e:
 979 |         raise Exception(f"Bedrock converse call failed: {str(e)}")
 980 | 
 981 | 
 982 | async def _stream_bedrock(
 983 |     config: Dict[str, Any],
 984 |     model: str,
 985 |     api_key: str,
 986 |     messages: List[Dict[str, str]],
 987 |     system_prompt: str,
 988 |     temperature: float = 0.7,
 989 |     timeout: float = 90.0,
 990 | ) -> AsyncGenerator[str, None]:
 991 |     """AWS Bedrock streaming adapter using converse_stream API."""
 992 |     try:
 993 |         import boto3
 994 |         from botocore.config import Config
 995 |     except ImportError:
 996 |         raise Exception("AWS Bedrock requires boto3 to be installed on the server.")
 997 | 
 998 |     client_params = {
 999 |         "region_name": os.environ.get("AWS_REGION", "us-east-1"),
1000 |         "config": Config(read_timeout=timeout)
1001 |     }
1002 |     if api_key:
1003 |         client_params["aws_access_key_id"] = api_key
1004 |         client_params["aws_secret_access_key"] = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
1005 | 
1006 |     client = boto3.client("bedrock-runtime", **client_params)
1007 | 
1008 |     system_blocks = [{"text": system_prompt}] if system_prompt else []
1009 |     converse_messages = []
1010 |     for msg in messages:
1011 |         role = "assistant" if msg.get("role") in ["assistant", "model"] else "user"
1012 |         converse_messages.append({
1013 |             "role": role,
1014 |             "content": [{"text": msg.get("content", "")}]
1015 |         })
1016 | 
1017 |     try:
1018 |         resp = client.converse_stream(
1019 |             modelId=model,
1020 |             messages=converse_messages,
1021 |             system=system_blocks,
1022 |             inferenceConfig={"temperature": temperature, "maxTokens": 4096}
1023 |         )
1024 |         for event in resp.get("stream", []):
1025 |             if "contentBlockDelta" in event:
1026 |                 delta = event["contentBlockDelta"].get("delta", {})
1027 |                 if "text" in delta:
1028 |                     yield delta["text"]
1029 |     except Exception as e:
1030 |         raise Exception(f"Bedrock converse stream failed: {str(e)}")
1031 | 
1032 | 
1033 | # ─── Unified Interface ───────────────────────────────────────────────
1034 | 
1035 | async def call_provider(
1036 |     provider: str,
1037 |     model: Optional[str],
1038 |     api_key: str,
1039 |     messages: List[Dict[str, str]],
1040 |     system_prompt: str = "",
1041 |     temperature: float = 0.7,
1042 |     json_schema: Dict[str, Any] = None,
1043 |     json_schema_hint: str = None,
1044 |     timeout: float = 30.0,
1045 |     fallback_provider: Optional[str] = None,
1046 |     api_keys: Optional[Dict[str, str]] = None,
1047 |     base_url: Optional[str] = None,
1048 | ) -> str:
1049 |     """Unified non-streaming call to any provider with retry and fallback routing."""
1050 |     config = get_provider_config(provider)
1051 |     if not config:
1052 |         raise Exception(f"Unknown provider: {provider}")
1053 | 
1054 |     resolved_model = model or config.get("default_model", "")
1055 |     resolved_base_url = base_url or config.get("base_url", "")
1056 |     
1057 |     cloned_config = dict(config)
1058 |     if resolved_base_url:
1059 |         cloned_config["base_url"] = resolved_base_url
1060 | 
1061 |     resolved_key = resolve_api_key(provider, api_key, api_keys)
1062 |     if not resolved_key and not cloned_config.get("is_local", False):
1063 |         raise Exception(f"API key missing for provider {provider}")
1064 | 
1065 |     adapter = cloned_config.get("adapter", "openai")
1066 |     wants_json = json_schema is not None or json_schema_hint is not None
1067 | 
1068 |     async def _call():
1069 |         if adapter == "gemini":
1070 |             return await _call_gemini(cloned_config, resolved_model, resolved_key, messages, system_prompt,
1071 |                                        temperature=temperature, json_schema=json_schema, timeout=timeout)
1072 |         elif adapter == "claude":
1073 |             return await _call_claude(cloned_config, resolved_model, resolved_key, messages, system_prompt,
1074 |                                        temperature=temperature, json_mode=wants_json,
1075 |                                        json_schema_hint=json_schema_hint, timeout=timeout)
1076 |         elif adapter == "cohere":
1077 |             return await _call_cohere(cloned_config, resolved_model, resolved_key, messages, system_prompt,
1078 |                                        temperature=temperature, json_mode=wants_json,
1079 |                                        json_schema_hint=json_schema_hint, timeout=timeout)
1080 |         elif adapter == "bedrock":
1081 |             return await _call_bedrock(cloned_config, resolved_model, resolved_key, messages, system_prompt,
1082 |                                        temperature=temperature, json_mode=wants_json,
1083 |                                        json_schema_hint=json_schema_hint, timeout=timeout)
1084 |         else:  # openai-compatible
1085 |             return await _call_openai_compatible(cloned_config, resolved_model, resolved_key, messages, system_prompt,
1086 |                                                  temperature=temperature, json_mode=wants_json,
1087 |                                                  json_schema_hint=json_schema_hint, timeout=timeout)
1088 | 
1089 |     try:
1090 |         return await call_with_retry(_call)
1091 |     except Exception as e:
1092 |         if fallback_provider and fallback_provider.lower() != provider.lower():
1093 |             print(f"[FALLBACK] Primary provider {provider} failed: {e}. Routing to fallback {fallback_provider}...")
1094 |             fallback_config = get_provider_config(fallback_provider)
1095 |             fallback_model = fallback_config.get("default_model", "")
1096 |             fallback_key = resolve_api_key(fallback_provider, None, api_keys)
1097 |             
1098 |             # Extract optional custom base URL for fallback from frontend dictionary if configured
1099 |             fallback_base_url = None
1100 |             
1101 |             return await call_provider(
1102 |                 provider=fallback_provider,
1103 |                 model=fallback_model,
1104 |                 api_key=fallback_key,
1105 |                 messages=messages,
1106 |                 system_prompt=system_prompt,
1107 |                 temperature=temperature,
1108 |                 json_schema=json_schema,
1109 |                 json_schema_hint=json_schema_hint,
1110 |                 timeout=timeout,
1111 |                 fallback_provider=None,
1112 |                 api_keys=api_keys,
1113 |                 base_url=fallback_base_url
1114 |             )
1115 |         else:
1116 |             raise
1117 | 
1118 | 
1119 | async def stream_provider(
1120 |     provider: str,
1121 |     model: Optional[str],
1122 |     api_key: str,
1123 |     messages: List[Dict[str, str]],
1124 |     system_prompt: str = "",
1125 |     temperature: float = 0.7,
1126 |     timeout: float = 90.0,
1127 |     fallback_provider: Optional[str] = None,
1128 |     api_keys: Optional[Dict[str, str]] = None,
1129 |     base_url: Optional[str] = None,
1130 | ) -> AsyncGenerator[str, None]:
1131 |     """Unified streaming call to any provider with retry and fallback routing."""
1132 |     config = get_provider_config(provider)
1133 |     if not config:
1134 |         raise Exception(f"Unknown provider: {provider}")
1135 | 
1136 |     resolved_model = model or config.get("default_model", "")
1137 |     resolved_base_url = base_url or config.get("base_url", "")
1138 |     
1139 |     cloned_config = dict(config)
1140 |     if resolved_base_url:
1141 |         cloned_config["base_url"] = resolved_base_url
1142 | 
1143 |     resolved_key = resolve_api_key(provider, api_key, api_keys)
1144 |     if not resolved_key and not cloned_config.get("is_local", False):
1145 |         raise Exception(f"API key missing for provider {provider}")
1146 | 
1147 |     adapter = cloned_config.get("adapter", "openai")
1148 | 
1149 |     async def _stream():
1150 |         if adapter == "gemini":
1151 |             async for chunk in _stream_gemini(cloned_config, resolved_model, resolved_key, messages, system_prompt,
1152 |                                                temperature=temperature, timeout=timeout):
1153 |                 yield chunk
1154 |         elif adapter == "claude":
1155 |             async for chunk in _stream_claude(cloned_config, resolved_model, resolved_key, messages, system_prompt,
1156 |                                                temperature=temperature, timeout=timeout):
1157 |                 yield chunk
1158 |         elif adapter == "cohere":
1159 |             async for chunk in _stream_cohere(cloned_config, resolved_model, resolved_key, messages, system_prompt,
1160 |                                                temperature=temperature, timeout=timeout):
1161 |                 yield chunk
1162 |         elif adapter == "bedrock":
1163 |             async for chunk in _stream_bedrock(cloned_config, resolved_model, resolved_key, messages, system_prompt,
1164 |                                                temperature=temperature, timeout=timeout):
1165 |                 yield chunk
1166 |         else:  # openai-compatible
1167 |             async for chunk in _stream_openai_compatible(cloned_config, resolved_model, resolved_key, messages, system_prompt,
1168 |                                                          temperature=temperature, timeout=timeout):
1169 |                 yield chunk
1170 | 
1171 |     retries = 0
1172 |     while retries <= MAX_RETRIES:
1173 |         try:
1174 |             async for chunk in _stream():
1175 |                 yield chunk
1176 |             return
1177 |         except Exception as e:
1178 |             retries += 1
1179 |             if retries > MAX_RETRIES:
1180 |                 if fallback_provider and fallback_provider.lower() != provider.lower():
1181 |                     print(f"[FALLBACK STREAM] Primary {provider} failed: {e}. Switching to fallback {fallback_provider}...")
1182 |                     fallback_config = get_provider_config(fallback_provider)
1183 |                     fallback_model = fallback_config.get("default_model", "")
1184 |                     fallback_key = resolve_api_key(fallback_provider, None, api_keys)
1185 |                     
1186 |                     async for chunk in stream_provider(
1187 |                         provider=fallback_provider,
1188 |                         model=fallback_model,
1189 |                         api_key=fallback_key,
1190 |                         messages=messages,
1191 |                         system_prompt=system_prompt,
1192 |                         temperature=temperature,
1193 |                         timeout=timeout,
1194 |                         fallback_provider=None,
1195 |                         api_keys=api_keys,
1196 |                         base_url=None
1197 |                     ):
1198 |                         yield chunk
1199 |                     return
1200 |                 else:
1201 |                     raise
1202 |             delay = min(MAX_DELAY, BASE_DELAY * (2 ** retries))
1203 |             delay += random.uniform(-JITTER_FACTOR * delay, JITTER_FACTOR * delay)
1204 |             await asyncio.sleep(delay)
1205 | 
1206 | 
1207 | async def call_provider_json(
1208 |     provider: str,
1209 |     model: Optional[str],
1210 |     api_key: str,
1211 |     messages: List[Dict[str, str]],
1212 |     system_prompt: str = "",
1213 |     temperature: float = 0.2,
1214 |     json_schema: Dict[str, Any] = None,
1215 |     timeout: float = 30.0,
1216 |     fallback_provider: Optional[str] = None,
1217 |     api_keys: Optional[Dict[str, str]] = None,
1218 |     base_url: Optional[str] = None,
1219 | ) -> Dict[str, Any]:
1220 |     """Unified JSON completions call with fallback validation."""
1221 |     schema_hint = None
1222 |     if json_schema:
1223 |         schema_hint = json.dumps(json_schema, indent=2)
1224 | 
1225 |     response_text = await call_provider(
1226 |         provider=provider,
1227 |         model=model,
1228 |         api_key=api_key,
1229 |         messages=messages,
1230 |         system_prompt=system_prompt,
1231 |         temperature=temperature,
1232 |         json_schema=json_schema,
1233 |         json_schema_hint=schema_hint,
1234 |         timeout=timeout,
1235 |         fallback_provider=fallback_provider,
1236 |         api_keys=api_keys,
1237 |         base_url=base_url
1238 |     )
1239 |     
1240 |     parsed = extract_json_from_text(response_text)
1241 |     if parsed is None:
1242 |         raise ValueError(f"Failed to extract JSON from response: {response_text[:1000]}")
1243 |     return parsed
1244 | 
1245 | 
1246 | # ─── Embedding Abstraction ───────────────────────────────────────────
1247 | 
1248 | async def get_embedding(provider: str, api_key: str, text: str, api_keys: Optional[Dict[str, str]] = None) -> List[float]:
1249 |     """Unified embedding generator."""
1250 |     resolved_key = resolve_api_key(provider, api_key, api_keys)
1251 |     if not resolved_key:
1252 |         return []
1253 | 
1254 |     if provider.lower() == "gemini":
1255 |         url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={resolved_key}"
1256 |         payload = {
1257 |             "model": "models/text-embedding-004",
1258 |             "content": {"parts": [{"text": text}]}
1259 |         }
1260 |         async with httpx.AsyncClient() as client:
1261 |             try:
1262 |                 r = await client.post(url, json=payload, timeout=15.0)
1263 |                 if r.status_code == 200:
1264 |                     return r.json().get("embedding", {}).get("values", [])
1265 |             except Exception as e:
1266 |                 print(f"[EMBEDDING ERROR] Gemini embedding failed: {e}")
1267 |     elif provider.lower() == "openai":
1268 |         url = "https://api.openai.com/v1/embeddings"
1269 |         headers = {
1270 |             "Content-Type": "application/json",
1271 |             "Authorization": f"Bearer {resolved_key}"
1272 |         }
1273 |         payload = {
1274 |             "model": "text-embedding-3-small",
1275 |             "input": text
1276 |         }
1277 |         async with httpx.AsyncClient() as client:
1278 |             try:
1279 |                 r = await client.post(url, json=payload, headers=headers, timeout=15.0)
1280 |                 if r.status_code == 200:
1281 |                     return r.json().get("data", [{}])[0].get("embedding", [])
1282 |             except Exception as e:
1283 |                 print(f"[EMBEDDING ERROR] OpenAI embedding failed: {e}")
1284 |     return []
1285 | 
1286 | 
1287 | # ─── Dynamic Model Fetching ─────────────────────────────────────────
1288 | 
1289 | async def fetch_models_from_provider(
1290 |     provider: str,
1291 |     api_key: str,
1292 |     api_keys: Optional[Dict[str, str]] = None,
1293 |     base_url: Optional[str] = None,
1294 | ) -> List[Dict[str, Any]]:
1295 |     """Fetch available models from the provider's API dynamically."""
1296 |     config = get_provider_config(provider)
1297 |     if not config:
1298 |         return []
1299 |     
1300 |     resolved_key = resolve_api_key(provider, api_key, api_keys)
1301 |     if not resolved_key and not config.get("is_local", False):
1302 |         return []
1303 | 
1304 |     resolved_base_url = base_url or config.get("base_url", "")
1305 |     if not resolved_base_url:
1306 |         return config.get("models", [])
1307 | 
1308 |     adapter = config.get("adapter", "openai")
1309 |     base_url_str = resolved_base_url.rstrip("/")
1310 |     
1311 |     if adapter in ("openai", "openai-compatible"):
1312 |         url = f"{base_url_str}/models"
1313 |         headers = {}
1314 |         if resolved_key:
1315 |             if config.get("requires_deployment"):
1316 |                 headers["api-key"] = resolved_key
1317 |             else:
1318 |                 headers["Authorization"] = f"Bearer {resolved_key}"
1319 | 
1320 |         try:
1321 |             async with httpx.AsyncClient(timeout=10.0) as client:
1322 |                 resp = await client.get(url, headers=headers)
1323 |                 if resp.status_code == 200:
1324 |                     data = resp.json()
1325 |                     models = []
1326 |                     for item in data.get("data", []):
1327 |                         model_id = item.get("id")
1328 |                         if model_id:
1329 |                             models.append({
1330 |                                 "id": model_id,
1331 |                                 "name": model_id,
1332 |                                 "tier": "custom"
1333 |                             })
1334 |                     return models
1335 |         except Exception as e:
1336 |             print(f"[FETCH MODELS ERROR] Failed to fetch models for {provider}: {e}")
1337 |             
1338 |     return config.get("models", [])
1339 |
```

### File: `Backend/requirements.txt`

> 7 lines | 0.1 KB

```text
1 | fastapi>=0.100.0
2 | uvicorn>=0.22.0
3 | httpx>=0.24.0
4 | pydantic>=2.0
5 | beautifulsoup4>=4.12.0
6 | boto3>=1.28.0
7 |
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

### File: `Frontend/app/api/gemini/echohouse/init/route.ts`

> 32 lines | 0.8 KB

```typescript
 1 | import { NextResponse } from "next/server";
 2 | 
 3 | export async function POST(req: Request) {
 4 |   try {
 5 |     const body = await req.json();
 6 | 
 7 |     const pyResponse = await fetch("http://127.0.0.1:8000/echohouse/init", {
 8 |       method: "POST",
 9 |       headers: {
10 |         "Content-Type": "application/json",
11 |       },
12 |       body: JSON.stringify(body),
13 |     });
14 | 
15 |     if (!pyResponse.ok) {
16 |       return NextResponse.json(
17 |         { error: `Backend error: ${pyResponse.status}` },
18 |         { status: pyResponse.status }
19 |       );
20 |     }
21 | 
22 |     const data = await pyResponse.json();
23 |     return NextResponse.json(data);
24 |   } catch (err: any) {
25 |     console.error("Proxy error — Python backend unreachable for EchoHouse init:", err.message);
26 |     return NextResponse.json(
27 |       { error: "Python backend is unavailable" },
28 |       { status: 503 }
29 |     );
30 |   }
31 | }
32 |
```

### File: `Frontend/app/api/gemini/echohouse/simulate/route.ts`

> 80 lines | 2.7 KB

```typescript
 1 | import { NextRequest } from "next/server";
 2 | 
 3 | export async function POST(req: NextRequest) {
 4 |   try {
 5 |     const body = await req.json();
 6 | 
 7 |     const pyResponse = await fetch("http://127.0.0.1:8000/echohouse/simulate", {
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
18 |           const errMsg = `**Backend Error (${pyResponse.status})**\n\n${errorData.detail || "The EchoHouse simulation returned an error."}`;
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
52 |     console.error("Proxy error — Python backend unreachable for EchoHouse simulate:", err.message);
53 |     
54 |     const errStream = new ReadableStream({
55 |       start(controller) {
56 |         const errMsg = "**Python backend is unavailable.**\n\nPlease ensure the backend server is running.";
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

### File: `Frontend/app/api/gemini/models/route.ts`

> 32 lines | 0.8 KB

```typescript
 1 | import { NextResponse } from "next/server";
 2 | 
 3 | export async function POST(req: Request) {
 4 |   try {
 5 |     const body = await req.json();
 6 | 
 7 |     const pyResponse = await fetch("http://127.0.0.1:8000/models", {
 8 |       method: "POST",
 9 |       headers: {
10 |         "Content-Type": "application/json",
11 |       },
12 |       body: JSON.stringify(body),
13 |     });
14 | 
15 |     if (!pyResponse.ok) {
16 |       return NextResponse.json(
17 |         { error: `Backend error: ${pyResponse.status}` },
18 |         { status: pyResponse.status }
19 |       );
20 |     }
21 | 
22 |     const data = await pyResponse.json();
23 |     return NextResponse.json(data);
24 |   } catch (err: any) {
25 |     console.error("Proxy error — Python backend unreachable:", err.message);
26 |     return NextResponse.json(
27 |       { error: "Python backend is unavailable" },
28 |       { status: 503 }
29 |     );
30 |   }
31 | }
32 |
```

### File: `Frontend/app/api/gemini/ollama/route.ts`

> 29 lines | 0.8 KB

```typescript
 1 | import { NextResponse } from "next/server";
 2 | 
 3 | export async function GET() {
 4 |   try {
 5 |     const pyResponse = await fetch("http://127.0.0.1:8000/ollama/models", {
 6 |       method: "GET",
 7 |       headers: {
 8 |         "Content-Type": "application/json",
 9 |       },
10 |     });
11 | 
12 |     if (!pyResponse.ok) {
13 |       return NextResponse.json(
14 |         { error: `Backend error: ${pyResponse.status}`, models: [], ollama_available: false },
15 |         { status: pyResponse.status }
16 |       );
17 |     }
18 | 
19 |     const data = await pyResponse.json();
20 |     return NextResponse.json(data);
21 |   } catch (err: any) {
22 |     console.error("Proxy error — Python backend unreachable for Ollama:", err.message);
23 |     return NextResponse.json(
24 |       { error: "Python backend is unavailable", models: [], ollama_available: false },
25 |       { status: 503 }
26 |     );
27 |   }
28 | }
29 |
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

### File: `Frontend/app/api/gemini/sessions/[id]/route.ts`

> 46 lines | 1.6 KB

```typescript
 1 | import { NextRequest } from "next/server";
 2 | 
 3 | export async function GET(
 4 |   req: NextRequest,
 5 |   { params }: { params: Promise<{ id: string }> }
 6 | ) {
 7 |   try {
 8 |     const { id } = await params;
 9 |     const pyResponse = await fetch(`http://127.0.0.1:8000/sessions/${id}`, { method: "GET" });
10 | 
11 |     if (!pyResponse.ok) {
12 |       const errorData = await pyResponse.json().catch(() => ({ detail: `Backend error: ${pyResponse.status}` }));
13 |       return Response.json(errorData, { status: pyResponse.status });
14 |     }
15 | 
16 |     const data = await pyResponse.json();
17 |     return Response.json(data);
18 |   } catch (err: any) {
19 |     const { id } = await params;
20 |     console.error(`Proxy error for GET /sessions/${id} — Python backend unreachable:`, err.message);
21 |     return Response.json({ detail: "Python backend is unavailable." }, { status: 503 });
22 |   }
23 | }
24 | 
25 | export async function DELETE(
26 |   req: NextRequest,
27 |   { params }: { params: Promise<{ id: string }> }
28 | ) {
29 |   try {
30 |     const { id } = await params;
31 |     const pyResponse = await fetch(`http://127.0.0.1:8000/sessions/${id}`, { method: "DELETE" });
32 | 
33 |     if (!pyResponse.ok) {
34 |       const errorData = await pyResponse.json().catch(() => ({ detail: `Backend error: ${pyResponse.status}` }));
35 |       return Response.json(errorData, { status: pyResponse.status });
36 |     }
37 | 
38 |     const data = await pyResponse.json();
39 |     return Response.json(data);
40 |   } catch (err: any) {
41 |     const { id } = await params;
42 |     console.error(`Proxy error for DELETE /sessions/${id} — Python backend unreachable:`, err.message);
43 |     return Response.json({ detail: "Python backend is unavailable." }, { status: 503 });
44 |   }
45 | }
46 |
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

> 207 lines | 5.2 KB

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

> 30 lines | 0.9 KB

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

> 1674 lines | 88.5 KB

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
  79 |   const fallbackProvider = useWorkflowStore((s) => s.fallbackProvider);
  80 |   const providerBaseUrls = useWorkflowStore((s) => s.providerBaseUrls);
  81 |   const providerModels = useWorkflowStore((s) => s.providerModels);
  82 |   const setFallbackProvider = useWorkflowStore((s) => s.setFallbackProvider);
  83 |   const setProviderBaseUrl = useWorkflowStore((s) => s.setProviderBaseUrl);
  84 |   const fetchProviderModels = useWorkflowStore((s) => s.fetchProviderModels);
  85 | 
  86 |   const triggerSteerOrchestration = useWorkflowStore((s) => s.triggerSteerOrchestration);
  87 |   const setChatMessages = useWorkflowStore((s) => s.setChatMessages);
  88 |   const createSession = useWorkflowStore((s) => s.createSession);
  89 |   const switchSession = useWorkflowStore((s) => s.switchSession);
  90 |   const cancelOrchestration = useWorkflowStore((s) => s.cancelOrchestration);
  91 |   const followUpSuggestions = useWorkflowStore((s) => s.followUpSuggestions);
  92 |   const fetchSessions = useWorkflowStore((s) => s.fetchSessions);
  93 |   const loadSessionFromDb = useWorkflowStore((s) => s.loadSessionFromDb);
  94 |   const deleteSessionFromDb = useWorkflowStore((s) => s.deleteSessionFromDb);
  95 | 
  96 |   const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  97 |   const copyToClipboard = (text: string, msgId: string) => {
  98 |     navigator.clipboard.writeText(text);
  99 |     setCopiedMsgId(msgId);
 100 |     setTimeout(() => setCopiedMsgId(null), 2000);
 101 |   };
 102 | 
 103 |   const chatContainerRef = useRef<HTMLDivElement>(null);
 104 |   const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
 105 | 
 106 |   const handleScroll = () => {
 107 |     const container = chatContainerRef.current;
 108 |     if (!container) return;
 109 |     const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
 110 |     setShouldAutoScroll(isAtBottom);
 111 |   };
 112 | 
 113 |   const textareaRef = useRef<HTMLTextAreaElement>(null);
 114 |   const adjustTextareaHeight = () => {
 115 |     const tx = textareaRef.current;
 116 |     if (tx) {
 117 |       tx.style.height = "auto";
 118 |       tx.style.height = `${Math.min(tx.scrollHeight, 200)}px`;
 119 |     }
 120 |   };
 121 | 
 122 |   // Screen and Tab States
 123 |   const [workspaceState, setWorkspaceState] = useState<"home" | "active">("home");
 124 |   const [currentTab, setCurrentTab] = useState<"chat" | "arena">("chat");
 125 |   const [isAutoMode, setIsAutoMode] = useState<boolean>(true);
 126 |   const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(true);
 127 |   const [isLoadingSession, setIsLoadingSession] = useState<boolean>(false);
 128 | 
 129 |   // Input fields
 130 |   const [userQuery, setUserQuery] = useState<string>("");
 131 |   const activeSession = activeSessionId ? sessions[activeSessionId] : null;
 132 |   const activePrompt = activeSession ? activeSession.prompt : "";
 133 | 
 134 |   useEffect(() => {
 135 |     adjustTextareaHeight();
 136 |   }, [userQuery]);
 137 | 
 138 |   // API key — read directly from Zustand (not local state, to avoid disconnect)
 139 |   const [isSecretOpen, setIsSecretOpen] = useState<boolean>(false);
 140 |   const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
 141 | 
 142 |   // Tooltip helper state for collapsed sidebar
 143 |   const [hoveredSidebarItem, setHoveredSidebarItem] = useState<string | null>(null);
 144 | 
 145 |   // Node Configuration Panel
 146 |   const [isConfigPanelOpen, setIsConfigPanelOpen] = useState<boolean>(false);
 147 |   const [newRuleText, setNewRuleText] = useState<string>("");
 148 | 
 149 |   // Chat scroll ref
 150 |   const chatEndRef = useRef<HTMLDivElement>(null);
 151 | 
 152 |   // List of available tools in the Arena tool panel
 153 |   const toolsList = [
 154 |     { name: "Web Search", icon: <Globe className="w-4 h-4" />, desc: "Real-time Google search indices" },
 155 |     { name: "Memory", icon: <Database className="w-4 h-4" />, desc: "Persistent memory vector vault" },
 156 |     { name: "Browser", icon: <Eye className="w-4 h-4" />, desc: "Headless browser sandbox access" },
 157 |     { name: "File Upload", icon: <UploadCloud className="w-4 h-4" />, desc: "Parsing spreadsheet/code datasets" },
 158 |     { name: "Vision", icon: <Eye className="w-4 h-4" />, desc: "Image recognition & layout review" },
 159 |     { name: "Voice", icon: <Mic className="w-4 h-4" />, desc: "Acoustic synthesis & recognition" },
 160 |     { name: "Code Executor", icon: <Terminal className="w-4 h-4" />, desc: "Sandboxed node/python runs" },
 161 |     { name: "API Connector", icon: <GitFork className="w-4 h-4" />, desc: "Synchronize external webhooks" }
 162 |   ];
 163 | 
 164 |   // Sync config panel with selectedNodeId
 165 |   useEffect(() => {
 166 |     if (selectedNodeId) {
 167 |       setIsConfigPanelOpen(true);
 168 |     } else {
 169 |       setIsConfigPanelOpen(false);
 170 |     }
 171 |   }, [selectedNodeId]);
 172 | 
 173 |   // Synchronize modal's local display state when it opens
 174 |   const [apiKeyInput, setApiKeyInput] = useState<string>("");
 175 |   const [selectedProvider, setSelectedProvider] = useState<string>("gemini");
 176 |   const [selectedModel, setSelectedModel] = useState<string>("");
 177 |   const [baseUrlInput, setBaseUrlInput] = useState<string>("");
 178 |   const [fallbackProviderInput, setFallbackProviderInput] = useState<string>("");
 179 |   const [isFetchingModels, setIsFetchingModels] = useState<boolean>(false);
 180 |   const [modelsFetchStatus, setModelsFetchStatus] = useState<string>("");
 181 | 
 182 |   useEffect(() => {
 183 |     if (isSecretOpen) {
 184 |       setSelectedProvider(provider);
 185 |       setSelectedModel(model);
 186 |       setApiKeyInput(apiKeys[provider] || apiKey || "");
 187 |       setBaseUrlInput(providerBaseUrls[provider] || "");
 188 |       setFallbackProviderInput(fallbackProvider || "");
 189 |       setModelsFetchStatus("");
 190 |     }
 191 |   }, [isSecretOpen, provider, model, apiKeys, apiKey, providerBaseUrls, fallbackProvider]);
 192 | 
 193 |   // When selectedProvider changes, set selectedModel to its default model, and load key and base url
 194 |   useEffect(() => {
 195 |     if (isSecretOpen && availableProviders[selectedProvider]) {
 196 |       const pConfig = availableProviders[selectedProvider];
 197 |       const modelsList = providerModels[selectedProvider] || pConfig.models || [];
 198 |       const modelExists = modelsList.some((m: any) => m.id === selectedModel);
 199 |       if (!modelExists) {
 200 |         setSelectedModel(pConfig.default_model);
 201 |       }
 202 |       setApiKeyInput(apiKeys[selectedProvider] || "");
 203 |       setBaseUrlInput(providerBaseUrls[selectedProvider] || pConfig.base_url || "");
 204 |       setModelsFetchStatus("");
 205 |     }
 206 |   }, [selectedProvider, availableProviders, providerModels]);
 207 | 
 208 |   // Scroll helper
 209 |   const scrollToBottom = () => {
 210 |     if (shouldAutoScroll) {
 211 |       chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
 212 |     }
 213 |   };
 214 | 
 215 |   // Auto-scroll chat to bottom if enabled
 216 |   useEffect(() => {
 217 |     scrollToBottom();
 218 |   }, [chatMessages, isThinking, shouldAutoScroll]);
 219 | 
 220 |   // Auto-scroll when chat tab becomes active
 221 |   useEffect(() => {
 222 |     if (workspaceState === "active" && currentTab === "chat") {
 223 |       scrollToBottom();
 224 |     }
 225 |   }, [currentTab, workspaceState]);
 226 | 
 227 |   // Reset to home when active session is deleted
 228 |   useEffect(() => {
 229 |     if (workspaceState === "active" && activeSessionId === null) {
 230 |       setWorkspaceState("home");
 231 |       setCurrentTab("chat");
 232 |       setUserQuery("");
 233 |     }
 234 |   }, [activeSessionId, workspaceState]);
 235 | 
 236 |   // Load sessions and available providers from DB on mount
 237 |   useEffect(() => {
 238 |     fetchSessions().catch(e => console.error("Failed to load sessions:", e));
 239 |     fetchAvailableProviders().catch(e => console.error("Failed to load providers:", e));
 240 |   }, []);
 241 | 
 242 |   const handleCloseConfigPanel = () => {
 243 |     setIsConfigPanelOpen(false);
 244 |     setSelectedNodeId(null);
 245 |   };
 246 | 
 247 |   // Orchestrator — always stays in chat first
 248 |   const startOrchestration = (promptText: string) => {
 249 |     if (!promptText.trim()) return;
 250 |     setWorkspaceState("active");
 251 |     setCurrentTab("chat"); // ALWAYS stay in chat
 252 | 
 253 |     let sessionId = activeSessionId;
 254 |     if (!sessionId) {
 255 |       sessionId = createSession(promptText, isAutoMode ? "auto" : "custom");
 256 |     }
 257 | 
 258 |     setExecutionState("running");
 259 |     triggerSteerOrchestration(promptText, isAutoMode);
 260 |     setUserQuery("");
 261 |   };
 262 | 
 263 |   // Node editing actions
 264 |   const handleAddRule = () => {
 265 |     if (!newRuleText.trim() || !selectedNodeId) return;
 266 |     addRule(selectedNodeId, newRuleText.trim());
 267 |     setNewRuleText("");
 268 |   };
 269 | 
 270 |   const handleDeleteRule = (ruleIndex: number) => {
 271 |     if (!selectedNodeId) return;
 272 |     deleteRule(selectedNodeId, ruleIndex);
 273 |   };
 274 | 
 275 |   const activeNodeDetail = nodes.find(n => n.id === selectedNodeId) as any;
 276 | 
 277 |   // ── Thinking indicator bubble
 278 |   const ThinkingBubble = () => (
 279 |     <motion.div
 280 |       initial={{ opacity: 0, y: 8 }}
 281 |       animate={{ opacity: 1, y: 0 }}
 282 |       exit={{ opacity: 0, y: -4 }}
 283 |       className="flex flex-col gap-1.5 py-2 px-1"
 284 |     >
 285 |       <div className="flex items-center gap-2">
 286 |         <span className="text-xs text-neutral-500 italic">Thinking</span>
 287 |         <span className="flex gap-1">
 288 |           {[0, 1, 2].map(i => (
 289 |             <span
 290 |               key={i}
 291 |               className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce"
 292 |               style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
 293 |             />
 294 |           ))}
 295 |         </span>
 296 |       </div>
 297 |       {statusMessage && (
 298 |         <span className="text-[10px] font-mono text-neutral-600 pl-0.5 truncate max-w-sm">
 299 |           {statusMessage}
 300 |         </span>
 301 |       )}
 302 |       {liveThoughts && (
 303 |         <div className="mt-1 text-[10px] text-neutral-500 font-sans leading-relaxed max-w-lg whitespace-pre-wrap border-l-2 border-neutral-800 pl-2">
 304 |           {liveThoughts.slice(-400)}
 305 |         </div>
 306 |       )}
 307 |     </motion.div>
 308 |   );
 309 | 
 310 |   // ── Collapsible agent trace (real data from backend)
 311 |   const AgentTraceBlock = ({ logs, thinkingSummary }: { logs: AgentTalkLog[], thinkingSummary?: string }) => {
 312 |     if (logs.length === 0 && !thinkingSummary) return null;
 313 |     return (
 314 |       <div className="border border-[#1f1f1f] rounded-xl overflow-hidden bg-[#050505] mt-3 max-w-2xl w-full">
 315 |         <details className="group" open>
 316 |           <summary className="flex items-center justify-between p-3 cursor-pointer select-none text-[11px] font-semibold text-neutral-500 hover:text-white hover:bg-neutral-900/40 transition-colors">
 317 |             <div className="flex items-center gap-2">
 318 |               <Sparkles className="w-3 h-3 text-neutral-500 group-hover:text-cyan-400 transition-colors" />
 319 |               <span className="font-mono text-[10px] tracking-wider uppercase">Agent Trace & Thinking</span>
 320 |             </div>
 321 |             <div className="flex items-center gap-2">
 322 |               {logs.length > 0 && <span className="text-[9px] text-neutral-600 font-mono">{logs.length} specialist{logs.length !== 1 ? "s" : ""}</span>}
 323 |               <ChevronRight className="w-3.5 h-3.5 text-neutral-600 group-open:rotate-90 transition-transform" />
 324 |             </div>
 325 |           </summary>
 326 |           <div className="border-t border-[#1f1f1f] p-3 space-y-3 bg-[#030303]">
 327 |             {thinkingSummary && (
 328 |               <div className="space-y-1.5 pb-2 border-b border-[#0d0d0d] last:border-0 last:pb-0">
 329 |                 <span className="text-[9px] font-mono text-neutral-500 font-bold uppercase tracking-wider">Reasoning Process</span>
 330 |                 <p className="text-[11px] text-neutral-400 leading-relaxed font-sans whitespace-pre-wrap">
 331 |                   {thinkingSummary}
 332 |                 </p>
 333 |               </div>
 334 |             )}
 335 |             {logs.map((log) => (
 336 |               <div key={log.id} className="flex gap-2 items-start text-[10.5px] leading-relaxed border-b border-[#0d0d0d] pb-2 last:border-0 last:pb-0">
 337 |                 <div className="w-5 h-5 rounded-md bg-neutral-900 flex items-center justify-center border border-white/5 shrink-0 select-none text-[10px] font-mono text-neutral-400">
 338 |                   {log.senderIcon === "science" ? "[S]" : log.senderIcon === "code" ? "[C]" : log.senderIcon === "trending_up" ? "[T]" : log.senderIcon === "present_to_all" ? "[U]" : "[G]"}
 339 |                 </div>
 340 |                 <div className="flex-1 min-w-0">
 341 |                   <div className="flex justify-between items-baseline select-none">
 342 |                     <span className="font-bold text-white uppercase tracking-wider text-[8.5px] leading-none">{log.senderName}</span>
 343 |                     <span className="text-[7.5px] text-neutral-600 font-mono leading-none">{log.timestamp}</span>
 344 |                   </div>
 345 |                   <p className="text-neutral-400 mt-0.5 font-sans leading-relaxed">{log.text}</p>
 346 |                 </div>
 347 |               </div>
 348 |             ))}
 349 |           </div>
 350 |         </details>
 351 |       </div>
 352 |     );
 353 |   };
 354 | 
 355 |   return (
 356 |     <div className="flex h-screen w-full bg-black text-[#f5f5f5] overflow-hidden font-sans">
 357 | 
 358 |       <aside
 359 |         className={`flex flex-col h-full bg-[#0d0d0d] border-r border-[#1f1f1f] shrink-0 transition-all duration-300 z-30 select-none ${
 360 |           isSidebarExpanded ? "w-64" : "w-[60px]"
 361 |         }`}
 362 |         onClick={(e) => {
 363 |           if (!isSidebarExpanded) {
 364 |             const target = e.target as HTMLElement;
 365 |             if (!target.closest('button, a, input')) {
 366 |               setIsSidebarExpanded(true);
 367 |             }
 368 |           }
 369 |         }}
 370 |       >
 371 |         {/* Top Header Area */}
 372 |         <div className="flex items-center gap-3 h-16 border-b border-[#1f1f1f] px-4 justify-between">
 373 |           {isSidebarExpanded ? (
 374 |             <div className="flex items-center gap-2.5">
 375 |               <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
 376 |                 <Bot className="w-4 h-4 text-black stroke-[2.5]" />
 377 |               </div>
 378 |               <div>
 379 |                 <h1 className="text-sm font-bold text-white tracking-tight leading-none">Solospace</h1>
 380 |               </div>
 381 |             </div>
 382 |           ) : (
 383 |             <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center mx-auto">
 384 |               <Bot className="w-4 h-4 text-black stroke-[2.5]" />
 385 |             </div>
 386 |           )}
 387 |           {isSidebarExpanded && (
 388 |             <button
 389 |               onClick={() => setIsSidebarExpanded(false)}
 390 |               className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 transition-colors cursor-pointer"
 391 |               title="Collapse sidebar"
 392 |             >
 393 |               <ChevronLeft className="w-4 h-4" />
 394 |             </button>
 395 |           )}
 396 |         </div>
 397 | 
 398 |         {/* Sidebar Nav Buttons */}
 399 |         <nav className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto custom-scrollbar">
 400 | 
 401 | 
 402 | 
 403 |           {/* New Chat Button */}
 404 |           <button
 405 |             id="new-chat-btn"
 406 |             onClick={() => {
 407 |               const ctrl = useWorkflowStore.getState().abortController;
 408 |               if (ctrl) ctrl.abort();
 409 | 
 410 |               setWorkspaceState("home");
 411 |               setUserQuery("");
 412 |               useWorkflowStore.setState({
 413 |                 activeSessionId: null,
 414 |                 nodes: [],
 415 |                 edges: [],
 416 |                 chatMessages: [],
 417 |                 agentTalkLogs: [],
 418 |                 executionState: "setup",
 419 |                 statusMessage: "",
 420 |                 isThinking: false,
 421 |                 isOrchestrating: false,
 422 |                 liveThoughts: "",
 423 |                 pendingApproval: null,
 424 |                 followUpSuggestions: [],
 425 |                 abortController: null
 426 |               });
 427 |             }}
 428 |             onMouseEnter={() => setHoveredSidebarItem("New Chat")}
 429 |             onMouseLeave={() => setHoveredSidebarItem(null)}
 430 |             className={`w-full flex items-center rounded-lg transition-all duration-150 py-2.5 cursor-pointer relative ${
 431 |               isSidebarExpanded ? "px-3 gap-3 hover:bg-neutral-900 text-neutral-200" : "justify-center text-neutral-400 hover:bg-neutral-900"
 432 |             }`}
 433 |           >
 434 |             <SquarePlus className="w-5 h-5 stroke-[1.8]" />
 435 |             {isSidebarExpanded && <span className="text-xs font-semibold">New Chat</span>}
 436 |             {!isSidebarExpanded && hoveredSidebarItem === "New Chat" && (
 437 |               <div className="absolute left-[64px] bg-[#1a1a1a] border border-[#2d2d2d] py-1 px-2.5 rounded text-[10px] text-white whitespace-nowrap z-50 pointer-events-none shadow-md">
 438 |                 New Chat
 439 |               </div>
 440 |             )}
 441 |           </button>
 442 | 
 443 |           {/* BYOK Button */}
 444 |           <button
 445 |             id="byok-sidebar-btn"
 446 |             onClick={() => setIsSecretOpen(true)}
 447 |             onMouseEnter={() => setHoveredSidebarItem("BYOK")}
 448 |             onMouseLeave={() => setHoveredSidebarItem(null)}
 449 |             className={`w-full flex items-center rounded-lg transition-all duration-150 py-2.5 cursor-pointer relative ${
 450 |               isSidebarExpanded ? "px-3 gap-3 hover:bg-neutral-900 text-neutral-200" : "justify-center text-neutral-400 hover:bg-neutral-900"
 451 |             }`}
 452 |           >
 453 |             <Key className="w-5 h-5 stroke-[1.8]" />
 454 |             {isSidebarExpanded && <span className="text-xs font-semibold">API Keys</span>}
 455 |             {!isSidebarExpanded && hoveredSidebarItem === "BYOK" && (
 456 |               <div className="absolute left-[64px] bg-[#1a1a1a] border border-[#2d2d2d] py-1 px-2.5 rounded text-[10px] text-white whitespace-nowrap z-50 pointer-events-none shadow-md">
 457 |                 Bring Your Own Key
 458 |               </div>
 459 |             )}
 460 |           </button>
 461 | 
 462 |           {/* Recents Log */}
 463 |           {isSidebarExpanded && (
 464 |             <div className="pt-6 space-y-2 select-none">
 465 |               <div className="flex items-center gap-1.5 px-3">
 466 |                 <History className="w-3.5 h-3.5 text-neutral-600" />
 467 |                 <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest font-mono">Recents</span>
 468 |               </div>
 469 |               <div className="space-y-1 max-h-[220px] overflow-y-auto custom-scrollbar">
 470 |                 {Object.values(sessions).length === 0 ? (
 471 |                   <span className="text-[10px] text-neutral-600 italic px-3 block pt-1">No chats yet.</span>
 472 |                 ) : (
 473 |                   Object.values(sessions).reverse().map((s) => (
 474 |                     <div key={s.id} className="group/session flex items-center justify-between px-2 py-1 rounded-md hover:bg-neutral-900 transition-colors">
 475 |                       <button
 476 |                         disabled={isLoadingSession}
 477 |                         onClick={async () => {
 478 |                           setIsLoadingSession(true);
 479 |                           try {
 480 |                             await loadSessionFromDb(s.id);
 481 |                             setWorkspaceState("active");
 482 |                             setCurrentTab("chat");
 483 |                           } catch (err) {
 484 |                             console.error(err);
 485 |                           } finally {
 486 |                             setIsLoadingSession(false);
 487 |                           }
 488 |                         }}
 489 |                         className={`text-left text-xs truncate font-medium flex-1 cursor-pointer transition-colors ${
 490 |                           activeSessionId === s.id
 491 |                             ? "text-white font-bold"
 492 |                             : "text-neutral-500 hover:text-white"
 493 |                         }`}
 494 |                         title={s.prompt}
 495 |                       >
 496 |                         {s.title}
 497 |                       </button>
 498 |                       <button
 499 |                         onClick={async (e) => {
 500 |                           e.stopPropagation();
 501 |                           if (confirm(`Are you sure you want to delete "${s.title}"?`)) {
 502 |                             await deleteSessionFromDb(s.id);
 503 |                           }
 504 |                         }}
 505 |                         className="opacity-0 group-hover/session:opacity-100 p-1 text-neutral-600 hover:text-rose-400 rounded transition-opacity cursor-pointer"
 506 |                         title="Delete Chat"
 507 |                       >
 508 |                         <Trash2 className="w-3.5 h-3.5" />
 509 |                       </button>
 510 |                     </div>
 511 |                   ))
 512 |                 )}
 513 |               </div>
 514 |             </div>
 515 |           )}
 516 |         </nav>
 517 | 
 518 |         {/* Sidebar Footer */}
 519 |         <div className="p-2 border-t border-[#1f1f1f] space-y-1 select-none">
 520 |           <button
 521 |             onClick={() => alert("Settings panel coming soon.")}
 522 |             className={`w-full flex items-center rounded-lg hover:bg-neutral-900 transition-colors py-2 cursor-pointer ${
 523 |               isSidebarExpanded ? "px-3 gap-3 text-neutral-400 hover:text-white" : "justify-center text-neutral-400 hover:text-white"
 524 |             }`}
 525 |           >
 526 |             <Settings className="w-4 h-4" />
 527 |             {isSidebarExpanded && <span className="text-xs">Settings</span>}
 528 |           </button>
 529 |           <button
 530 |             onClick={() => setIsProfileOpen(true)}
 531 |             className={`w-full flex items-center rounded-lg hover:bg-neutral-900 transition-colors py-2 cursor-pointer ${
 532 |               isSidebarExpanded ? "px-3 gap-3 text-neutral-400 hover:text-white" : "justify-center text-neutral-400 hover:text-white"
 533 |             }`}
 534 |           >
 535 |             <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center shrink-0 border border-neutral-700">
 536 |               <User className="w-3.5 h-3.5 text-neutral-300" />
 537 |             </div>
 538 |             {isSidebarExpanded && <span className="text-xs truncate font-medium">Profile</span>}
 539 |           </button>
 540 |         </div>
 541 |       </aside>
 542 | 
 543 |       <main className="flex-1 flex flex-col min-w-0 bg-[#000000] relative transition-all duration-300">
 544 | 
 545 |         {/* Header */}
 546 |         <header className="flex justify-between items-center w-full px-6 h-16 border-b border-[#141414] shrink-0 z-10 bg-black/85 backdrop-blur-md">
 547 |           <div className="flex items-center gap-2">
 548 |           </div>
 549 | 
 550 |           {/* Tab Switcher — Chat always left, Flow/Arena only visible when complex task ran */}
 551 |           <div className="flex items-center bg-[#0d0d0d] border border-[#1f1f1f] p-[2px] rounded-full select-none">
 552 |             <button
 553 |               id="tab-chat"
 554 |               onClick={() => {
 555 |                 if (workspaceState === "home") return;
 556 |                 setCurrentTab("chat");
 557 |               }}
 558 |               className={`px-6 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
 559 |                 currentTab === "chat" || workspaceState === "home"
 560 |                   ? "bg-neutral-800 text-white"
 561 |                   : "text-neutral-400 hover:text-white"
 562 |               }`}
 563 |             >
 564 |               Chat
 565 |             </button>
 566 |             {/* Flow tab only shown when complex task (nodes exist) */}
 567 |             {workspaceState === "active" && (
 568 |               <button
 569 |                 id="tab-flow"
 570 |                 onClick={() => setCurrentTab("arena")}
 571 |                 className={`px-6 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
 572 |                   currentTab === "arena"
 573 |                     ? "bg-neutral-800 text-white"
 574 |                     : "text-neutral-400 hover:text-white"
 575 |                 }`}
 576 |               >
 577 |                 <GitFork className="w-3 h-3" />
 578 |                 Flow
 579 |                 {nodes.length > 0 && (
 580 |                   <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse ml-0.5" />
 581 |                 )}
 582 |               </button>
 583 |             )}
 584 |           </div>
 585 | 
 586 |           {/* Right Header Controls */}
 587 |           <div className="flex items-center gap-4 select-none">
 588 |             <button
 589 |               onClick={() => alert("Solospace — AI-powered assistant. Enter any prompt to get a complete, detailed response. For complex tasks, use the Flow tab to inspect the multi-agent pipeline.")}
 590 |               className="text-neutral-400 hover:text-white p-1.5 rounded-md hover:bg-neutral-900 transition-colors cursor-pointer"
 591 |             >
 592 |               <HelpCircle className="w-4 h-4 stroke-[1.8]" />
 593 |             </button>
 594 |           </div>
 595 |         </header>
 596 | 
 597 |         {/* View Layout */}
 598 |         <div className="flex-1 relative overflow-hidden">
 599 | 
 600 |           {/* A. HOME SCREEN */}
 601 |           {workspaceState === "home" && (
 602 |             <div className="absolute inset-0 flex flex-col justify-between overflow-y-auto custom-scrollbar">
 603 |               <div />
 604 |               <div className="w-full max-w-2xl mx-auto px-6 py-12 flex flex-col items-center">
 605 |                 <div className="text-center mb-10 space-y-2 select-none">
 606 |                   <h1 className="text-4xl font-extrabold tracking-tight text-white antialiased">
 607 |                     What&apos;s on your mind?
 608 |                   </h1>
 609 |                   <p className="text-sm text-neutral-400 font-sans">
 610 |                     Ask anything. Get a real, complete answer instantly.
 611 |                   </p>
 612 |                 </div>
 613 | 
 614 |                 {/* Search Bar */}
 615 |                 <div className="w-full chatgpt-input-box rounded-[24px] p-2 flex flex-col gap-2">
 616 |                   <div className="flex items-center gap-3">
 617 |                     <button
 618 |                       onClick={() => alert("File attachment coming soon.")}
 619 |                       className="p-2 text-neutral-500 hover:text-neutral-300 rounded-full hover:bg-neutral-900 transition-colors shrink-0 cursor-pointer"
 620 |                       title="Attach File"
 621 |                     >
 622 |                       <UploadCloud className="w-5 h-5 stroke-[1.8]" />
 623 |                     </button>
 624 |                     <textarea
 625 |                       id="home-prompt-input"
 626 |                       rows={1}
 627 |                       value={userQuery}
 628 |                       onChange={(e) => setUserQuery(e.target.value)}
 629 |                       onKeyDown={(e) => {
 630 |                         if (e.key === "Enter" && !e.shiftKey) {
 631 |                           e.preventDefault();
 632 |                           if (userQuery.trim()) startOrchestration(userQuery);
 633 |                         }
 634 |                       }}
 635 |                       placeholder="Describe your idea, problem, or question..."
 636 |                       className="flex-1 bg-transparent text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-0 resize-none py-1.5 custom-scrollbar"
 637 |                       style={{ maxHeight: "150px" }}
 638 |                     />
 639 |                     <div className="flex items-center gap-1.5 shrink-0">
 640 |                       <button
 641 |                         onClick={() => alert("Voice input coming soon.")}
 642 |                         className="p-2 text-neutral-500 hover:text-neutral-300 rounded-full hover:bg-neutral-900 transition-colors cursor-pointer"
 643 |                         title="Voice Input"
 644 |                       >
 645 |                         <Mic className="w-5 h-5 stroke-[1.8]" />
 646 |                       </button>
 647 |                       <button
 648 |                         id="home-send-btn"
 649 |                         onClick={() => startOrchestration(userQuery)}
 650 |                         disabled={!userQuery.trim()}
 651 |                         className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-neutral-200 active:scale-95 disabled:opacity-20 disabled:scale-100 transition-all font-semibold cursor-pointer"
 652 |                         title="Send prompt"
 653 |                       >
 654 |                         <ArrowRight className="w-4 h-4 text-black stroke-[3]" />
 655 |                       </button>
 656 |                     </div>
 657 |                   </div>
 658 |                 </div>
 659 | 
 660 |                 {/* Mode Selector */}
 661 |                 <div className="flex items-center gap-3 mt-5 select-none">
 662 |                   <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Mode:</span>
 663 |                   <button
 664 |                     onClick={() => setIsAutoMode(true)}
 665 |                     className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono border transition-all cursor-pointer ${
 666 |                       isAutoMode
 667 |                         ? "bg-white text-black border-white font-bold"
 668 |                         : "bg-neutral-950 text-neutral-400 border-[#1f1f1f] hover:text-white"
 669 |                     }`}
 670 |                   >
 671 |                     <Zap className="w-3 h-3 stroke-[2]" />
 672 |                     <span>Auto Agent</span>
 673 |                   </button>
 674 |                   <button
 675 |                     onClick={() => setIsAutoMode(false)}
 676 |                     className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono border transition-all cursor-pointer ${
 677 |                       !isAutoMode
 678 |                         ? "bg-white text-black border-white font-bold"
 679 |                         : "bg-neutral-950 text-neutral-400 border-[#1f1f1f] hover:text-white"
 680 |                     }`}
 681 |                   >
 682 |                     <Sliders className="w-3 h-3" />
 683 |                     <span>Custom Agent</span>
 684 |                   </button>
 685 |                 </div>
 686 |               </div>
 687 |               <div />
 688 |             </div>
 689 |           )}
 690 | 
 691 |           {/* B. ACTIVE WORKSPACE */}
 692 |           {workspaceState === "active" && (
 693 |             <div className="absolute inset-0 flex">
 694 | 
 695 |               {/* VIEW 1: CHAT (Primary — always shown first) */}
 696 |               {currentTab === "chat" && (
 697 |                 <div className="flex-1 flex flex-col justify-between overflow-hidden bg-black">
 698 | 
 699 |                   {/* Chat messages */}
 700 |                   <div
 701 |                     ref={chatContainerRef}
 702 |                     onScroll={handleScroll}
 703 |                     className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4"
 704 |                   >
 705 |                     {isLoadingSession ? (
 706 |                       <div className="flex items-center justify-center h-full">
 707 |                         <div className="flex flex-col items-center gap-3 text-neutral-500">
 708 |                           <div className="w-6 h-6 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
 709 |                           <span className="text-xs font-semibold">Loading Session...</span>
 710 |                         </div>
 711 |                       </div>
 712 |                     ) : (
 713 |                       <div className="max-w-5xl mx-auto space-y-4 select-text">
 714 | 
 715 |                       {chatMessages.map((msg, msgIdx) => (
 716 |                         <motion.div
 717 |                           key={msg.id}
 718 |                           initial={{ opacity: 0, y: 12 }}
 719 |                           animate={{ opacity: 1, y: 0 }}
 720 |                           transition={{ duration: 0.3 }}
 721 |                           className={`flex w-full ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
 722 |                         >
 723 |                           {msg.sender === "user" ? (
 724 |                             <div className="max-w-[72%] rounded-3xl px-5 py-3 bg-[#2f2f2f] text-neutral-100 text-sm leading-relaxed">
 725 |                               <p className="whitespace-pre-wrap">{msg.text}</p>
 726 |                             </div>
 727 |                           ) : (
 728 |                             <div className="flex-1 max-w-[88%] flex flex-col items-start space-y-1">
 729 |                               <div className="w-full text-neutral-100 text-sm leading-relaxed px-1 py-2">
 730 |                                 <MarkdownRenderer content={msg.text || "*Streaming response...*"} />
 731 |                                 
 732 |                                 {/* Action Buttons for AI Response */}
 733 |                                 {msg.text && (
 734 |                                   <div className="flex items-center gap-3 mt-4 text-neutral-500 select-none">
 735 |                                     <button
 736 |                                       onClick={() => copyToClipboard(msg.text, msg.id)}
 737 |                                       className="flex items-center gap-1.5 text-[11px] hover:text-neutral-200 transition-colors cursor-pointer p-1 rounded-md hover:bg-neutral-800"
 738 |                                       title="Copy response"
 739 |                                     >
 740 |                                       {copiedMsgId === msg.id ? (
 741 |                                         <>
 742 |                                           <Check className="w-3.5 h-3.5 text-emerald-400" />
 743 |                                           <span className="text-emerald-400 font-medium">Copied</span>
 744 |                                         </>
 745 |                                       ) : (
 746 |                                         <>
 747 |                                           <Copy className="w-3.5 h-3.5" />
 748 |                                           <span>Copy</span>
 749 |                                         </>
 750 |                                       )}
 751 |                                     </button>
 752 |                                     {msgIdx === chatMessages.length - 1 && !isThinking && !isOrchestrating && (
 753 |                                       <button
 754 |                                         onClick={() => {
 755 |                                           const lastUser = chatMessages.slice().reverse().find(m => m.sender === "user");
 756 |                                           if (lastUser) {
 757 |                                             setChatMessages(prev => {
 758 |                                               const lastAiIdx = prev.map((m, i) => m.sender === 'ai' ? i : -1).filter(i => i >= 0).pop();
 759 |                                               if (lastAiIdx !== undefined) {
 760 |                                                 return prev.filter((_, i) => i !== lastAiIdx);
 761 |                                               }
 762 |                                               return prev;
 763 |                                             });
 764 |                                             startOrchestration(lastUser.text);
 765 |                                           }
 766 |                                         }}
 767 |                                         className="flex items-center gap-1.5 text-[11px] hover:text-neutral-200 transition-colors cursor-pointer p-1 rounded-md hover:bg-neutral-800"
 768 |                                         title="Regenerate response"
 769 |                                       >
 770 |                                         <Zap className="w-3.5 h-3.5" />
 771 |                                         <span>Regenerate</span>
 772 |                                       </button>
 773 |                                     )}
 774 |                                   </div>
 775 |                                 )}
 776 |                               </div>
 777 | 
 778 |                               {/* Collapsible trace block and see flow buttons outside bubble */}
 779 |                               {msgIdx === chatMessages.length - 1 && (
 780 |                                 <div className="space-y-3 pt-1 w-full">
 781 |                                   <AgentTraceBlock
 782 |                                     logs={agentTalkLogs}
 783 |                                     thinkingSummary={msg.thinkingSummary}
 784 |                                   />
 785 |                                   
 786 |                                   {!isThinking && !isOrchestrating && nodes.length > 0 && (
 787 |                                     <div className="flex flex-wrap gap-2 pt-1">
 788 |                                       <button
 789 |                                         id="see-flow-btn"
 790 |                                         onClick={() => setCurrentTab("arena")}
 791 |                                         className="px-4 py-2 bg-neutral-950 hover:bg-neutral-900 border border-[#1f1f1f] hover:border-cyan-500/40 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer max-w-max select-none"
 792 |                                       >
 793 |                                         <GitFork className="w-3.5 h-3.5 text-cyan-400" />
 794 |                                         <span>See Agent Flow</span>
 795 |                                         <span className="text-[9px] font-mono text-neutral-600">({nodes.length} agents)</span>
 796 |                                       </button>
 797 | 
 798 |                                       {!isAutoMode && (
 799 |                                         <button
 800 |                                           onClick={() => setCurrentTab("arena")}
 801 |                                           className="px-4 py-2 bg-neutral-950 hover:bg-neutral-900 border border-[#1f1f1f] hover:border-neutral-500 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer max-w-max select-none"
 802 |                                         >
 803 |                                           <Sliders className="w-3.5 h-3.5" />
 804 |                                           <span>Customize Agents</span>
 805 |                                         </button>
 806 |                                       )}
 807 |                                     </div>
 808 |                                   )}
 809 | 
 810 |                                   {!isThinking && !isOrchestrating && followUpSuggestions && followUpSuggestions.length > 0 && (
 811 |                                     <div className="flex flex-wrap gap-2 pt-2 select-none">
 812 |                                       <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-wider self-center">Suggestions:</span>
 813 |                                       {followUpSuggestions.map((suggestion, idx) => (
 814 |                                         <button
 815 |                                           key={idx}
 816 |                                           onClick={() => {
 817 |                                             setUserQuery(suggestion);
 818 |                                             startOrchestration(suggestion);
 819 |                                           }}
 820 |                                           className="px-3 py-1.5 bg-neutral-950 hover:bg-neutral-900 border border-[#1f1f1f] hover:border-cyan-500/30 rounded-full text-[10px] text-neutral-400 hover:text-white transition-all cursor-pointer animate-fade-in"
 821 |                                         >
 822 |                                           {suggestion}
 823 |                                         </button>
 824 |                                       ))}
 825 |                                     </div>
 826 |                                   )}
 827 |                                 </div>
 828 |                               )}
 829 |                             </div>
 830 |                           )}
 831 |                         </motion.div>
 832 |                       ))}
 833 | 
 834 |                       {/* Thinking indicator */}
 835 |                       <AnimatePresence>
 836 |                         {isThinking && <ThinkingBubble />}
 837 |                       </AnimatePresence>
 838 | 
 839 |                       {/* Auto-scroll anchor */}
 840 |                       <div ref={chatEndRef} />
 841 |                     </div>
 842 |                     )}
 843 |                   </div>
 844 | 
 845 |                   {/* Bottom input bar */}
 846 |                   <div className="px-6 py-4 bg-black/60 border-t border-[#141414] backdrop-blur-xl shrink-0 flex flex-col gap-2">
 847 |                     {!isAutoMode && workspaceState === "active" && (
 848 |                       <div className="text-[10px] font-mono text-amber-400 bg-amber-950/30 px-3 py-1 rounded-full self-center border border-amber-500/20 max-w-max select-none">
 849 |                         Planning Mode – Edit agents in Flow, then click Proceed
 850 |                       </div>
 851 |                     )}
 852 |                     <div className="max-w-3xl mx-auto w-full chatgpt-input-box rounded-[24px] p-1.5 flex items-center gap-2">
 853 |                       <textarea
 854 |                         ref={textareaRef}
 855 |                         id="chat-prompt-input"
 856 |                         rows={1}
 857 |                         value={userQuery}
 858 |                         onChange={(e) => setUserQuery(e.target.value)}
 859 |                         onKeyDown={(e) => {
 860 |                           if (e.key === "Enter" && !e.shiftKey) {
 861 |                             e.preventDefault();
 862 |                             if (!isOrchestrating && userQuery.trim()) startOrchestration(userQuery);
 863 |                           }
 864 |                         }}
 865 |                         placeholder={isOrchestrating ? "Streaming response..." : (isAutoMode ? "Ask a follow-up or new question..." : "Enter a new idea to generate agents (no auto-run)...")}
 866 |                         disabled={isOrchestrating}
 867 |                         className="flex-1 bg-transparent text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-0 px-3 py-1.5 disabled:opacity-50 resize-none max-h-40 custom-scrollbar"
 868 |                       />
 869 |                       {isOrchestrating ? (
 870 |                         <button
 871 |                           onClick={cancelOrchestration}
 872 |                           className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-500 active:scale-95 transition-all font-semibold cursor-pointer shrink-0"
 873 |                           title="Stop generating"
 874 |                         >
 875 |                           <Square className="w-3.5 h-3.5 text-white fill-white" />
 876 |                         </button>
 877 |                       ) : (
 878 |                         <button
 879 |                           id="chat-send-btn"
 880 |                           onClick={() => startOrchestration(userQuery)}
 881 |                           disabled={!userQuery.trim() || isThinking}
 882 |                           className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:bg-neutral-200 active:scale-95 disabled:opacity-20 disabled:scale-100 transition-all font-semibold cursor-pointer shrink-0"
 883 |                           title="Send message"
 884 |                         >
 885 |                           <ArrowRight className="w-4 h-4 text-black stroke-[3]" />
 886 |                         </button>
 887 |                       )}
 888 |                     </div>
 889 |                   </div>
 890 |                 </div>
 891 |               )}
 892 | 
 893 |               {/* VIEW 2: ARENA CANVAS (Optional — Flow inspection/editing) */}
 894 |               {currentTab === "arena" && (
 895 |                 <div className="flex-1 relative overflow-hidden bg-[#000000] flex">
 896 | 
 897 |                   {/* Back to chat bar at top */}
 898 |                   <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#0d0d0d]/90 border border-[#1f1f1f] rounded-full px-4 py-2 backdrop-blur-md shadow-xl pointer-events-auto">
 899 |                     <button
 900 |                       onClick={() => setCurrentTab("chat")}
 901 |                       className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer font-mono"
 902 |                     >
 903 |                       <ChevronLeft className="w-3.5 h-3.5" />
 904 |                       Back to Chat
 905 |                     </button>
 906 |                     <span className="text-neutral-700 text-xs">|</span>
 907 |                     <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
 908 |                       Agent Flow — {nodes.length} active
 909 |                     </span>
 910 |                   </div>
 911 | 
 912 |                   {/* FLOATING LEFT SIDE Arena Tools Panel */}
 913 |                   <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col bg-[#0d0d0d]/80 border border-[#1f1f1f] p-1.5 rounded-xl z-20 backdrop-blur-md shadow-2xl">
 914 |                     <div className="text-[8px] font-mono text-neutral-600 uppercase tracking-widest px-2 pb-2 text-center select-none border-b border-[#141414] mb-2 font-bold">
 915 |                       Tools
 916 |                     </div>
 917 |                     {toolsList.map((tool) => (
 918 |                       <div
 919 |                         key={tool.name}
 920 |                         draggable
 921 |                         onDragStart={(e) => e.dataTransfer.setData("toolName", tool.name)}
 922 |                         className="p-2.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-900 transition-all cursor-grab active:cursor-grabbing flex items-center justify-center relative group"
 923 |                       >
 924 |                         {tool.icon}
 925 |                         <div className="absolute left-12 bg-[#0c0c0c] border border-[#1f1f1f] p-2.5 rounded-lg text-left hidden group-hover:block w-40 z-30 shadow-2xl pointer-events-none">
 926 |                           <h4 className="text-[10px] font-bold text-white">{tool.name}</h4>
 927 |                           <p className="text-[9px] text-neutral-400 mt-0.5 leading-relaxed">{tool.desc}</p>
 928 |                           <span className="text-[8px] font-mono text-neutral-600 block mt-1.5 italic">Drag onto agent node</span>
 929 |                         </div>
 930 |                       </div>
 931 |                     ))}
 932 |                   </div>
 933 | 
 934 |                   {/* Flow Arena */}
 935 |                   <FlowArena />
 936 | 
 937 |                   {/* Bottom controls — Proceed & Return to Chat */}
 938 |                   <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center gap-3 font-semibold select-none">
 939 |                     <button
 940 |                       disabled={isOrchestrating}
 941 |                       onClick={async () => {
 942 |                         if (isOrchestrating) return;
 943 |                         // Bug 11: Immediately set orchestrating to prevent double-fire before async fn sets it
 944 |                         useWorkflowStore.setState({ isOrchestrating: true });
 945 |                         setCurrentTab("chat"); // Switch back to chat to see the output stream
 946 |                         const triggerCustomExecution = useWorkflowStore.getState().triggerCustomExecution;
 947 |                         await triggerCustomExecution();
 948 |                       }}
 949 |                       className="bg-white hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-500 text-black font-bold text-xs h-10 px-6 rounded-[24px] shadow-2xl flex items-center gap-1.5 cursor-pointer shrink-0 transition-all active:scale-95 disabled:scale-100 disabled:cursor-not-allowed"
 950 |                     >
 951 |                       {isOrchestrating ? (
 952 |                         <>
 953 |                           <div className="w-3.5 h-3.5 border-2 border-neutral-500 border-t-neutral-200 rounded-full animate-spin" />
 954 |                           <span>Running Flow...</span>
 955 |                         </>
 956 |                       ) : (
 957 |                         <>
 958 |                           <Zap className="w-3.5 h-3.5 text-black fill-black" />
 959 |                           <span>Proceed with Agents</span>
 960 |                         </>
 961 |                       )}
 962 |                     </button>
 963 |                     <button
 964 |                       onClick={() => setCurrentTab("chat")}
 965 |                       className="h-10 px-4 rounded-[24px] border border-[#1f1f1f] hover:border-neutral-600 bg-black/80 backdrop-blur-md text-neutral-400 hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-2xl"
 966 |                     >
 967 |                       Return to Chat
 968 |                     </button>
 969 |                   </div>
 970 |                 </div>
 971 |               )}
 972 |             </div>
 973 |           )}
 974 |         </div>
 975 |       </main>
 976 | 
 977 |       {/* 3. RIGHT Sliding Configuration Edit Panel */}
 978 |       {currentTab === "arena" && (
 979 |         <div
 980 |           className={`fixed top-0 right-0 h-full w-80 bg-[#0c0c0c]/95 border-l border-[#1f1f1f] z-40 flex flex-col justify-between shadow-2xl transition-transform duration-300 right-panel select-none ${
 981 |             isConfigPanelOpen ? "translate-x-0" : "translate-x-full"
 982 |           }`}
 983 |         >
 984 |         <button
 985 |           onClick={handleCloseConfigPanel}
 986 |           className="absolute -left-8 top-1/2 -translate-y-1/2 w-8 h-16 bg-[#0c0c0c]/95 border border-[#1f1f1f] border-r-0 rounded-l-xl flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer"
 987 |         >
 988 |           {isConfigPanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
 989 |         </button>
 990 | 
 991 |         {activeNodeDetail ? (
 992 |           <div className="flex-1 flex flex-col h-full overflow-hidden">
 993 |             <div className="p-5 border-b border-[#1f1f1f] flex justify-between items-center bg-[#0d0d0d]">
 994 |               <div>
 995 |                 <h3 className="text-sm font-bold text-white uppercase tracking-wider">{activeNodeDetail.data.name}</h3>
 996 |                 <span className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest block mt-0.5">{activeNodeDetail.data.tag}</span>
 997 |               </div>
 998 |               <button onClick={handleCloseConfigPanel} className="text-neutral-500 hover:text-white cursor-pointer">
 999 |                 <X className="w-4 h-4" />
1000 |               </button>
1001 |             </div>
1002 | 
1003 |             <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
1004 |               {/* Enable/Disable toggle */}
1005 |               <div className="flex items-center justify-between bg-[#070707] border border-[#1f1f1f] p-3 rounded-xl">
1006 |                 <div className="flex flex-col">
1007 |                   <span className="text-[10px] font-bold text-white uppercase tracking-wider">Active</span>
1008 |                   <span className="text-[9px] text-neutral-500 mt-0.5">Disable to exclude from pipeline</span>
1009 |                 </div>
1010 |                 <button
1011 |                   onClick={() => updateNodeField(activeNodeDetail.id, { enabled: !activeNodeDetail.data.enabled })}
1012 |                   className={`w-10 h-5 rounded-full p-0.5 transition-all duration-200 cursor-pointer ${activeNodeDetail.data.enabled ? "bg-white" : "bg-neutral-800"}`}
1013 |                 >
1014 |                   <div className={`w-4 h-4 rounded-full transition-transform ${activeNodeDetail.data.enabled ? "bg-black translate-x-5" : "bg-neutral-600 translate-x-0"}`} />
1015 |                 </button>
1016 |               </div>
1017 | 
1018 |               {/* Priority Slider */}
1019 |               <div className="space-y-1 bg-[#070707] border border-[#1f1f1f] p-3 rounded-xl">
1020 |                 <div className="flex justify-between items-center text-[9px] font-mono uppercase text-neutral-400 font-bold">
1021 |                   <span>Priority</span>
1022 |                   <span className="text-white">Level {activeNodeDetail.data.priority}</span>
1023 |                 </div>
1024 |                 <input
1025 |                   type="range" min="1" max="10" step="1"
1026 |                   value={activeNodeDetail.data.priority}
1027 |                   onChange={(e) => updateNodeField(activeNodeDetail.id, { priority: parseInt(e.target.value) })}
1028 |                   className="w-full accent-white h-1 bg-[#1f1f1f] rounded-lg appearance-none cursor-pointer mt-2"
1029 |                 />
1030 |               </div>
1031 | 
1032 |               {/* Name */}
1033 |               <div className="space-y-1.5">
1034 |                 <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Agent Name</label>
1035 |                 <input
1036 |                   type="text" value={activeNodeDetail.data.name}
1037 |                   onChange={(e) => updateNodeField(activeNodeDetail.id, { name: e.target.value })}
1038 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-3 py-2 text-xs text-white focus:border-neutral-500 outline-none"
1039 |                 />
1040 |               </div>
1041 | 
1042 |               {/* Personality */}
1043 |               <div className="space-y-1.5">
1044 |                 <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Personality</label>
1045 |                 <input
1046 |                   type="text" value={activeNodeDetail.data.personality}
1047 |                   onChange={(e) => updateNodeField(activeNodeDetail.id, { personality: e.target.value })}
1048 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-3 py-2 text-xs text-white focus:border-neutral-500 outline-none"
1049 |                 />
1050 |               </div>
1051 | 
1052 |               {/* System Prompt */}
1053 |               <div className="space-y-1.5">
1054 |                 <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">System Prompt</label>
1055 |                 <textarea
1056 |                   value={activeNodeDetail.data.systemPrompt}
1057 |                   onChange={(e) => updateNodeField(activeNodeDetail.id, { systemPrompt: e.target.value })}
1058 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg p-3 text-xs text-white focus:border-neutral-500 outline-none min-h-[80px] resize-none leading-relaxed"
1059 |                 />
1060 |               </div>
1061 | 
1062 |               {/* Goal Objective */}
1063 |               <div className="space-y-1.5">
1064 |                 <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Objective</label>
1065 |                 <textarea
1066 |                   value={activeNodeDetail.data.objective}
1067 |                   onChange={(e) => updateNodeField(activeNodeDetail.id, { objective: e.target.value })}
1068 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg p-3 text-xs text-white focus:border-neutral-500 outline-none min-h-[60px] resize-none leading-relaxed"
1069 |                 />
1070 |               </div>
1071 | 
1072 |               {/* Rules */}
1073 |               <div className="space-y-2">
1074 |                 <label className="text-[9px] font-mono uppercase text-neutral-400 tracking-wider font-bold block">Rules</label>
1075 |                 <div className="space-y-1.5">
1076 |                   {activeNodeDetail.data.rules && activeNodeDetail.data.rules.map((rule: any, idx: number) => (
1077 |                     <div key={idx} className="flex gap-2 items-center bg-[#050505] border border-[#1f1f1f] p-2 rounded-lg justify-between">
1078 |                       <span className="text-[10px] text-neutral-300 leading-normal flex-1 pr-2">{rule}</span>
1079 |                       <button onClick={() => handleDeleteRule(idx)} className="text-neutral-500 hover:text-red-400 transition-colors shrink-0 cursor-pointer">
1080 |                         <Trash2 className="w-3.5 h-3.5" />
1081 |                       </button>
1082 |                     </div>
1083 |                   ))}
1084 |                 </div>
1085 |                 <div className="flex gap-2">
1086 |                   <input
1087 |                     type="text" value={newRuleText}
1088 |                     onChange={(e) => setNewRuleText(e.target.value)}
1089 |                     placeholder="Add constraint..."
1090 |                     className="flex-1 bg-[#050505] border border-[#1f1f1f] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-neutral-500"
1091 |                   />
1092 |                   <button onClick={handleAddRule} className="bg-white text-black font-bold text-xs px-3 rounded-lg hover:bg-neutral-200 cursor-pointer">Add</button>
1093 |                 </div>
1094 |               </div>
1095 | 
1096 |               {/* Sliders */}
1097 |               <div className="space-y-4 pt-3 border-t border-[#141414]">
1098 |                 {[
1099 |                   { label: "Creativity", key: "temp", min: 0, max: 1, step: 0.05, display: (v: number) => v.toString() },
1100 |                   { label: "Logic / Depth", key: "logic", min: 10, max: 100, step: 5, display: (v: number) => `${v}%` },
1101 |                   { label: "Empathy", key: "empathy", min: 0, max: 100, step: 5, display: (v: number) => `${v}%` }
1102 |                 ].map(({ label, key, min, max, step, display }) => (
1103 |                   <div key={key} className="space-y-1">
1104 |                     <div className="flex justify-between items-center text-[9px] font-mono uppercase text-neutral-400 font-bold">
1105 |                       <span>{label}</span>
1106 |                       <span className="text-white">{display(activeNodeDetail.data[key])}</span>
1107 |                     </div>
1108 |                     <input
1109 |                       type="range" min={min} max={max} step={step}
1110 |                       value={activeNodeDetail.data[key]}
1111 |                       onChange={(e) => updateNodeField(activeNodeDetail.id, { [key]: key === "temp" ? parseFloat(e.target.value) : parseInt(e.target.value) })}
1112 |                       className="w-full accent-white h-1 bg-[#1f1f1f] rounded-lg appearance-none cursor-pointer"
1113 |                     />
1114 |                   </div>
1115 |                 ))}
1116 |               </div>
1117 | 
1118 |               {/* Tool Integrations */}
1119 |               <div className="pt-5 border-t border-[#141414] space-y-4">
1120 |                 <div className="flex justify-between items-center">
1121 |                   <label className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Tools</label>
1122 |                   <span className="text-[8px] font-mono text-neutral-500 uppercase">Attached: {activeNodeDetail.data.tools?.length || 0}</span>
1123 |                 </div>
1124 |                 <select
1125 |                   id="tool-selector-dropdown"
1126 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 outline-none focus:border-neutral-500"
1127 |                   defaultValue=""
1128 |                   onChange={(e) => {
1129 |                     const toolName = e.target.value;
1130 |                     if (!toolName) return;
1131 |                     const currentTools = activeNodeDetail.data.tools || [];
1132 |                     if (!currentTools.includes(toolName)) {
1133 |                       const updatedTools = [...currentTools, toolName];
1134 |                       const permissions = activeNodeDetail.data.toolPermissions || {};
1135 |                       const updatedPerms = { ...permissions, [toolName]: permissions[toolName] || "ALLOWED" };
1136 |                       updateNodeField(activeNodeDetail.id, { tools: updatedTools, toolPermissions: updatedPerms });
1137 |                     }
1138 |                     e.target.value = "";
1139 |                   }}
1140 |                 >
1141 |                   <option value="" disabled>+ Attach tool...</option>
1142 |                   {["Web Search", "Browser", "Memory", "File Upload", "Code Executor", "Vision", "Voice", "API Connector"]
1143 |                     .filter(tool => !(activeNodeDetail.data.tools || []).includes(tool))
1144 |                     .map((tool: string) => (
1145 |                       <option key={tool} value={tool}>{tool}</option>
1146 |                     ))}
1147 |                 </select>
1148 | 
1149 |                 <div className="space-y-3">
1150 |                   {(!activeNodeDetail.data.tools || activeNodeDetail.data.tools.length === 0) ? (
1151 |                     <div className="bg-[#050505] border border-dashed border-[#1f1f1f] p-4 text-center rounded-xl">
1152 |                       <p className="text-[10px] text-neutral-500">No tools attached.</p>
1153 |                     </div>
1154 |                   ) : (
1155 |                     activeNodeDetail.data.tools.map((tool: any) => {
1156 |                       const currentPermissions = activeNodeDetail.data.toolPermissions || {};
1157 |                       const permission = currentPermissions[tool] || "ALLOWED";
1158 |                       return (
1159 |                         <div key={tool} className="bg-[#050505] border border-[#1f1f1f] p-3 rounded-xl space-y-2">
1160 |                           <div className="flex justify-between items-center">
1161 |                             <span className="text-xs font-bold text-white flex items-center gap-1.5">
1162 |                               <span className={`w-1.5 h-1.5 rounded-full ${permission === "ALLOWED" ? "bg-emerald-500 animate-pulse" : permission === "ASK" ? "bg-amber-500" : "bg-rose-500"}`} />
1163 |                               {tool}
1164 |                             </span>
1165 |                             <button
1166 |                               onClick={() => {
1167 |                                 const updatedTools = (activeNodeDetail.data.tools || []).filter((t: string) => t !== tool);
1168 |                                 const updatedPerms = { ...(activeNodeDetail.data.toolPermissions || {}) };
1169 |                                 delete updatedPerms[tool];
1170 |                                 updateNodeField(activeNodeDetail.id, { tools: updatedTools, toolPermissions: updatedPerms });
1171 |                               }}
1172 |                               className="text-neutral-500 hover:text-red-400 p-1 transition-colors cursor-pointer"
1173 |                             >
1174 |                               <Trash2 className="w-3.5 h-3.5" />
1175 |                             </button>
1176 |                           </div>
1177 |                           <div className="grid grid-cols-3 gap-1 pt-1">
1178 |                             {(["ALLOWED", "ASK", "DENIED"] as const).map((level) => (
1179 |                               <button
1180 |                                 key={level}
1181 |                                 onClick={() => {
1182 |                                   const updatedPerms = { ...(activeNodeDetail.data.toolPermissions || {}), [tool]: level };
1183 |                                   updateNodeField(activeNodeDetail.id, { toolPermissions: updatedPerms });
1184 |                                 }}
1185 |                                 className={`py-1 text-[9px] font-mono font-bold rounded-md border transition-all cursor-pointer ${
1186 |                                   permission === level
1187 |                                     ? level === "ALLOWED" ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/50"
1188 |                                     : level === "ASK" ? "bg-amber-950/40 text-amber-400 border-amber-500/50"
1189 |                                     : "bg-rose-950/40 text-rose-400 border-rose-500/50"
1190 |                                     : "bg-transparent text-neutral-500 border-[#1f1f1f] hover:text-neutral-300"
1191 |                                 }`}
1192 |                               >
1193 |                                 {level === "ALLOWED" ? "ALLOW" : level === "ASK" ? "ASK" : "DENY"}
1194 |                               </button>
1195 |                             ))}
1196 |                           </div>
1197 |                         </div>
1198 |                       );
1199 |                     })
1200 |                   )}
1201 |                 </div>
1202 |               </div>
1203 | 
1204 |               {/* Connections */}
1205 |               <div className="pt-5 border-t border-[#141414] space-y-4">
1206 |                 <div className="flex justify-between items-center">
1207 |                   <label className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Connections</label>
1208 |                   <span className="text-[8px] font-mono text-neutral-500 uppercase">
1209 |                     Links: {edges.filter(c => c.source === activeNodeDetail.id || c.target === activeNodeDetail.id).length}
1210 |                   </span>
1211 |                 </div>
1212 |                 <select
1213 |                   id="connection-selector-dropdown"
1214 |                   className="w-full bg-[#050505] border border-[#1f1f1f] rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 outline-none focus:border-neutral-500"
1215 |                   defaultValue=""
1216 |                   onChange={(e) => {
1217 |                     const targetId = e.target.value;
1218 |                     if (!targetId) return;
1219 |                     const exists = edges.some(c =>
1220 |                       (c.source === activeNodeDetail.id && c.target === targetId) ||
1221 |                       (c.source === targetId && c.target === activeNodeDetail.id)
1222 |                     );
1223 |                     if (!exists) {
1224 |                       setEdges(prev => [...prev, {
1225 |                         id: `e-${activeNodeDetail.id}-${targetId}`,
1226 |                         source: activeNodeDetail.id,
1227 |                         target: targetId,
1228 |                         animated: true,
1229 |                         type: 'custom'
1230 |                       }]);
1231 |                       // Bug 1: Sync dependency — the target node now depends on this (source) node
1232 |                       const targetNode = nodes.find(n => n.id === targetId);
1233 |                       if (targetNode) {
1234 |                         const currentDeps = (targetNode.data as any).dependencies || [];
1235 |                         if (!currentDeps.includes(activeNodeDetail.id)) {
1236 |                           updateNodeField(targetId, {
1237 |                             dependencies: [...currentDeps, activeNodeDetail.id]
1238 |                           });
1239 |                         }
1240 |                       }
1241 |                     }
1242 |                     e.target.value = "";
1243 |                   }}
1244 |                 >
1245 |                   <option value="" disabled>+ Connect to agent...</option>
1246 |                   {nodes.filter(n => n.id !== activeNodeDetail.id && n.type === 'custom').map(node => (
1247 |                     <option key={node.id} value={node.id}>{(node.data as any).name}</option>
1248 |                   ))}
1249 |                 </select>
1250 |                 <div className="space-y-1.5">
1251 |                   {(() => {
1252 |                     const linkedConns = edges.filter(c => c.source === activeNodeDetail.id || c.target === activeNodeDetail.id);
1253 |                     if (linkedConns.length === 0) {
1254 |                       return (
1255 |                         <div className="bg-[#050505] border border-dashed border-[#1f1f1f] p-3 text-center rounded-xl">
1256 |                           <p className="text-[10px] text-neutral-500">No connections.</p>
1257 |                         </div>
1258 |                       );
1259 |                     }
1260 |                     return linkedConns.map((conn, index) => {
1261 |                       const otherNodeId = conn.source === activeNodeDetail.id ? conn.target : conn.source;
1262 |                       const otherNode = nodes.find(n => n.id === otherNodeId);
1263 |                       return (
1264 |                         <div key={index} className="flex gap-2 items-center bg-[#050505] border border-[#1f1f1f] p-2 rounded-lg justify-between">
1265 |                           <span className="text-[10px] text-neutral-300 leading-normal flex-1 pr-2">
1266 |                             {otherNode ? (otherNode.data as any).name : otherNodeId}
1267 |                           </span>
1268 |                           <button onClick={() => deleteEdge(conn.id)} className="text-neutral-500 hover:text-red-400 transition-colors shrink-0 cursor-pointer">
1269 |                             <Trash2 className="w-3.5 h-3.5" />
1270 |                           </button>
1271 |                         </div>
1272 |                       );
1273 |                     });
1274 |                   })()}
1275 |                 </div>
1276 |               </div>
1277 | 
1278 |               {/* Execution Logs */}
1279 |               <div className="pt-5 border-t border-[#141414] space-y-3">
1280 |                 <div className="flex justify-between items-center">
1281 |                   <label className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider font-bold">Execution Log</label>
1282 |                   <button
1283 |                     onClick={() => updateNodeField(activeNodeDetail.id, { toolLogs: [] })}
1284 |                     className="text-[8px] font-mono text-neutral-500 hover:text-white uppercase transition-colors cursor-pointer"
1285 |                   >
1286 |                     Clear
1287 |                   </button>
1288 |                 </div>
1289 |                 <div className="bg-black border border-[#1f1f1f] rounded-xl p-3 h-44 overflow-y-auto font-mono text-[9px] space-y-1.5 custom-scrollbar">
1290 |                   {(!activeNodeDetail.data.toolLogs || activeNodeDetail.data.toolLogs.length === 0) ? (
1291 |                     <div className="h-full flex items-center justify-center text-neutral-600 text-center">
1292 |                       <span>No logs recorded.</span>
1293 |                     </div>
1294 |                   ) : (
1295 |                     activeNodeDetail.data.toolLogs.map((log: any) => (
1296 |                       <div key={log.id} className="flex gap-1.5 items-start leading-normal text-neutral-300">
1297 |                         <span className="text-neutral-500 shrink-0 select-none">[{log.timestamp}]</span>
1298 |                         <div className="flex-1">
1299 |                           <span className="font-bold text-white uppercase mr-1">[{log.tool}]</span>
1300 |                           <span>{log.detail}</span>
1301 |                         </div>
1302 |                         <span className={`shrink-0 font-bold px-1 rounded-sm text-[8px] ${
1303 |                           log.status === "SUCCESS" ? "bg-emerald-950 text-emerald-400" :
1304 |                           log.status === "PENDING" ? "bg-amber-950 text-amber-400 animate-pulse" :
1305 |                           log.status === "BLOCKED" ? "bg-rose-950 text-rose-400" : "bg-neutral-800 text-neutral-400"
1306 |                         }`}>
1307 |                           {log.status}
1308 |                         </span>
1309 |                       </div>
1310 |                     ))
1311 |                   )}
1312 |                 </div>
1313 | 
1314 |               </div>
1315 |             </div>
1316 | 
1317 |             {/* Footer */}
1318 |             <div className="p-4 border-t border-[#1f1f1f] bg-[#0d0d0d] grid grid-cols-2 gap-3">
1319 |               <button
1320 |                 onClick={() => { handleCloseConfigPanel(); }}
1321 |                 className="py-2.5 border border-[#1f1f1f] text-xs font-semibold text-neutral-400 hover:text-white rounded-lg transition-colors font-mono cursor-pointer"
1322 |               >
1323 |                 Close
1324 |               </button>
1325 |               <button
1326 |                 onClick={() => {
1327 |                   alert("Agent configuration saved.");
1328 |                   handleCloseConfigPanel();
1329 |                 }}
1330 |                 className="py-2.5 bg-white hover:bg-neutral-100 text-black text-xs font-bold rounded-lg transition-all font-mono cursor-pointer"
1331 |               >
1332 |                 Save Config
1333 |               </button>
1334 |             </div>
1335 |           </div>
1336 |         ) : (
1337 |           <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
1338 |             <Bot className="w-12 h-12 text-neutral-700 mb-3 animate-pulse" />
1339 |             <p className="text-xs text-neutral-500">Click any agent node in the Flow to edit its configuration.</p>
1340 |           </div>
1341 |         )}
1342 |         </div>
1343 |       )}
1344 | 
1345 |       {/* 4. Modals & Overlays */}
1346 |       <AnimatePresence>
1347 | 
1348 |         {/* BYOK MODAL */}
1349 |         {isSecretOpen && (
1350 |           <motion.div
1351 |             initial={{ opacity: 0 }}
1352 |             animate={{ opacity: 1 }}
1353 |             exit={{ opacity: 0 }}
1354 |             className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-6 select-none"
1355 |           >
1356 |             <motion.div
1357 |               initial={{ scale: 0.95 }}
1358 |               animate={{ scale: 1 }}
1359 |               exit={{ scale: 0.95 }}
1360 |               className="w-full max-w-md bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl p-6 relative shadow-2xl"
1361 |             >
1362 |               <button onClick={() => setIsSecretOpen(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white cursor-pointer">
1363 |                 <X className="w-5 h-5" />
1364 |               </button>
1365 |               <div className="flex gap-4 items-center mb-6">
1366 |                 <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
1367 |                   <Key className="w-6 h-6 text-white" />
1368 |                 </div>
1369 |                 <div>
1370 |                   <h3 className="text-sm font-bold text-white">AI Engine Settings</h3>
1371 |                   <p className="text-xs text-neutral-400 font-sans mt-0.5">Select your AI provider and configure keys.</p>
1372 |                 </div>
1373 |               </div>
1374 |               <div className="space-y-4">
1375 |                 {/* 1. Provider Selector */}
1376 |                 <div className="space-y-1.5">
1377 |                   <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">Provider</label>
1378 |                   <select
1379 |                     value={selectedProvider}
1380 |                     onChange={(e) => setSelectedProvider(e.target.value)}
1381 |                     className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500"
1382 |                   >
1383 |                     {Object.keys(availableProviders).length > 0 ? (
1384 |                       Object.entries(availableProviders).map(([pid, cfg]: [string, any]) => (
1385 |                         <option key={pid} value={pid}>{cfg.name}</option>
1386 |                       ))
1387 |                     ) : (
1388 |                       <option value="gemini">Google Gemini</option>
1389 |                     )}
1390 |                   </select>
1391 |                 </div>
1392 | 
1393 |                 {/* 1.5 Base URL Selector (conditionally displayed) */}
1394 |                 {availableProviders[selectedProvider]?.requires_base_url && (
1395 |                   <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
1396 |                     <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">Base URL</label>
1397 |                     <input
1398 |                       type="text"
1399 |                       placeholder={availableProviders[selectedProvider]?.is_local ? "http://localhost:11434/v1" : "https://YOUR_RESOURCE.openai.azure.com/openai/deployments"}
1400 |                       value={baseUrlInput}
1401 |                       onChange={(e) => setBaseUrlInput(e.target.value)}
1402 |                       className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500"
1403 |                     />
1404 |                   </div>
1405 |                 )}
1406 | 
1407 |                 {/* 2. Model Selector */}
1408 |                 <div className="space-y-1.5">
1409 |                   <div className="flex justify-between items-center">
1410 |                     <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">Model</label>
1411 |                     {availableProviders[selectedProvider] && (
1412 |                       <button
1413 |                         onClick={async () => {
1414 |                           setIsFetchingModels(true);
1415 |                           setModelsFetchStatus("Connecting...");
1416 |                           try {
1417 |                             setProviderApiKey(selectedProvider, apiKeyInput.trim());
1418 |                             setProviderBaseUrl(selectedProvider, baseUrlInput.trim());
1419 |                             await fetchProviderModels(selectedProvider);
1420 |                             setModelsFetchStatus("Models loaded successfully!");
1421 |                           } catch (e) {
1422 |                             setModelsFetchStatus("Failed to query models endpoint.");
1423 |                           } finally {
1424 |                             setIsFetchingModels(false);
1425 |                           }
1426 |                         }}
1427 |                         disabled={isFetchingModels}
1428 |                         className="text-[9px] text-cyan-400 hover:underline cursor-pointer disabled:opacity-50 font-mono"
1429 |                       >
1430 |                         {isFetchingModels ? "Fetching..." : "Fetch Models ↻"}
1431 |                       </button>
1432 |                     )}
1433 |                   </div>
1434 |                   {(providerModels[selectedProvider] || availableProviders[selectedProvider]?.models)?.length > 0 ? (
1435 |                     <select
1436 |                       value={selectedModel}
1437 |                       onChange={(e) => setSelectedModel(e.target.value)}
1438 |                       className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500"
1439 |                     >
1440 |                       {(providerModels[selectedProvider] || availableProviders[selectedProvider].models).map((m: any) => (
1441 |                         <option key={m.id} value={m.id}>{m.name || m.id} {m.tier ? `(${m.tier})` : ""}</option>
1442 |                       ))}
1443 |                     </select>
1444 |                   ) : (
1445 |                     <input
1446 |                       type="text"
1447 |                       placeholder="e.g. gpt-4o, llama3, custom-deployment-id"
1448 |                       value={selectedModel}
1449 |                       onChange={(e) => setSelectedModel(e.target.value)}
1450 |                       className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500"
1451 |                     />
1452 |                   )}
1453 |                   {modelsFetchStatus && (
1454 |                     <p className={`text-[8px] font-mono ${modelsFetchStatus.toLowerCase().includes("failed") ? "text-red-400" : "text-emerald-400"}`}>
1455 |                       {modelsFetchStatus}
1456 |                     </p>
1457 |                   )}
1458 |                 </div>
1459 | 
1460 |                 {/* 3. API Key Input */}
1461 |                 <div className="space-y-1.5">
1462 |                   <div className="flex justify-between items-center">
1463 |                     <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">
1464 |                       {selectedProvider.toUpperCase()}_API_KEY
1465 |                     </label>
1466 |                     {availableProviders[selectedProvider]?.key_url && (
1467 |                       <a
1468 |                         href={availableProviders[selectedProvider].key_url}
1469 |                         target="_blank"
1470 |                         rel="noreferrer"
1471 |                         className="text-[9px] text-cyan-400 hover:underline"
1472 |                       >
1473 |                         Get key ↗
1474 |                       </a>
1475 |                     )}
1476 |                   </div>
1477 |                   <input
1478 |                     id="api-key-input"
1479 |                     type="password"
1480 |                     placeholder={
1481 |                       availableProviders[selectedProvider]
1482 |                         ? `Enter key (starts with ${availableProviders[selectedProvider].key_hint || "sk-..."})`
1483 |                         : "Enter API key"
1484 |                     }
1485 |                     value={apiKeyInput}
1486 |                     onChange={(e) => setApiKeyInput(e.target.value)}
1487 |                     className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500"
1488 |                   />
1489 |                   <p className="text-[9px] text-neutral-500 font-mono leading-normal">
1490 |                     {availableProviders[selectedProvider]?.description || "Configure key for custom models. Key is stored locally in-memory."}
1491 |                   </p>
1492 |                 </div>
1493 | 
1494 |                 {/* 3.5 Fallback Provider */}
1495 |                 <div className="space-y-1.5">
1496 |                   <label className="text-[9px] font-mono uppercase text-neutral-400 font-bold">Fallback Provider (Optional)</label>
1497 |                   <select
1498 |                     value={fallbackProviderInput}
1499 |                     onChange={(e) => setFallbackProviderInput(e.target.value)}
1500 |                     className="w-full bg-black border border-[#1f1f1f] rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-neutral-500"
1501 |                   >
1502 |                     <option value="">None (Disabled)</option>
1503 |                     {Object.entries(availableProviders)
1504 |                       .filter(([pid]) => pid !== selectedProvider)
1505 |                       .map(([pid, cfg]: [string, any]) => (
1506 |                         <option key={pid} value={pid}>{cfg.name}</option>
1507 |                       ))}
1508 |                   </select>
1509 |                 </div>
1510 | 
1511 |                 {/* 4. Save and Cancel Buttons */}
1512 |                 <div className="pt-4 flex gap-3">
1513 |                   <button
1514 |                     id="save-api-key-btn"
1515 |                     onClick={() => {
1516 |                       setProvider(selectedProvider);
1517 |                       setModel(selectedModel);
1518 |                       setProviderApiKey(selectedProvider, apiKeyInput.trim());
1519 |                       setProviderBaseUrl(selectedProvider, baseUrlInput.trim());
1520 |                       setFallbackProvider(fallbackProviderInput);
1521 |                       setIsSecretOpen(false);
1522 |                     }}
1523 |                     className="flex-1 py-2.5 bg-white hover:bg-neutral-100 text-black font-bold rounded-xl text-xs font-mono transition-colors cursor-pointer"
1524 |                   >
1525 |                     Save Settings
1526 |                   </button>
1527 |                   <button
1528 |                     onClick={() => setIsSecretOpen(false)}
1529 |                     className="px-5 py-2.5 border border-[#1f1f1f] text-neutral-400 hover:text-white rounded-xl text-xs font-mono transition-colors cursor-pointer"
1530 |                   >
1531 |                     Cancel
1532 |                   </button>
1533 |                 </div>
1534 |               </div>
1535 |             </motion.div>
1536 |           </motion.div>
1537 |         )}
1538 | 
1539 |         {/* USER PROFILE MODAL */}
1540 |         {isProfileOpen && (
1541 |           <motion.div
1542 |             initial={{ opacity: 0 }}
1543 |             animate={{ opacity: 1 }}
1544 |             exit={{ opacity: 0 }}
1545 |             className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-6 select-none"
1546 |           >
1547 |             <motion.div
1548 |               initial={{ scale: 0.95 }}
1549 |               animate={{ scale: 1 }}
1550 |               exit={{ scale: 0.95 }}
1551 |               className="w-full max-w-sm bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl p-6 relative shadow-2xl"
1552 |             >
1553 |               <button onClick={() => setIsProfileOpen(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white cursor-pointer">
1554 |                 <X className="w-5 h-5" />
1555 |               </button>
1556 |               <div className="flex flex-col items-center text-center space-y-4 py-4">
1557 |                 <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#1f1f1f] flex items-center justify-center bg-neutral-900">
1558 |                   <User className="w-8 h-8 text-neutral-500" />
1559 |                 </div>
1560 |                 <div>
1561 |                   <h3 className="text-sm font-bold text-white uppercase tracking-wider">User Profile</h3>
1562 |                   <span className="text-xs text-neutral-400 font-mono">solospace_user@gmail.com</span>
1563 |                 </div>
1564 |                 <div className="w-full pt-4 space-y-2 border-t border-[#141414]">
1565 |                   <div className="flex justify-between items-center bg-black py-2 px-3 rounded text-[10px] border border-[#141414] font-mono">
1566 |                     <span className="text-neutral-500">Plan:</span>
1567 |                     <span className="text-white font-bold">Pro</span>
1568 |                   </div>
1569 |                   <div className="flex justify-between items-center bg-black py-2 px-3 rounded text-[10px] border border-[#141414] font-mono">
1570 |                     <span className="text-neutral-500">Sessions:</span>
1571 |                     <span className="text-white font-bold">{Object.values(sessions).length}</span>
1572 |                   </div>
1573 |                 </div>
1574 |                 <button
1575 |                   onClick={() => setIsProfileOpen(false)}
1576 |                   className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-[#1f1f1f] text-neutral-300 hover:text-white font-bold rounded-xl text-xs font-mono transition-colors cursor-pointer"
1577 |                 >
1578 |                   Close
1579 |                 </button>
1580 |               </div>
1581 |             </motion.div>
1582 |           </motion.div>
1583 |         )}
1584 | 
1585 |         {/* TOOL APPROVAL TOAST */}
1586 |         {pendingApproval && (
1587 |           <div className="fixed bottom-6 right-6 w-96 bg-[#0d0d0d] border border-amber-500/50 shadow-[0_0_50px_rgba(245,158,11,0.15)] rounded-2xl p-5 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 select-none">
1588 |             <div className="flex gap-4 items-start">
1589 |               <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 shrink-0">
1590 |                 <Sliders className="w-5 h-5 animate-pulse" />
1591 |               </div>
1592 |               <div className="flex-1 space-y-2">
1593 |                 <div className="flex justify-between items-center">
1594 |                   <span className="text-[10px] font-bold text-amber-500 font-mono tracking-widest uppercase">Permission Required</span>
1595 |                   <span className="text-[9px] text-neutral-500 font-mono">Agent Tool</span>
1596 |                 </div>
1597 |                 <h4 className="text-xs font-bold text-white">
1598 |                   &apos;{(nodes.find(n => n.id === pendingApproval.nodeId)?.data as any)?.name}&apos; wants to use <span className="text-amber-400 font-mono">[{pendingApproval.toolName}]</span>
1599 |                 </h4>
1600 |                 <p className="text-[10px] text-neutral-400 leading-normal">
1601 |                   Action: <span className="text-white font-semibold">{pendingApproval.action}</span> — {pendingApproval.detail}
1602 |                 </p>
1603 |                 <div className="pt-3 flex gap-2">
1604 |                   <button
1605 |                     onClick={() => {
1606 |                       const sessId = pendingApproval.sessionId || activeSessionId || "";
1607 |                       fetch("/api/gemini/approve", {
1608 |                         method: "POST",
1609 |                         headers: { "Content-Type": "application/json" },
1610 |                         body: JSON.stringify({
1611 |                           sessionId: sessId,
1612 |                           nodeId: pendingApproval.nodeId,
1613 |                           toolName: pendingApproval.toolName,
1614 |                           action: "approve"
1615 |                         })
1616 |                       }).catch(e => console.error("Failed to approve tool:", e));
1617 | 
1618 |                       const node = nodes.find(n => n.id === pendingApproval.nodeId);
1619 |                       if (node) {
1620 |                         const updatedLogs = ((node.data as any).toolLogs || []).map((log: any) => {
1621 |                           if (log.id === pendingApproval.logId) {
1622 |                             return { ...log, status: "SUCCESS" as const, detail: `Approved: ${pendingApproval.detail}` };
1623 |                           }
1624 |                           return log;
1625 |                         });
1626 |                         updateNodeField(pendingApproval.nodeId, { toolLogs: updatedLogs });
1627 |                       }
1628 |                       useWorkflowStore.setState({ pendingApproval: null });
1629 |                     }}
1630 |                     className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-lg text-[10px] font-mono transition-colors cursor-pointer"
1631 |                   >
1632 |                     Approve
1633 |                   </button>
1634 |                   <button
1635 |                     onClick={() => {
1636 |                       const sessId = pendingApproval.sessionId || activeSessionId || "";
1637 |                       fetch("/api/gemini/approve", {
1638 |                         method: "POST",
1639 |                         headers: { "Content-Type": "application/json" },
1640 |                         body: JSON.stringify({
1641 |                           sessionId: sessId,
1642 |                           nodeId: pendingApproval.nodeId,
1643 |                           toolName: pendingApproval.toolName,
1644 |                           action: "deny"
1645 |                         })
1646 |                       }).catch(e => console.error("Failed to deny tool:", e));
1647 | 
1648 |                       const node = nodes.find(n => n.id === pendingApproval.nodeId);
1649 |                       if (node) {
1650 |                         const updatedLogs = ((node.data as any).toolLogs || []).map((log: any) => {
1651 |                           if (log.id === pendingApproval.logId) {
1652 |                             return { ...log, status: "BLOCKED" as const, detail: `Denied: ${pendingApproval.detail}` };
1653 |                           }
1654 |                           return log;
1655 |                         });
1656 |                         updateNodeField(pendingApproval.nodeId, { toolLogs: updatedLogs });
1657 |                       }
1658 |                       useWorkflowStore.setState({ pendingApproval: null });
1659 |                     }}
1660 |                     className="px-4 py-2 border border-[#1f1f1f] text-neutral-400 hover:text-white rounded-lg text-[10px] font-mono transition-colors cursor-pointer"
1661 |                   >
1662 |                     Deny
1663 |                   </button>
1664 |                 </div>
1665 |               </div>
1666 |             </div>
1667 |           </div>
1668 |         )}
1669 | 
1670 |       </AnimatePresence>
1671 |     </div>
1672 |   );
1673 | }
1674 |
```

### File: `Frontend/components/edges/CustomEdge.tsx`

> 134 lines | 4.0 KB

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

> 199 lines | 8.2 KB

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

> 356 lines | 12.5 KB

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

> 1014 lines | 32.9 KB

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
 109 |   fallbackProvider: string;
 110 |   setFallbackProvider: (provider: string) => void;
 111 |   providerBaseUrls: Record<string, string>;
 112 |   setProviderBaseUrl: (provider: string, url: string) => void;
 113 |   providerModels: Record<string, any[]>;
 114 |   fetchProviderModels: (providerId: string) => Promise<void>;
 115 |   followUpSuggestions: string[];
 116 |   liveThoughts: string;
 117 |   abortController: AbortController | null;
 118 |   cancelOrchestration: () => void;
 119 | 
 120 |   // Actions
 121 |   setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
 122 |   setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;
 123 |   onNodesChange: OnNodesChange<Node>;
 124 |   onEdgesChange: OnEdgesChange;
 125 |   onConnect: OnConnect;
 126 |   setSelectedNodeId: (id: string | null) => void;
 127 |   updateNodeField: (nodeId: string, updates: Partial<CanvasNodeData>) => void;
 128 |   addNode: (node: Node) => void;
 129 |   deleteNode: (nodeId: string) => void;
 130 |   deleteEdge: (edgeId: string) => void;
 131 |   addRule: (nodeId: string, rule: string) => void;
 132 |   deleteRule: (nodeId: string, ruleIndex: number) => void;
 133 |   simulateToolExecution?: never;
 134 |   setExecutionState: (state: 'setup' | 'running' | 'paused') => void;
 135 |   setIsOrchestrating: (val: boolean) => void;
 136 |   setIsThinking: (val: boolean) => void;
 137 |   setStatusMessage: (msg: string) => void;
 138 |   setChatMessages: (msgs: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
 139 |   setAgentTalkLogs: (logs: AgentTalkLog[] | ((prev: AgentTalkLog[]) => AgentTalkLog[])) => void;
 140 |   setPendingApproval: (val: PendingApproval | null) => void;
 141 | 
 142 |   // Session Actions
 143 |   createSession: (prompt: string, mode: 'auto' | 'custom') => string;
 144 |   switchSession: (sessionId: string) => void;
 145 |   saveCurrentSession: () => void;
 146 |   fetchSessions: () => Promise<void>;
 147 |   loadSessionFromDb: (sessionId: string) => Promise<void>;
 148 |   deleteSessionFromDb: (sessionId: string) => Promise<void>;
 149 | 
 150 |   triggerSteerOrchestration: (promptText: string, execute?: boolean) => void;
 151 |   triggerCustomExecution: () => Promise<void>;
 152 | }
 153 | 
 154 | let saveTimeout: any = null;
 155 | const debounceSave = (currentSessionId: string, get: any, set: any) => {
 156 |   if (saveTimeout) clearTimeout(saveTimeout);
 157 |   saveTimeout = setTimeout(() => {
 158 |     // Re-verify the session is still active before saving to prevent stale writes
 159 |     const activeId = get().activeSessionId;
 160 |     if (activeId !== currentSessionId) return;
 161 | 
 162 |     set((state: any) => {
 163 |       // Only save if the session still exists
 164 |       if (!state.sessions[currentSessionId]) return state;
 165 | 
 166 |       const currentSession = {
 167 |         id: currentSessionId,
 168 |         title: state.sessions[currentSessionId]?.title || "Chat",
 169 |         prompt: state.sessions[currentSessionId]?.prompt || "",
 170 |         mode: state.sessions[currentSessionId]?.mode || "auto",
 171 |         nodes: state.nodes,
 172 |         edges: state.edges,
 173 |         chatMessages: state.chatMessages,
 174 |         agentTalkLogs: state.agentTalkLogs,
 175 |         executionState: state.executionState,
 176 |         statusMessage: state.statusMessage,
 177 |         followUpSuggestions: state.followUpSuggestions
 178 |       };
 179 |       return { sessions: { ...state.sessions, [currentSessionId]: currentSession } };
 180 |     });
 181 |   }, 500);
 182 | };
 183 | 
 184 | export const useWorkflowStore = create<WorkflowState>((set, get) => ({
 185 |   sessions: {},
 186 |   activeSessionId: null,
 187 |   nodes: [],
 188 |   edges: [],
 189 |   selectedNodeId: null,
 190 |   executionState: 'setup',
 191 |   isOrchestrating: false,
 192 |   isThinking: false,
 193 |   statusMessage: '',
 194 |   chatMessages: [],
 195 |   agentTalkLogs: [],
 196 |   pendingApproval: null,
 197 |   apiKey: null,
 198 |   setApiKey: (key) => set({ apiKey: key }),
 199 |   provider: "gemini",
 200 |   model: "gemini-2.5-flash",
 201 |   apiKeys: {},
 202 |   availableProviders: {},
 203 |   setProvider: (provider) => set({ provider }),
 204 |   setModel: (model) => set({ model }),
 205 |   setProviderApiKey: (provider, key) => set((state) => ({ apiKeys: { ...state.apiKeys, [provider]: key } })),
 206 |   fetchAvailableProviders: async () => {
 207 |     try {
 208 |       const resp = await fetch("/api/gemini/providers");
 209 |       if (resp.ok) {
 210 |         const data = await resp.json();
 211 |         set({ availableProviders: data });
 212 |       }
 213 |     } catch (e) {
 214 |       console.error("Failed to fetch available providers", e);
 215 |     }
 216 |   },
 217 |   fallbackProvider: "",
 218 |   setFallbackProvider: (provider) => set({ fallbackProvider: provider }),
 219 |   providerBaseUrls: {},
 220 |   setProviderBaseUrl: (provider, url) => set((state) => ({ providerBaseUrls: { ...state.providerBaseUrls, [provider]: url } })),
 221 |   providerModels: {},
 222 |   fetchProviderModels: async (providerId: string) => {
 223 |     try {
 224 |       const state = get();
 225 |       const apiKey = state.apiKeys[providerId] || state.apiKey || "";
 226 |       const baseUrl = state.providerBaseUrls[providerId] || "";
 227 |       const resp = await fetch("/api/gemini/models", {
 228 |         method: "POST",
 229 |         headers: { "Content-Type": "application/json" },
 230 |         body: JSON.stringify({
 231 |           provider: providerId,
 232 |           api_key: apiKey,
 233 |           api_keys: state.apiKeys,
 234 |           base_url: baseUrl
 235 |         })
 236 |       });
 237 |       if (resp.ok) {
 238 |         const data = await resp.json();
 239 |         set((state) => ({
 240 |           providerModels: {
 241 |             ...state.providerModels,
 242 |             [providerId]: data.models || []
 243 |           }
 244 |         }));
 245 |       }
 246 |     } catch (e) {
 247 |       console.error(`Failed to fetch models for provider ${providerId}`, e);
 248 |     }
 249 |   },
 250 |   followUpSuggestions: [],
 251 |   liveThoughts: '',
 252 |   abortController: null,
 253 |   cancelOrchestration: () => {
 254 |     const controller = get().abortController;
 255 |     if (controller) {
 256 |       controller.abort();
 257 |       set({ abortController: null, isOrchestrating: false, isThinking: false });
 258 |     }
 259 |   },
 260 | 
 261 |   setNodes: (newNodes) => {
 262 |     set((state) => ({
 263 |       nodes: typeof newNodes === 'function' ? newNodes(state.nodes) : newNodes
 264 |     }));
 265 |     get().saveCurrentSession();
 266 |   },
 267 | 
 268 |   setEdges: (newEdges) => {
 269 |     set((state) => ({
 270 |       edges: typeof newEdges === 'function' ? newEdges(state.edges) : newEdges
 271 |     }));
 272 |     get().saveCurrentSession();
 273 |   },
 274 | 
 275 |   onNodesChange: (changes) => {
 276 |     set((state) => ({
 277 |       nodes: applyNodeChanges(changes, state.nodes)
 278 |     }));
 279 |     get().saveCurrentSession();
 280 |   },
 281 | 
 282 |   onEdgesChange: (changes) => {
 283 |     set((state) => ({
 284 |       edges: applyEdgeChanges(changes, state.edges)
 285 |     }));
 286 |     get().saveCurrentSession();
 287 |   },
 288 | 
 289 |   onConnect: (connection) => {
 290 |     set((state) => {
 291 |       const edge: Edge = {
 292 |         ...connection,
 293 |         id: `e-${connection.source}-${connection.target}`,
 294 |         animated: true,
 295 |         type: 'custom',
 296 |         style: { stroke: '#06b6d4', strokeWidth: 2 }
 297 |       };
 298 | 
 299 |       // Sync dependency: target node depends on source node
 300 |       const updatedNodes = state.nodes.map(node => {
 301 |         if (node.id === connection.target) {
 302 |           const currentDeps = (node.data as any).dependencies || [];
 303 |           if (!currentDeps.includes(connection.source)) {
 304 |             return {
 305 |               ...node,
 306 |               data: { ...node.data, dependencies: [...currentDeps, connection.source] }
 307 |             };
 308 |           }
 309 |         }
 310 |         return node;
 311 |       });
 312 | 
 313 |       return { edges: addEdge(edge, state.edges), nodes: updatedNodes };
 314 |     });
 315 |     get().saveCurrentSession();
 316 |   },
 317 | 
 318 |   setSelectedNodeId: (id) => set({ selectedNodeId: id }),
 319 | 
 320 |   updateNodeField: (nodeId, updates) => {
 321 |     set((state) => ({
 322 |       nodes: state.nodes.map((node) => {
 323 |         if (node.id === nodeId) {
 324 |           return { ...node, data: { ...node.data, ...updates } };
 325 |         }
 326 |         return node;
 327 |       })
 328 |     }));
 329 |     get().saveCurrentSession();
 330 |   },
 331 | 
 332 |   addNode: (node) => {
 333 |     set((state) => ({ nodes: [...state.nodes, node] }));
 334 |     get().saveCurrentSession();
 335 |   },
 336 | 
 337 |   deleteNode: (nodeId) => {
 338 |     set((state) => ({
 339 |       nodes: state.nodes.filter((node) => node.id !== nodeId),
 340 |       edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
 341 |       selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId
 342 |     }));
 343 |     get().saveCurrentSession();
 344 |   },
 345 | 
 346 |   deleteEdge: (edgeId) => {
 347 |     set((state) => {
 348 |       const edge = state.edges.find(e => e.id === edgeId);
 349 |       let updatedNodes = state.nodes;
 350 | 
 351 |       // Sync dependency: remove source from target's dependencies when edge deleted
 352 |       if (edge) {
 353 |         updatedNodes = state.nodes.map(node => {
 354 |           if (node.id === edge.target) {
 355 |             const currentDeps = (node.data as any).dependencies || [];
 356 |             return {
 357 |               ...node,
 358 |               data: { ...node.data, dependencies: currentDeps.filter((d: string) => d !== edge.source) }
 359 |             };
 360 |           }
 361 |           return node;
 362 |         });
 363 |       }
 364 | 
 365 |       return {
 366 |         edges: state.edges.filter(e => e.id !== edgeId),
 367 |         nodes: updatedNodes
 368 |       };
 369 |     });
 370 |     get().saveCurrentSession();
 371 |   },
 372 | 
 373 |   addRule: (nodeId, rule) => {
 374 |     set((state) => ({
 375 |       nodes: state.nodes.map((node) => {
 376 |         if (node.id === nodeId) {
 377 |           return {
 378 |             ...node,
 379 |             data: { ...node.data, rules: [...((node.data as any).rules || []), rule] }
 380 |           };
 381 |         }
 382 |         return node;
 383 |       })
 384 |     }));
 385 |     get().saveCurrentSession();
 386 |   },
 387 | 
 388 |   deleteRule: (nodeId, ruleIndex) => {
 389 |     set((state) => ({
 390 |       nodes: state.nodes.map((node) => {
 391 |         if (node.id === nodeId) {
 392 |           return {
 393 |             ...node,
 394 |             data: {
 395 |               ...node.data,
 396 |               rules: ((node.data as any).rules || []).filter((_: any, idx: number) => idx !== ruleIndex)
 397 |             }
 398 |           };
 399 |         }
 400 |         return node;
 401 |       })
 402 |     }));
 403 |     get().saveCurrentSession();
 404 |   },
 405 | 
 406 |   // (simulateToolExecution removed — backend runs real tools)
 407 | 
 408 |   // State modifiers
 409 |   setExecutionState: (state) => {
 410 |     set({ executionState: state });
 411 |     get().saveCurrentSession();
 412 |   },
 413 |   setIsOrchestrating: (val) => set({ isOrchestrating: val }),
 414 |   setIsThinking: (val) => set({ isThinking: val }),
 415 |   setStatusMessage: (msg) => {
 416 |     set({ statusMessage: msg });
 417 |     get().saveCurrentSession();
 418 |   },
 419 |   setChatMessages: (msgs) => {
 420 |     set((state) => ({
 421 |       chatMessages: typeof msgs === 'function' ? msgs(state.chatMessages) : msgs
 422 |     }));
 423 |     get().saveCurrentSession();
 424 |   },
 425 |   setAgentTalkLogs: (logs) => {
 426 |     set((state) => ({
 427 |       agentTalkLogs: typeof logs === 'function' ? logs(state.agentTalkLogs) : logs
 428 |     }));
 429 |     get().saveCurrentSession();
 430 |   },
 431 |   setPendingApproval: (val) => set({ pendingApproval: val }),
 432 | 
 433 |   // Session Actions
 434 |   createSession: (prompt, mode) => {
 435 |     const sessionId = Date.now().toString();
 436 |     const newSession: ChatSession = {
 437 |       id: sessionId,
 438 |       title: prompt.length > 40 ? prompt.substring(0, 40) + "..." : prompt,
 439 |       prompt: prompt,
 440 |       mode: mode,
 441 |       nodes: [],
 442 |       edges: [],
 443 |       chatMessages: [],
 444 |       agentTalkLogs: [],
 445 |       executionState: "setup",
 446 |       statusMessage: "",
 447 |       followUpSuggestions: []
 448 |     };
 449 | 
 450 |     set((state) => ({
 451 |       sessions: { ...state.sessions, [sessionId]: newSession },
 452 |       activeSessionId: sessionId,
 453 |       nodes: [],
 454 |       edges: [],
 455 |       chatMessages: [],
 456 |       agentTalkLogs: [],
 457 |       executionState: "setup",
 458 |       statusMessage: "",
 459 |       followUpSuggestions: []
 460 |     }));
 461 | 
 462 |     return sessionId;
 463 |   },
 464 | 
 465 |   switchSession: (sessionId) => {
 466 |     const currentSessionId = get().activeSessionId;
 467 |     if (currentSessionId) {
 468 |       const currentSession: ChatSession = {
 469 |         id: currentSessionId,
 470 |         title: get().sessions[currentSessionId]?.title || "Chat",
 471 |         prompt: get().sessions[currentSessionId]?.prompt || "",
 472 |         mode: get().sessions[currentSessionId]?.mode || "auto",
 473 |         nodes: get().nodes,
 474 |         edges: get().edges,
 475 |         chatMessages: get().chatMessages,
 476 |         agentTalkLogs: get().agentTalkLogs,
 477 |         executionState: get().executionState,
 478 |         statusMessage: get().statusMessage,
 479 |         followUpSuggestions: get().followUpSuggestions
 480 |       };
 481 |       set((state) => ({
 482 |         sessions: { ...state.sessions, [currentSessionId]: currentSession }
 483 |       }));
 484 |     }
 485 | 
 486 |     const newSession = get().sessions[sessionId];
 487 |     if (newSession) {
 488 |       set({
 489 |         activeSessionId: sessionId,
 490 |         nodes: newSession.nodes,
 491 |         edges: newSession.edges,
 492 |         chatMessages: newSession.chatMessages,
 493 |         agentTalkLogs: newSession.agentTalkLogs,
 494 |         executionState: newSession.executionState,
 495 |         statusMessage: newSession.statusMessage,
 496 |         followUpSuggestions: newSession.followUpSuggestions || [],
 497 |         selectedNodeId: null
 498 |       });
 499 |     }
 500 |   },
 501 | 
 502 |   saveCurrentSession: () => {
 503 |     const currentSessionId = get().activeSessionId;
 504 |     if (!currentSessionId) return;
 505 |     debounceSave(currentSessionId, get, set);
 506 |   },
 507 | 
 508 |   fetchSessions: async () => {
 509 |     try {
 510 |       const response = await fetch("/api/gemini/sessions");
 511 |       if (response.ok) {
 512 |         const list = await response.json();
 513 |         const updatedSessions: Record<string, ChatSession> = { ...get().sessions };
 514 |         for (const s of list) {
 515 |           if (!updatedSessions[s.session_id]) {
 516 |             updatedSessions[s.session_id] = {
 517 |               id: s.session_id,
 518 |               title: s.title,
 519 |               prompt: s.prompt,
 520 |               mode: s.mode,
 521 |               nodes: [],
 522 |               edges: [],
 523 |               chatMessages: [],
 524 |               agentTalkLogs: [],
 525 |               executionState: s.execution_state,
 526 |               statusMessage: s.status_message,
 527 |               followUpSuggestions: []
 528 |             };
 529 |           }
 530 |         }
 531 |         set({ sessions: updatedSessions });
 532 |       }
 533 |     } catch (e) {
 534 |       console.error("Failed to fetch sessions from DB", e);
 535 |     }
 536 |   },
 537 | 
 538 |   loadSessionFromDb: async (sessionId: string) => {
 539 |     try {
 540 |       const response = await fetch(`/api/gemini/sessions?id=${sessionId}`);
 541 |       if (response.ok) {
 542 |         const fullSession = await response.json();
 543 |         const session: ChatSession = {
 544 |           id: fullSession.session_id,
 545 |           title: fullSession.title,
 546 |           prompt: fullSession.prompt,
 547 |           mode: fullSession.mode,
 548 |           nodes: fullSession.nodes,
 549 |           edges: fullSession.edges,
 550 |           chatMessages: fullSession.chat_messages,
 551 |           agentTalkLogs: fullSession.agent_talk_logs,
 552 |           executionState: fullSession.execution_state,
 553 |           statusMessage: fullSession.status_message,
 554 |           followUpSuggestions: fullSession.follow_up_suggestions
 555 |         };
 556 |         
 557 |         set((state) => ({
 558 |           sessions: { ...state.sessions, [sessionId]: session },
 559 |           activeSessionId: sessionId,
 560 |           nodes: session.nodes,
 561 |           edges: session.edges,
 562 |           chatMessages: session.chatMessages,
 563 |           agentTalkLogs: session.agentTalkLogs,
 564 |           executionState: session.executionState,
 565 |           statusMessage: session.statusMessage,
 566 |           followUpSuggestions: session.followUpSuggestions || [],
 567 |           selectedNodeId: null
 568 |         }));
 569 |       }
 570 |     } catch (e) {
 571 |       console.error("Failed to load session from DB", e);
 572 |     }
 573 |   },
 574 | 
 575 |   deleteSessionFromDb: async (sessionId: string) => {
 576 |     // Abort orchestration if deleting the currently active session
 577 |     if (get().activeSessionId === sessionId) {
 578 |       const ctrl = get().abortController;
 579 |       if (ctrl) ctrl.abort();
 580 |     }
 581 | 
 582 |     try {
 583 |       const response = await fetch(`/api/gemini/sessions?id=${sessionId}`, {
 584 |         method: "DELETE"
 585 |       });
 586 |       if (response.ok) {
 587 |         set((state) => {
 588 |           const updated = { ...state.sessions };
 589 |           delete updated[sessionId];
 590 |           const newActiveId = state.activeSessionId === sessionId ? null : state.activeSessionId;
 591 |           return {
 592 |             sessions: updated,
 593 |             activeSessionId: newActiveId,
 594 |             abortController: state.activeSessionId === sessionId ? null : state.abortController,
 595 |             isOrchestrating: state.activeSessionId === sessionId ? false : state.isOrchestrating,
 596 |             isThinking: state.activeSessionId === sessionId ? false : state.isThinking,
 597 |             ...(newActiveId ? {} : {
 598 |               nodes: [],
 599 |               edges: [],
 600 |               chatMessages: [],
 601 |               agentTalkLogs: [],
 602 |               executionState: "setup",
 603 |               statusMessage: "",
 604 |               followUpSuggestions: []
 605 |             })
 606 |           };
 607 |         });
 608 |       }
 609 |     } catch (e) {
 610 |       console.error("Failed to delete session", e);
 611 |     }
 612 |   },
 613 | 
 614 |   triggerSteerOrchestration: async (promptText, execute = true) => {
 615 |     if (!promptText.trim()) return;
 616 | 
 617 |     // Abort any active orchestration
 618 |     const currentController = get().abortController;
 619 |     if (currentController) {
 620 |       currentController.abort();
 621 |     }
 622 | 
 623 |     const controller = new AbortController();
 624 | 
 625 |     const userMsg: ChatMessage = {
 626 |       id: Date.now().toString(),
 627 |       sender: "user",
 628 |       text: promptText,
 629 |       timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
 630 |     };
 631 | 
 632 |     set((state) => ({
 633 |       chatMessages: [...state.chatMessages, userMsg],
 634 |       isOrchestrating: true,
 635 |       isThinking: true,
 636 |       statusMessage: "",
 637 |       liveThoughts: "",
 638 |       agentTalkLogs: [],
 639 |       followUpSuggestions: [],
 640 |       abortController: controller
 641 |     }));
 642 |     get().saveCurrentSession();
 643 | 
 644 |     // Create target AI message placeholder
 645 |     const aiMsgId = (Date.now() + 1).toString();
 646 |     set((state) => ({
 647 |       chatMessages: [
 648 |         ...state.chatMessages,
 649 |         {
 650 |           id: aiMsgId,
 651 |           sender: "ai",
 652 |           text: "",
 653 |           thinkingSummary: "",
 654 |           timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
 655 |         }
 656 |       ]
 657 |     }));
 658 |     get().saveCurrentSession();
 659 | 
 660 |     try {
 661 |       const response = await fetch("/api/gemini/orchestrate", {
 662 |         method: "POST",
 663 |         headers: { "Content-Type": "application/json" },
 664 |         body: JSON.stringify({
 665 |           prompt: promptText,
 666 |           history: get().chatMessages
 667 |             .filter(m => m.id !== aiMsgId) // Exclude current empty prompt placeholder
 668 |             .map(m => ({ sender: m.sender, text: m.text })),
 669 |           api_key: get().apiKeys[get().provider] || get().apiKey || "",
 670 |           api_keys: get().apiKeys,
 671 |           session_id: get().activeSessionId || "",
 672 |           execute_agents: execute,
 673 |           provider: get().provider,
 674 |           model: get().model,
 675 |           fallback_provider: get().fallbackProvider || null,
 676 |           base_url: get().providerBaseUrls[get().provider] || null
 677 |         }),
 678 |         signal: controller.signal
 679 |       });
 680 | 
 681 |       if (!response.ok) {
 682 |         const errData = await response.json().catch(() => ({ detail: "Orchestration failed." }));
 683 |         throw new Error(errData.detail || `Server status error: ${response.status}`);
 684 |       }
 685 | 
 686 |       const reader = response.body?.getReader();
 687 |       const decoder = new TextDecoder();
 688 |       if (!reader) throw new Error("No response stream body reader.");
 689 | 
 690 |       let assistantResponse = "";
 691 |       let thinkingSummary = "";
 692 |       let buffer = "";
 693 | 
 694 |       while (true) {
 695 |         const { done, value } = await reader.read();
 696 |         if (done) break;
 697 | 
 698 |         buffer += decoder.decode(value, { stream: true });
 699 |         
 700 |         const parts = buffer.split("\n\n");
 701 |         buffer = parts.pop() || "";
 702 | 
 703 |         for (const part of parts) {
 704 |           if (!part.trim()) continue;
 705 | 
 706 |           const lines = part.split("\n");
 707 |           let eventType = "text";
 708 |           let dataLines: string[] = [];
 709 | 
 710 |           for (const line of lines) {
 711 |             if (line.startsWith("event: ")) {
 712 |               eventType = line.slice(7);
 713 |             } else if (line.startsWith("data: ")) {
 714 |               dataLines.push(line.slice(6));
 715 |             } else if (line.startsWith("data:")) {
 716 |               dataLines.push(line.slice(5));
 717 |             }
 718 |           }
 719 | 
 720 |           const dataContent = dataLines.join("\n");
 721 | 
 722 |           if (eventType === "text") {
 723 |             try {
 724 |               const textVal = JSON.parse(dataContent);
 725 |               assistantResponse += textVal;
 726 |               set((state) => ({
 727 |                 isThinking: false, // Turn off thinking dots on first text token
 728 |                 chatMessages: state.chatMessages.map(m =>
 729 |                   m.id === aiMsgId ? { ...m, text: assistantResponse } : m
 730 |                 )
 731 |               }));
 732 |             } catch (e) {
 733 |               console.error("Text SSE parse error", e);
 734 |             }
 735 |           } else if (eventType === "thinking") {
 736 |             try {
 737 |               const thoughtVal = JSON.parse(dataContent);
 738 |               thinkingSummary += thoughtVal;
 739 |               set((state) => ({
 740 |                 liveThoughts: thinkingSummary,
 741 |                 chatMessages: state.chatMessages.map(m =>
 742 |                   m.id === aiMsgId ? { ...m, thinkingSummary: thinkingSummary } : m
 743 |                 )
 744 |               }));
 745 |             } catch (e) {
 746 |               console.error("Thinking SSE parse error", e);
 747 |             }
 748 |           } else if (eventType === "status") {
 749 |             try {
 750 |               const statusVal = JSON.parse(dataContent);
 751 |               set({ statusMessage: typeof statusVal === "string" ? statusVal : "" });
 752 |             } catch (e) {
 753 |               console.error("Status SSE parse error", e);
 754 |             }
 755 |           } else if (eventType === "metadata") {
 756 |             try {
 757 |               const meta = JSON.parse(dataContent);
 758 |               set({
 759 |                 nodes: meta.nodes || [],
 760 |                 edges: meta.edges || [],
 761 |                 agentTalkLogs: meta.agent_talk || [],
 762 |                 followUpSuggestions: meta.follow_up_suggestions || []  // Bug 2: populate suggestions
 763 |               });
 764 |             } catch (e) {
 765 |               console.error("Metadata SSE parse error", e);
 766 |             }
 767 |           } else if (eventType === "tool_approval") {
 768 |             try {
 769 |               const approval = JSON.parse(dataContent);
 770 |               set({ pendingApproval: approval });
 771 |             } catch (e) {
 772 |               console.error("Tool approval SSE parse error", e);
 773 |             }
 774 |           }
 775 |         }
 776 |       }
 777 | 
 778 |       if (!assistantResponse) {
 779 |         const fallbackMsg = "I'm sorry, I couldn't generate a response. This might be due to a temporary issue with the AI service or an invalid API key. Please check your API key in Settings and try again.";
 780 |         set((state) => ({
 781 |           chatMessages: state.chatMessages.map(m =>
 782 |             m.id === aiMsgId ? { ...m, text: fallbackMsg } : m
 783 |           )
 784 |         }));
 785 |       }
 786 | 
 787 |       set({ abortController: null });
 788 |       get().saveCurrentSession();
 789 |     } catch (err: any) {
 790 |       if (err.name === 'AbortError') {
 791 |         console.log("Steer Orchestration manually aborted.");
 792 |         set((state) => ({
 793 |           chatMessages: state.chatMessages.map(m =>
 794 |             m.id === aiMsgId && !m.text ? { ...m, text: "*Generation stopped by user.*" } : m
 795 |           )
 796 |         }));
 797 |       } else {
 798 |         console.error("Steer Orchestration stream error:", err);
 799 |         const errorMsg = `**Connection Error.**\n\n${err.message || "Failed to parse stream event source. Check backend logs."}`;
 800 |         set((state) => ({
 801 |           chatMessages: state.chatMessages.map(m =>
 802 |             m.id === aiMsgId ? { ...m, text: errorMsg } : m
 803 |           ),
 804 |           nodes: [],
 805 |           edges: [],
 806 |           followUpSuggestions: []
 807 |         }));
 808 |       }
 809 |       set({ abortController: null, isThinking: false, isOrchestrating: false });
 810 |       get().saveCurrentSession();
 811 |     } finally {
 812 |       set({ isOrchestrating: false, isThinking: false, statusMessage: '', liveThoughts: '' });
 813 |       get().saveCurrentSession();
 814 |     }
 815 |   },
 816 | 
 817 |   triggerCustomExecution: async () => {
 818 |     const currentController = get().abortController;
 819 |     if (currentController) {
 820 |       currentController.abort();
 821 |     }
 822 | 
 823 |     const controller = new AbortController();
 824 | 
 825 |     const sessionId = get().activeSessionId;
 826 |     if (!sessionId) return;
 827 | 
 828 |     const prompt = get().chatMessages.findLast(m => m.sender === 'user')?.text || "";
 829 | 
 830 |     set((state) => ({
 831 |       isOrchestrating: true,
 832 |       isThinking: true,
 833 |       statusMessage: "Running custom orchestration loop...",
 834 |       liveThoughts: "",
 835 |       agentTalkLogs: [],
 836 |       followUpSuggestions: [],
 837 |       abortController: controller
 838 |     }));
 839 |     get().saveCurrentSession();
 840 | 
 841 |     const aiMsgId = Date.now().toString();
 842 |     set((state) => ({
 843 |       chatMessages: [
 844 |         ...state.chatMessages,
 845 |         {
 846 |           id: aiMsgId,
 847 |           sender: "ai",
 848 |           text: "",
 849 |           thinkingSummary: "",
 850 |           timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
 851 |         }
 852 |       ]
 853 |     }));
 854 |     get().saveCurrentSession();
 855 | 
 856 |     try {
 857 |       const response = await fetch("/api/gemini/execute_custom", {
 858 |         method: "POST",
 859 |         headers: { "Content-Type": "application/json" },
 860 |         body: JSON.stringify({
 861 |           session_id: sessionId,
 862 |           prompt: prompt,
 863 |           history: get().chatMessages
 864 |             .filter(m => m.id !== aiMsgId)
 865 |             .map(m => ({ sender: m.sender, text: m.text })),
 866 |           api_key: get().apiKeys[get().provider] || get().apiKey || "",
 867 |           api_keys: get().apiKeys,
 868 |           nodes: get().nodes,
 869 |           edges: get().edges,
 870 |           provider: get().provider,
 871 |           model: get().model,
 872 |           fallback_provider: get().fallbackProvider || null,
 873 |           base_url: get().providerBaseUrls[get().provider] || null
 874 |         }),
 875 |         signal: controller.signal
 876 |       });
 877 | 
 878 |       if (!response.ok) {
 879 |         const errData = await response.json().catch(() => ({ detail: "Execution failed." }));
 880 |         throw new Error(errData.detail || `Server status error: ${response.status}`);
 881 |       }
 882 | 
 883 |       const reader = response.body?.getReader();
 884 |       const decoder = new TextDecoder();
 885 |       if (!reader) throw new Error("No response stream body reader.");
 886 | 
 887 |       let assistantResponse = "";
 888 |       let thinkingSummary = "";
 889 |       let buffer = "";
 890 | 
 891 |       while (true) {
 892 |         const { done, value } = await reader.read();
 893 |         if (done) break;
 894 | 
 895 |         buffer += decoder.decode(value, { stream: true });
 896 |         
 897 |         const parts = buffer.split("\n\n");
 898 |         buffer = parts.pop() || "";
 899 | 
 900 |         for (const part of parts) {
 901 |           if (!part.trim()) continue;
 902 | 
 903 |           const lines = part.split("\n");
 904 |           let eventType = "text";
 905 |           let dataLines: string[] = [];
 906 | 
 907 |           for (const line of lines) {
 908 |             if (line.startsWith("event: ")) {
 909 |               eventType = line.slice(7);
 910 |             } else if (line.startsWith("data: ")) {
 911 |               dataLines.push(line.slice(6));
 912 |             } else if (line.startsWith("data:")) {
 913 |               dataLines.push(line.slice(5));
 914 |             }
 915 |           }
 916 | 
 917 |           const dataContent = dataLines.join("\n");
 918 | 
 919 |           if (eventType === "text") {
 920 |             try {
 921 |               const textVal = JSON.parse(dataContent);
 922 |               assistantResponse += textVal;
 923 |               set((state) => ({
 924 |                 isThinking: false,
 925 |                 chatMessages: state.chatMessages.map(m =>
 926 |                   m.id === aiMsgId ? { ...m, text: assistantResponse } : m
 927 |                 )
 928 |               }));
 929 |             } catch (e) {
 930 |               console.error("Text SSE parse error", e);
 931 |             }
 932 |           } else if (eventType === "thinking") {
 933 |             try {
 934 |               const thoughtVal = JSON.parse(dataContent);
 935 |               thinkingSummary += thoughtVal;
 936 |               set((state) => ({
 937 |                 liveThoughts: thinkingSummary,
 938 |                 chatMessages: state.chatMessages.map(m =>
 939 |                   m.id === aiMsgId ? { ...m, thinkingSummary: thinkingSummary } : m
 940 |                 )
 941 |               }));
 942 |             } catch (e) {
 943 |               console.error("Thinking SSE parse error", e);
 944 |             }
 945 |           } else if (eventType === "status") {
 946 |             try {
 947 |               const statusVal = JSON.parse(dataContent);
 948 |               set({ statusMessage: typeof statusVal === "string" ? statusVal : "" });
 949 |             } catch (e) {
 950 |               console.error("Status SSE parse error", e);
 951 |             }
 952 |           } else if (eventType === "metadata") {
 953 |             try {
 954 |               const meta = JSON.parse(dataContent);
 955 |               set({
 956 |                 nodes: meta.nodes || [],
 957 |                 edges: meta.edges || [],
 958 |                 agentTalkLogs: meta.agent_talk || [],
 959 |                 followUpSuggestions: meta.follow_up_suggestions || []  // Bug 2: populate suggestions
 960 |               });
 961 |             } catch (e) {
 962 |               console.error("Metadata SSE parse error", e);
 963 |             }
 964 |           } else if (eventType === "tool_approval") {
 965 |             try {
 966 |               const approval = JSON.parse(dataContent);
 967 |               set({ pendingApproval: approval });
 968 |             } catch (e) {
 969 |               console.error("Tool approval SSE parse error", e);
 970 |             }
 971 |           }
 972 |         }
 973 |       }
 974 | 
 975 |       if (!assistantResponse) {
 976 |         const fallbackMsg = "I'm sorry, I couldn't generate a response. This might be due to a temporary issue with the AI service or an invalid API key. Please check your API key in Settings and try again.";
 977 |         set((state) => ({
 978 |           chatMessages: state.chatMessages.map(m =>
 979 |             m.id === aiMsgId ? { ...m, text: fallbackMsg } : m
 980 |           )
 981 |         }));
 982 |       }
 983 | 
 984 |       set({ abortController: null });
 985 |       get().saveCurrentSession();
 986 |     } catch (err: any) {
 987 |       if (err.name === 'AbortError') {
 988 |         console.log("Steer Orchestration manually aborted.");
 989 |         set((state) => ({
 990 |           chatMessages: state.chatMessages.map(m =>
 991 |             m.id === aiMsgId && !m.text ? { ...m, text: "*Generation stopped by user.*" } : m
 992 |           )
 993 |         }));
 994 |       } else {
 995 |         console.error("Steer Orchestration stream error:", err);
 996 |         const errorMsg = `**Connection Error.**\n\n${err.message || "Failed to parse stream event source. Check backend logs."}`;
 997 |         set((state) => ({
 998 |           chatMessages: state.chatMessages.map(m =>
 999 |             m.id === aiMsgId ? { ...m, text: errorMsg } : m
1000 |           ),
1001 |           nodes: [],
1002 |           edges: [],
1003 |           followUpSuggestions: []
1004 |         }));
1005 |       }
1006 |       set({ abortController: null, isThinking: false, isOrchestrating: false });
1007 |       get().saveCurrentSession();
1008 |     } finally {
1009 |       set({ isOrchestrating: false, isThinking: false, statusMessage: '', liveThoughts: '' });
1010 |       get().saveCurrentSession();
1011 |     }
1012 |   }
1013 | }));
1014 |
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

> 48 lines | 1.3 KB

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
