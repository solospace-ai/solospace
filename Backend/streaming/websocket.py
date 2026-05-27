from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json
from storage.database import load_session, update_tool_approval, update_tool_approval_wildcard

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        # Maps session_id -> set of active WebSockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections.setdefault(session_id, set()).add(websocket)
        
        # On reconnect, synchronize state back to client
        try:
            session_data = await load_session(session_id)
            if session_data:
                state_sync = {
                    "event": "state_sync",
                    "data": {
                        "sessionId": session_id,
                        "title": session_data.get("title", ""),
                        "prompt": session_data.get("prompt", ""),
                        "mode": session_data.get("mode", "auto"),
                        "nodes": json.loads(session_data.get("nodes") or "[]"),
                        "edges": json.loads(session_data.get("edges") or "[]"),
                        "chatMessages": json.loads(session_data.get("chat_messages") or "[]"),
                        "agentTalkLogs": json.loads(session_data.get("agent_talk_logs") or "[]"),
                        "executionState": session_data.get("execution_state", "setup"),
                        "statusMessage": session_data.get("status_message", ""),
                        "followUpSuggestions": json.loads(session_data.get("follow_up_suggestions") or "[]"),
                    }
                }
                await websocket.send_json(state_sync)
        except Exception as e:
            print(f"[WS ERROR] Failed to send state sync on connect: {e}")

    def disconnect(self, websocket: WebSocket, session_id: str):
        if session_id in self.active_connections:
            self.active_connections[session_id].discard(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def broadcast_to_session(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()

@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    try:
        while True:
            # Receive messages from the client
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                msg_type = message.get("type")
                
                if msg_type == "tool_approval_response":
                    node_id = message.get("nodeId")
                    tool_name = message.get("toolName")
                    action = message.get("action")  # "approve" or "deny"
                    log_id = message.get("logId")
                    status = "approved" if action == "approve" else "denied"
                    
                    if log_id:
                        await update_tool_approval(session_id, node_id, tool_name, log_id, status)
                    else:
                        await update_tool_approval_wildcard(session_id, node_id, tool_name, status)
                    
                    # Echo response back to ensure client gets confirmation
                    await manager.broadcast_to_session(session_id, {
                        "event": "tool_approval_sync",
                        "data": {
                            "nodeId": node_id,
                            "toolName": tool_name,
                            "action": action,
                            "logId": log_id,
                            "status": status
                        }
                    })
            except Exception as e:
                print(f"[WS ERROR] Failed to process socket message: {e}")
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id)
