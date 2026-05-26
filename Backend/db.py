import sqlite3
import json
import datetime
from typing import Dict, Any, List, Optional

DB_FILE = "solospace.db"

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Session Persistence Table
    cursor.execute("""
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
    
    # State Checkpointing Table (for cycle/pause graph execution)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS checkpoints (
            session_id TEXT,
            node_id TEXT,
            state_data TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (session_id, node_id)
        )
    """)
    
    # Tool approvals table
    cursor.execute("""
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
    
    # Semantic cache table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS semantic_cache (
            prompt_hash TEXT PRIMARY KEY,
            prompt TEXT,
            embedding TEXT,
            response TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Rate limits table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS rate_limits (
            user_id TEXT PRIMARY KEY,
            tokens_remaining REAL,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.commit()
    conn.close()

# Session CRUD operations
def save_session(
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
    follow_up_suggestions: List[str]
):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO sessions (
            session_id, title, prompt, mode, nodes, edges, chat_messages, 
            agent_talk_logs, execution_state, status_message, follow_up_suggestions, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(session_id) DO UPDATE SET
            title=excluded.title,
            prompt=excluded.prompt,
            mode=excluded.mode,
            nodes=excluded.nodes,
            edges=excluded.edges,
            chat_messages=excluded.chat_messages,
            agent_talk_logs=excluded.agent_talk_logs,
            execution_state=excluded.execution_state,
            status_message=excluded.status_message,
            follow_up_suggestions=excluded.follow_up_suggestions,
            updated_at=CURRENT_TIMESTAMP
        """,
        (
            session_id,
            title,
            prompt,
            mode,
            json.dumps(nodes),
            json.dumps(edges),
            json.dumps(chat_messages),
            json.dumps(agent_talk_logs),
            execution_state,
            status_message,
            json.dumps(follow_up_suggestions)
        )
    )
    conn.commit()
    conn.close()

def load_sessions() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT session_id, title, prompt, mode, execution_state, status_message, updated_at FROM sessions ORDER BY updated_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def load_session(session_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    res = dict(row)
    # Parse JSON fields
    res["nodes"] = json.loads(res["nodes"]) if res["nodes"] else []
    res["edges"] = json.loads(res["edges"]) if res["edges"] else []
    res["chat_messages"] = json.loads(res["chat_messages"]) if res["chat_messages"] else []
    res["agent_talk_logs"] = json.loads(res["agent_talk_logs"]) if res["agent_talk_logs"] else []
    res["follow_up_suggestions"] = json.loads(res["follow_up_suggestions"]) if res["follow_up_suggestions"] else []
    return res

def delete_session(session_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
    cursor.execute("DELETE FROM checkpoints WHERE session_id = ?", (session_id,))
    cursor.execute("DELETE FROM tool_approvals WHERE session_id = ?", (session_id,))
    conn.commit()
    conn.close()

# State Checkpoint operations
def save_checkpoint(session_id: str, node_id: str, state_data: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO checkpoints (session_id, node_id, state_data, timestamp)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(session_id, node_id) DO UPDATE SET
            state_data=excluded.state_data,
            timestamp=CURRENT_TIMESTAMP
        """,
        (session_id, node_id, json.dumps(state_data))
    )
    conn.commit()
    conn.close()

def load_checkpoint(session_id: str, node_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT state_data FROM checkpoints WHERE session_id = ? AND node_id = ?", (session_id, node_id))
    row = cursor.fetchone()
    conn.close()
    if row:
        return json.loads(row["state_data"])
    return None

# Tool Approval operations
def create_tool_approval(session_id: str, node_id: str, tool_name: str, action_input: str, log_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO tool_approvals (session_id, node_id, tool_name, action_input, log_id, status, updated_at)
        VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
        ON CONFLICT(session_id, node_id, tool_name, log_id) DO UPDATE SET
            action_input=excluded.action_input,
            status='pending',
            updated_at=CURRENT_TIMESTAMP
        """,
        (session_id, node_id, tool_name, action_input, log_id)
    )
    conn.commit()
    conn.close()

def update_tool_approval(session_id: str, node_id: str, tool_name: str, log_id: str, status: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE tool_approvals SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND node_id = ? AND tool_name = ? AND log_id = ?",
        (status, session_id, node_id, tool_name, log_id)
    )
    conn.commit()
    conn.close()

def get_tool_approval(session_id: str, node_id: str, tool_name: str, log_id: str) -> Optional[str]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT status FROM tool_approvals WHERE session_id = ? AND node_id = ? AND tool_name = ? AND log_id = ?",
        (session_id, node_id, tool_name, log_id)
    )
    row = cursor.fetchone()
    conn.close()
    return row["status"] if row else None

# Semantic Cache operations
def get_cached_response(prompt_hash: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT response FROM semantic_cache WHERE prompt_hash = ?", (prompt_hash,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return json.loads(row["response"])
    return None

def save_cached_response(prompt_hash: str, prompt: str, embedding: List[float], response: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO semantic_cache (prompt_hash, prompt, embedding, response, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(prompt_hash) DO UPDATE SET
            response=excluded.response,
            created_at=CURRENT_TIMESTAMP
        """,
        (prompt_hash, prompt, json.dumps(embedding), json.dumps(response))
    )
    conn.commit()
    conn.close()

def load_all_cached_embeddings() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT prompt_hash, prompt, embedding, response FROM semantic_cache")
    rows = cursor.fetchall()
    conn.close()
    res = []
    for row in rows:
        res.append({
            "prompt_hash": row["prompt_hash"],
            "prompt": row["prompt"],
            "embedding": json.loads(row["embedding"]),
            "response": json.loads(row["response"])
        })
    return res

# Rate Limits operations
def get_rate_limit(user_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT tokens_remaining, last_updated FROM rate_limits WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"tokens_remaining": row["tokens_remaining"], "last_updated": row["last_updated"]}
    return None

def update_rate_limit(user_id: str, tokens_remaining: float):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO rate_limits (user_id, tokens_remaining, last_updated)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            tokens_remaining=excluded.tokens_remaining,
            last_updated=CURRENT_TIMESTAMP
        """,
        (user_id, tokens_remaining)
    )
    conn.commit()
    conn.close()
