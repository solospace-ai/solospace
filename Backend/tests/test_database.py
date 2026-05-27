import os
import pytest
import asyncio
from storage import database

# Mock the database file to a test database file
database.DB_FILE = "test_solospace.db"

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    # Setup test database
    asyncio.run(database.init_db())
    yield
    # Cleanup test database file
    if os.path.exists("test_solospace.db"):
        try:
            os.remove("test_solospace.db")
        except OSError:
            pass

@pytest.mark.asyncio
async def test_session_save_load_delete():
    session_id = "test-session-123"
    title = "Test Session Title"
    prompt = "This is a test session prompt"
    mode = "auto"
    nodes = [{"id": "node-1", "type": "custom", "data": {"name": "Agent 1"}}]
    edges = [{"id": "edge-1", "source": "node-1", "target": "node-2"}]
    chat_messages = [{"id": "msg-1", "role": "user", "text": "hello"}]
    agent_talk_logs = []
    execution_state = "setup"
    status_message = "Ready"
    follow_up_suggestions = ["What is Next?", "Tell me more"]

    # 1. Save session
    await database.save_session(
        session_id=session_id,
        title=title,
        prompt=prompt,
        mode=mode,
        nodes=nodes,
        edges=edges,
        chat_messages=chat_messages,
        agent_talk_logs=agent_talk_logs,
        execution_state=execution_state,
        status_message=status_message,
        follow_up_suggestions=follow_up_suggestions,
    )

    # 2. Load and verify
    session = await database.load_session(session_id)
    assert session is not None
    assert session["session_id"] == session_id
    assert session["title"] == title
    assert session["prompt"] == prompt
    assert session["mode"] == mode
    assert len(session["nodes"]) == 1
    assert session["nodes"][0]["id"] == "node-1"
    assert len(session["edges"]) == 1
    assert session["edges"][0]["id"] == "edge-1"
    assert len(session["chat_messages"]) == 1
    assert session["chat_messages"][0]["text"] == "hello"
    assert session["execution_state"] == execution_state
    assert session["status_message"] == status_message
    assert len(session["follow_up_suggestions"]) == 2

    # 3. Load all sessions and verify
    sessions = await database.load_sessions()
    assert len(sessions) >= 1
    assert any(s["session_id"] == session_id for s in sessions)

    # 4. Delete session
    await database.delete_session(session_id)
    session_after_delete = await database.load_session(session_id)
    assert session_after_delete is None

@pytest.mark.asyncio
async def test_checkpoint_save_load():
    session_id = "test-session-checkpoint"
    node_id = "agent-node-1"
    state_data = {"key": "value", "objective": "research", "status": "active"}

    # Save checkpoint
    await database.save_checkpoint(session_id, node_id, state_data)

    # Load and verify
    loaded = await database.load_checkpoint(session_id, node_id)
    assert loaded is not None
    assert loaded["key"] == "value"
    assert loaded["objective"] == "research"
    assert loaded["status"] == "active"
