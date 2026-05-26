from typing import Dict, List, Any
import datetime

# In-memory message bus (for a single session; extend to DB for persistence)
session_messages: Dict[str, List[Dict[str, Any]]] = {}

def post_message(session_id: str, from_agent: str, to_agent: str, content: str, msg_type: str = "text"):
    """Store a message from one agent to another."""
    if session_id not in session_messages:
        session_messages[session_id] = []
    session_messages[session_id].append({
        "from": from_agent,
        "to": to_agent,
        "content": content,
        "type": msg_type,
        "timestamp": datetime.datetime.now().isoformat()
    })

def get_messages_for_agent(session_id: str, agent_id: str) -> List[Dict[str, Any]]:
    """Retrieve all messages addressed to this agent."""
    if session_id not in session_messages:
        return []
    return [m for m in session_messages[session_id] if m["to"] == agent_id]

def clear_messages(session_id: str, agent_id: str):
    """Clear messages after agent reads them."""
    if session_id in session_messages:
        session_messages[session_id] = [m for m in session_messages[session_id] if m["to"] != agent_id]
