"""
Single agent ReAct execution loop.
Each agent runs autonomously: thought → action → observation → repeat → final_answer.
Pushes SSE events to an asyncio.Queue for streaming to the client.
"""
import json
import asyncio
import datetime
from typing import Dict, Any, List, Optional

from providers import call_provider_json
from tools.agent_tools import (
    execute_web_search,
    execute_web_browse,
    execute_python_code,
    execute_api_call,
    store_memory,
    query_memory,
)
from storage.database import (
    load_checkpoint,
    save_checkpoint,
    create_tool_approval,
    get_tool_approval,
    update_tool_approval,
)
from agent_messages import post_message, get_messages_for_agent, clear_messages
from core.planner import AGENT_TURN_SCHEMA


def _now() -> str:
    return datetime.datetime.now().strftime("%I:%M:%S %p")


def _convert_history_to_standard(history: list) -> List[Dict[str, str]]:
    res = []
    for msg in history:
        parts = msg.get("parts", [])
        text = parts[0].get("text", "") if parts else ""
        role = "assistant" if msg.get("role") in ["model", "assistant"] else "user"
        res.append({"role": role, "content": text})
    return res


async def execute_single_agent(
    agent_node: Dict[str, Any],
    session_id: str,
    prompt: str,
    api_key: str,
    agent_results: Dict[str, str],
    nodes: List[Dict[str, Any]],
    setup_metadata: Dict[str, Any],
    complexity: str,
    provider: str,
    model: Optional[str],
    fallback_provider: Optional[str],
    api_keys: Optional[Dict[str, str]],
    base_url: Optional[str],
    resume_from_checkpoint: bool,
    event_queue: asyncio.Queue,
) -> Dict[str, Any]:
    """
    Execute one agent's ReAct loop. Pushes SSE events to event_queue.
    Returns dict with node_id, final_answer, status, toolLogs.
    """
    node_id = agent_node["id"]
    agent_data = agent_node["data"]
    agent_name = agent_data["name"]

    if not agent_data.get("enabled", True):
        return {"node_id": node_id, "final_answer": "", "status": "SKIPPED", "toolLogs": []}

    try:
        # ── Checkpoint Resume ──────────────────────────────────────────
        if resume_from_checkpoint:
            checkpoint_state = await load_checkpoint(session_id, node_id)
            if checkpoint_state:
                agent_results[node_id] = checkpoint_state.get("final_answer", "Completed.")
                setup_metadata["agent_talk"].append({
                    "id": f"agent-log-{node_id}-{_now()}",
                    "senderId": node_id,
                    "senderName": agent_name,
                    "senderIcon": agent_data.get("icon", "bot"),
                    "text": checkpoint_state.get("final_answer", "Completed.")[:180],
                    "timestamp": _now(),
                })
                await event_queue.put(("metadata", None))
                return {
                    "node_id": node_id,
                    "final_answer": checkpoint_state.get("final_answer", "Completed."),
                    "status": "IDLE",
                    "toolLogs": [],
                }

        # ── Mark ACTIVE ────────────────────────────────────────────────
        for n in nodes:
            if n["id"] == node_id:
                n["data"]["status"] = "ACTIVE"
        await event_queue.put(("metadata", None))
        await event_queue.put(("status", f"[{agent_name}] processing..."))
        await asyncio.sleep(0.2)

        # ── Build context ──────────────────────────────────────────────
        dep_outputs = ""
        for dep_id in agent_data.get("dependencies", []):
            if dep_id in agent_results:
                dep_outputs += f"### Input from {dep_id.upper()}:\n{agent_results[dep_id]}\n"

        incoming_msgs = get_messages_for_agent(session_id, node_id)
        msg_block = ""
        if incoming_msgs:
            msg_block = "### Messages from other agents:\n"
            for msg in incoming_msgs:
                msg_block += f"- From {msg['from']}: {msg['content']}\n"
            clear_messages(session_id, node_id)

        resolved_tools_str = ", ".join(agent_data.get("tools", []))
        tools_instruction = (
            f"Available tools: {resolved_tools_str}. "
            "To use a tool, specify the tool name in 'action' and input in 'action_input'. "
            "If you have enough information, set 'action' to 'none' and provide 'final_answer'."
        )

        agent_history = [{
            "role": "user",
            "parts": [{
                "text": (
                    f"{tools_instruction}\n\n"
                    f"User Request: {prompt}\n\n"
                    f"{dep_outputs}\n{msg_block}\n\n"
                    f"Your specific objective: {agent_data['objective']}\n"
                    f"Rules: {agent_data['rules']}"
                )
            }],
        }]

        agent_final_answer = "Sub-task completed."
        action_execution_history = []
        max_turns = 2 if complexity != "simple" else 1

        for _turn in range(max_turns):
            turn_data = {}
            action = "none"
            try:
                standard_history = _convert_history_to_standard(agent_history)
                turn_data = await call_provider_json(
                    provider=provider,
                    model=model,
                    api_key=api_key,
                    messages=standard_history,
                    system_prompt=agent_data["systemPrompt"],
                    temperature=0.2,
                    json_schema=AGENT_TURN_SCHEMA,
                    timeout=12.0,
                    fallback_provider=fallback_provider,
                    api_keys=api_keys,
                    base_url=base_url,
                )
                thought = turn_data.get("thought", "")
                action = turn_data.get("action", "none")
                action_input = turn_data.get("action_input", "")
                agent_final_answer = turn_data.get("final_answer", "")

                if thought:
                    await event_queue.put(("thinking", f"[{agent_name}]: {thought}\n"))
            except Exception as e:
                print(f"[AGENT] ReAct turn failed for {agent_name}: {e}")
                break

            if action == "none" or agent_final_answer:
                break

            # ── Circuit Breaker ────────────────────────────────────────
            action_execution_history.append((action, action_input))
            if action_execution_history.count((action, action_input)) >= 3:
                observation = "Circuit Breaker: Tool executed repeatedly with identical input. Halting."
                await event_queue.put(("status", f"[{agent_name}] circuit breaker halted"))
                agent_history.append({"role": "model", "parts": [{"text": json.dumps(turn_data)}]})
                agent_history.append({"role": "user", "parts": [{"text": f"Observation: {observation}"}]})
                continue

            t_log_id = f"t-log-{int(datetime.datetime.now().timestamp() * 1000)}"
            t_timestamp = _now()
            permission = agent_data.get("toolPermissions", {}).get(action, "ALLOWED")

            # ── Tool Approval ──────────────────────────────────────────
            if permission == "ASK":
                new_log = {
                    "id": t_log_id, "timestamp": t_timestamp, "tool": action,
                    "action": "Execution Request", "status": "PENDING",
                    "detail": f"Waiting for approval: '{action_input[:50]}...'"
                }
                for n in nodes:
                    if n["id"] == node_id:
                        n["data"]["toolLogs"] = [new_log] + n["data"].get("toolLogs", [])
                await event_queue.put(("metadata", None))

                await create_tool_approval(session_id, node_id, action, action_input, t_log_id)
                await event_queue.put(("tool_approval", {
                    "sessionId": session_id, "nodeId": node_id, "toolName": action,
                    "action": "Execution Approval Required",
                    "detail": action_input[:100], "logId": t_log_id,
                }))
                await event_queue.put(("status", f"[{agent_name}] waiting for approval [{action}]"))

                approval_start = datetime.datetime.now().timestamp()
                while True:
                    approval_status = await get_tool_approval(session_id, node_id, action, t_log_id)
                    if approval_status in ("approved", "denied"):
                        permission = "ALLOWED" if approval_status == "approved" else "DENIED"
                        break
                    if datetime.datetime.now().timestamp() - approval_start > 120:
                        permission = "DENIED"
                        await update_tool_approval(session_id, node_id, action, t_log_id, "denied")
                        await event_queue.put(("status", f"[{agent_name}] approval timed out, auto-denied"))
                        break
                    await asyncio.sleep(0.5)

                status_str = "SUCCESS" if permission == "ALLOWED" else "BLOCKED"
                detail_str = f"Approved: {action_input[:50]}" if permission == "ALLOWED" else "Blocked by user."
                for n in nodes:
                    if n["id"] == node_id:
                        n["data"]["toolLogs"] = [{**new_log, "status": status_str, "detail": detail_str}] + n["data"].get("toolLogs", [])[1:]
                await event_queue.put(("metadata", None))

            # ── Tool Execution ─────────────────────────────────────────
            observation = "Execution Blocked: Permission Denied."
            if permission == "ALLOWED":
                await event_queue.put(("status", f"[{agent_name}] executing [{action}]"))

                if action == "web_search":
                    observation = await execute_web_search(action_input)
                elif action == "browse_web":
                    observation = await execute_web_browse(action_input)
                elif action == "execute_code":
                    observation = await execute_python_code(action_input)
                elif action == "api_call":
                    # Format: "METHOD|URL" or just "URL"
                    parts = action_input.split("|", 2)
                    if len(parts) == 3:
                        observation = await execute_api_call(parts[1], parts[0], parts[2])
                    elif len(parts) == 2:
                        observation = await execute_api_call(parts[1], parts[0])
                    else:
                        observation = await execute_api_call(action_input)
                elif action == "query_memory":
                    mem_res = await query_memory(action_input, api_key, session_id=session_id, provider=provider)
                    observation = "\n".join(mem_res) if mem_res else "No matches found."
                elif action == "store_memory":
                    asyncio.create_task(store_memory(node_id, action_input, api_key, session_id, provider=provider))
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
                    observation = f"{action} is not yet available."

                # Log success
                success_log = {
                    "id": t_log_id, "timestamp": _now(), "tool": action,
                    "action": "Call", "status": "SUCCESS",
                    "detail": f"Input: '{action_input[:50]}' → {observation[:100]}...",
                }
                for n in nodes:
                    if n["id"] == node_id:
                        logs = [l for l in n["data"].get("toolLogs", []) if l["id"] != t_log_id]
                        n["data"]["toolLogs"] = [success_log] + logs

            await event_queue.put(("metadata", None))
            agent_history.append({"role": "model", "parts": [{"text": json.dumps(turn_data)}]})
            agent_history.append({"role": "user", "parts": [{"text": f"Observation: {observation}"}]})

        # ── Fallback Synthesis ─────────────────────────────────────────
        if not agent_final_answer or agent_final_answer.strip() in ("Sub-task completed.", "", " "):
            try:
                from providers import call_provider
                synth_text = await call_provider(
                    provider=provider, model=model, api_key=api_key,
                    messages=[{"role": "user", "content": f"Objective: {agent_data['objective']}\n\nWrite a concise result summary in 2-3 sentences."}],
                    system_prompt=agent_data["systemPrompt"],
                    temperature=0.3, timeout=10.0,
                    fallback_provider=fallback_provider, api_keys=api_keys, base_url=base_url,
                )
                if synth_text:
                    agent_final_answer = synth_text
            except Exception:
                pass

        agent_results[node_id] = agent_final_answer or "Sub-task completed."

        # Save checkpoint
        await save_checkpoint(session_id, node_id, {"final_answer": agent_final_answer})

        # Mark IDLE
        for n in nodes:
            if n["id"] == node_id:
                n["data"]["status"] = "IDLE"

        setup_metadata["agent_talk"].append({
            "id": f"agent-log-{node_id}-{_now()}",
            "senderId": node_id,
            "senderName": agent_name,
            "senderIcon": agent_data.get("icon", "bot"),
            "text": (agent_final_answer[:180] + "..." if len(agent_final_answer) > 180 else agent_final_answer),
            "timestamp": _now(),
        })
        await event_queue.put(("metadata", None))

        # Lazy memory store
        if agent_final_answer and len(agent_final_answer) > 40 and agent_final_answer != "Sub-task completed.":
            memory_text = f"Objective: {agent_data['objective']}\nOutcome: {agent_final_answer[:500]}"
            asyncio.create_task(store_memory(node_id, memory_text, api_key, session_id, provider=provider))

        return {"node_id": node_id, "final_answer": agent_results[node_id], "status": "IDLE", "toolLogs": []}

    except Exception as e:
        print(f"[AGENT ERROR] {agent_name} failed: {e}")
        error_str = str(e)
        if any(t in error_str.lower() for t in ["not found", "does not exist", "model_not_found"]):
            error_str = f"Model '{model}' not found. Check your model ID in Settings."
        agent_results[node_id] = f"Agent encountered an error: {error_str[:200]}"
        for n in nodes:
            if n["id"] == node_id:
                n["data"]["status"] = "ERROR"
        setup_metadata["agent_talk"].append({
            "id": f"agent-log-{node_id}-error-{_now()}",
            "senderId": node_id,
            "senderName": agent_name,
            "senderIcon": agent_data.get("icon", "bot"),
            "text": f"⚠ Failed: {error_str[:150]}",
            "timestamp": _now(),
        })
        await event_queue.put(("metadata", None))
        return {"node_id": node_id, "final_answer": agent_results[node_id], "status": "ERROR", "toolLogs": []}
