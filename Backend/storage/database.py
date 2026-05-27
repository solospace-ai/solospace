"""
Async SQLite database layer using aiosqlite.
Replaces blocking sqlite3 calls that were stalling the FastAPI event loop.
"""
import aiosqlite
import json
import datetime
from contextlib import asynccontextmanager
from typing import Dict, Any, List, Optional

DB_FILE = "solospace.db"


@asynccontextmanager
async def get_db():
    """Async context manager for database connections."""
    async with aiosqlite.connect(DB_FILE) as db:
        db.row_factory = aiosqlite.Row
        yield db


async def init_db():
    """Initialize all database tables."""
    async with get_db() as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                title TEXT,
                prompt TEXT,
                mode TEXT,
                nodes TEXT,
                edges TEXT,
                chat_messages TEXT,
                agent_talk_logs TEXT,
                execution_state TEXT,
                status_message TEXT,
                follow_up_suggestions TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS checkpoints (
                session_id TEXT,
                node_id TEXT,
                state_data TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (session_id, node_id)
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS tool_approvals (
                session_id TEXT,
                node_id TEXT,
                tool_name TEXT,
                action_input TEXT,
                status TEXT DEFAULT 'pending',
                log_id TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (session_id, node_id, tool_name, log_id)
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS semantic_cache (
                prompt_hash TEXT PRIMARY KEY,
                prompt TEXT,
                embedding TEXT,
                response TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS rate_limits (
                user_id TEXT PRIMARY KEY,
                tokens_remaining REAL,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.commit()


# ─── Session CRUD ────────────────────────────────────────────────────

async def save_session(
    session_id: str,
    title: str,
    prompt: str,
    mode: str,
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
    chat_messages: List[Dict[str, Any]],
    agent_talk_logs: List[Dict[str, Any]],
    execution_state: str,
    status_message: str,
    follow_up_suggestions: List[str],
):
    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO sessions (
                session_id, title, prompt, mode, nodes, edges, chat_messages,
                agent_talk_logs, execution_state, status_message, follow_up_suggestions, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(session_id) DO UPDATE SET
                title=excluded.title, prompt=excluded.prompt, mode=excluded.mode,
                nodes=excluded.nodes, edges=excluded.edges,
                chat_messages=excluded.chat_messages, agent_talk_logs=excluded.agent_talk_logs,
                execution_state=excluded.execution_state, status_message=excluded.status_message,
                follow_up_suggestions=excluded.follow_up_suggestions,
                updated_at=CURRENT_TIMESTAMP
            """,
            (
                session_id, title, prompt, mode,
                json.dumps(nodes), json.dumps(edges),
                json.dumps(chat_messages), json.dumps(agent_talk_logs),
                execution_state, status_message, json.dumps(follow_up_suggestions),
            ),
        )
        await db.commit()


async def load_sessions() -> List[Dict[str, Any]]:
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT session_id, title, prompt, mode, execution_state, status_message, updated_at "
            "FROM sessions ORDER BY updated_at DESC"
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def load_session(session_id: str) -> Optional[Dict[str, Any]]:
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
        )
        row = await cursor.fetchone()
        if not row:
            return None
        res = dict(row)
        res["nodes"] = json.loads(res["nodes"]) if res["nodes"] else []
        res["edges"] = json.loads(res["edges"]) if res["edges"] else []
        res["chat_messages"] = json.loads(res["chat_messages"]) if res["chat_messages"] else []
        res["agent_talk_logs"] = json.loads(res["agent_talk_logs"]) if res["agent_talk_logs"] else []
        res["follow_up_suggestions"] = json.loads(res["follow_up_suggestions"]) if res["follow_up_suggestions"] else []
        return res


async def delete_session(session_id: str):
    async with get_db() as db:
        await db.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
        await db.execute("DELETE FROM checkpoints WHERE session_id = ?", (session_id,))
        await db.execute("DELETE FROM tool_approvals WHERE session_id = ?", (session_id,))
        await db.commit()


# ─── Checkpoint CRUD ─────────────────────────────────────────────────

async def save_checkpoint(session_id: str, node_id: str, state_data: Dict[str, Any]):
    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO checkpoints (session_id, node_id, state_data, timestamp)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(session_id, node_id) DO UPDATE SET
                state_data=excluded.state_data, timestamp=CURRENT_TIMESTAMP
            """,
            (session_id, node_id, json.dumps(state_data)),
        )
        await db.commit()


async def load_checkpoint(session_id: str, node_id: str) -> Optional[Dict[str, Any]]:
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT state_data FROM checkpoints WHERE session_id = ? AND node_id = ?",
            (session_id, node_id),
        )
        row = await cursor.fetchone()
        return json.loads(row["state_data"]) if row else None


# ─── Tool Approval CRUD ───────────────────────────────────────────────

async def create_tool_approval(
    session_id: str, node_id: str, tool_name: str, action_input: str, log_id: str
):
    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO tool_approvals (session_id, node_id, tool_name, action_input, log_id, status, updated_at)
            VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
            ON CONFLICT(session_id, node_id, tool_name, log_id) DO UPDATE SET
                action_input=excluded.action_input, status='pending', updated_at=CURRENT_TIMESTAMP
            """,
            (session_id, node_id, tool_name, action_input, log_id),
        )
        await db.commit()


async def update_tool_approval(
    session_id: str, node_id: str, tool_name: str, log_id: str, status: str
):
    async with get_db() as db:
        await db.execute(
            "UPDATE tool_approvals SET status = ?, updated_at = CURRENT_TIMESTAMP "
            "WHERE session_id = ? AND node_id = ? AND tool_name = ? AND log_id = ?",
            (status, session_id, node_id, tool_name, log_id),
        )
        await db.commit()


async def update_tool_approval_wildcard(
    session_id: str, node_id: str, tool_name: str, status: str
):
    """Update all pending approvals for a node/tool (wildcard log_id)."""
    async with get_db() as db:
        await db.execute(
            "UPDATE tool_approvals SET status = ?, updated_at = CURRENT_TIMESTAMP "
            "WHERE session_id = ? AND node_id = ? AND tool_name = ? AND status = 'pending'",
            (status, session_id, node_id, tool_name),
        )
        await db.commit()


async def get_tool_approval(
    session_id: str, node_id: str, tool_name: str, log_id: str
) -> Optional[str]:
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT status FROM tool_approvals WHERE session_id = ? AND node_id = ? "
            "AND tool_name = ? AND log_id = ?",
            (session_id, node_id, tool_name, log_id),
        )
        row = await cursor.fetchone()
        return row["status"] if row else None


# ─── Semantic Cache ───────────────────────────────────────────────────

async def get_cached_response(prompt_hash: str) -> Optional[Dict[str, Any]]:
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT response FROM semantic_cache WHERE prompt_hash = ?", (prompt_hash,)
        )
        row = await cursor.fetchone()
        return json.loads(row["response"]) if row else None


async def save_cached_response(
    prompt_hash: str, prompt: str, embedding: List[float], response: Dict[str, Any]
):
    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO semantic_cache (prompt_hash, prompt, embedding, response, created_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(prompt_hash) DO UPDATE SET
                response=excluded.response, created_at=CURRENT_TIMESTAMP
            """,
            (prompt_hash, prompt, json.dumps(embedding), json.dumps(response)),
        )
        await db.commit()


# ─── Rate Limits ──────────────────────────────────────────────────────

async def get_rate_limit(user_id: str) -> Optional[Dict[str, Any]]:
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT tokens_remaining, last_updated FROM rate_limits WHERE user_id = ?",
            (user_id,),
        )
        row = await cursor.fetchone()
        return dict(row) if row else None


async def update_rate_limit(user_id: str, tokens_remaining: float):
    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO rate_limits (user_id, tokens_remaining, last_updated)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                tokens_remaining=excluded.tokens_remaining, last_updated=CURRENT_TIMESTAMP
            """,
            (user_id, tokens_remaining),
        )
        await db.commit()
