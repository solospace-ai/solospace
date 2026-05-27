"""
Synthesizer: Final response aggregation from multi-agent results.
Streams the combined response back to the client via SSE.
"""
import json
import hashlib
import asyncio
import datetime
from typing import Dict, Any, List, Optional, AsyncGenerator

from providers import stream_provider
from tools.agent_tools import query_memory, store_memory
from storage.database import save_session, save_cached_response
from core.orchestrator import get_execution_levels, detect_cycle, validate_dependencies
from core.agent_executor import execute_single_agent
from core.planner import RESPONSE_SYSTEM_INSTRUCTION


def _now() -> str:
    return datetime.datetime.now().strftime("%I:%M:%S %p")


async def run_agent_execution_loop(
    session_id: str,
    prompt: str,
    history: list,
    api_key: str,
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
    complexity: str,
    capabilities: List[str],
    thinking_summary: str,
    follow_up_suggestions: List[str],
    provider: str = "gemini",
    model: Optional[str] = None,
    fallback_provider: Optional[str] = None,
    api_keys: Optional[Dict[str, str]] = None,
    base_url: Optional[str] = None,
    resume_from_checkpoint: bool = False,
) -> AsyncGenerator[str, None]:
    """
    Full multi-agent execution loop with parallel level execution and streaming.
    Yields SSE events.
    """
    agent_results: Dict[str, str] = {}
    setup_metadata = {
        "complexity": complexity,
        "capabilities": capabilities,
        "thinking_summary": thinking_summary,
        "nodes": nodes,
        "edges": edges,
        "agent_talk": [],
        "follow_up_suggestions": follow_up_suggestions,
    }

    # ── Validation ─────────────────────────────────────────────────────
    dep_errors = validate_dependencies(nodes)
    for err in dep_errors:
        yield f"event: text\ndata: {json.dumps('**Validation Error**: ' + err)}\n\n"
        yield "event: done\ndata: {}\n\n"
        return

    if detect_cycle(nodes, edges):
        yield f"event: text\ndata: {json.dumps('**Validation Error**: Circular dependency detected in agent workflow.')}\n\n"
        yield "event: done\ndata: {}\n\n"
        return

    # ── Save initial session ───────────────────────────────────────────
    await save_session(
        session_id=session_id,
        title=prompt[:40] + "..." if len(prompt) > 40 else prompt,
        prompt=prompt,
        mode=complexity,
        nodes=nodes,
        edges=edges,
        chat_messages=[],
        agent_talk_logs=[],
        execution_state="running",
        status_message="Running orchestration loop",
        follow_up_suggestions=follow_up_suggestions,
    )

    yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"

    # ── Parallel Level Execution ───────────────────────────────────────
    levels = get_execution_levels(nodes, edges)
    event_queue: asyncio.Queue = asyncio.Queue()

    for level_ids in levels:
        level_nodes = [
            n for n in nodes
            if n["id"] in level_ids and n.get("data", {}).get("enabled", True)
        ]
        if not level_nodes:
            continue

        tasks = [
            asyncio.create_task(
                execute_single_agent(
                    agent_node=agent_node,
                    session_id=session_id,
                    prompt=prompt,
                    api_key=api_key,
                    agent_results=agent_results,
                    nodes=nodes,
                    setup_metadata=setup_metadata,
                    complexity=complexity,
                    provider=provider,
                    model=model,
                    fallback_provider=fallback_provider,
                    api_keys=api_keys,
                    base_url=base_url,
                    resume_from_checkpoint=resume_from_checkpoint,
                    event_queue=event_queue,
                )
            )
            for agent_node in level_nodes
        ]

        while not all(t.done() for t in tasks) or not event_queue.empty():
            try:
                event = await asyncio.wait_for(event_queue.get(), timeout=0.05)
                event_type, event_data = event
                if event_type == "metadata":
                    yield f"event: metadata\ndata: {json.dumps(setup_metadata)}\n\n"
                elif event_type == "status":
                    yield f"event: status\ndata: {json.dumps(event_data)}\n\n"
                elif event_type == "thinking":
                    yield f"event: thinking\ndata: {json.dumps(event_data)}\n\n"
                elif event_type == "tool_approval":
                    yield f"event: tool_approval\ndata: {json.dumps(event_data)}\n\n"
                elif event_type == "text":
                    yield f"event: text\ndata: {json.dumps(event_data)}\n\n"
                event_queue.task_done()
            except asyncio.TimeoutError:
                continue

    if complexity == "simple" and not agent_results:
        agent_results["general"] = "Processed the request, but no specific output was generated."

    yield f"event: status\ndata: {json.dumps('Synthesizing final response...')}\n\n"

    # ── Build aggregator prompt ────────────────────────────────────────
    aggregator_prompt = ""
    try:
        memory_hits = await query_memory(
            prompt, api_key, top_k=3, agent_id=None,
            session_id=session_id, provider=provider
        )
        if memory_hits:
            aggregator_prompt += "### Relevant context from past conversation:\n"
            aggregator_prompt += "\n".join(f"- {m}" for m in memory_hits) + "\n\n"
    except Exception:
        pass

    if agent_results:
        aggregator_prompt += "### Analysis context:\n"
        for result in agent_results.values():
            aggregator_prompt += f"{result}\n\n"

    aggregator_prompt += f"\nUser's current message: {prompt}"

    if not aggregator_prompt.strip():
        aggregator_prompt = f"Answer the following user request concisely and helpfully:\n\n{prompt}"

    # Build conversation history for aggregator
    aggregator_history = []
    for msg in (history or []):
        sender = msg.sender if hasattr(msg, "sender") else msg.get("sender", "user")
        text = msg.text if hasattr(msg, "text") else msg.get("text", "")
        role = "user" if sender == "user" else "assistant"
        aggregator_history.append({"role": role, "content": text})

    from core.planner import summarize_history
    aggregator_history = await summarize_history(
        aggregator_history, provider, api_key, api_keys, base_url
    )

    aggregator_contents = []
    for msg in aggregator_history:
        role = "user" if msg["role"] == "user" else "model"
        aggregator_contents.append({"role": role, "content": msg["content"]})
    aggregator_contents.append({"role": "user", "content": aggregator_prompt})

    # ── Stream final synthesis ─────────────────────────────────────────
    final_synthesis_text = ""
    try:
        async for token in stream_provider(
            provider=provider,
            model=model,
            api_key=api_key,
            messages=aggregator_contents,
            system_prompt=RESPONSE_SYSTEM_INSTRUCTION,
            temperature=0.7,
            timeout=30.0,   # Reduced from 90s
            fallback_provider=fallback_provider,
            api_keys=api_keys,
            base_url=base_url,
        ):
            final_synthesis_text += token
            yield f"event: text\ndata: {json.dumps(token)}\n\n"
    except Exception as exc:
        exc_str = str(exc)
        if any(t in exc_str.lower() for t in ["not found", "does not exist", "model_not_found"]):
            err_msg = f"\n\n*Synthesis Error: Model '{model}' not found. Check Settings.*\n\n"
        else:
            err_msg = f"\n\n*Stream Synthesis Error: {exc_str}*\n\n"
        yield f"event: text\ndata: {json.dumps(err_msg)}\n\n"
        final_synthesis_text = err_msg

    # ── Persist session ────────────────────────────────────────────────
    final_chat_messages = []
    for msg in (history or []):
        sender = msg.sender if hasattr(msg, "sender") else msg.get("sender", "user")
        text = msg.text if hasattr(msg, "text") else msg.get("text", "")
        final_chat_messages.append({"id": f"msg-{id(msg)}", "sender": sender, "text": text, "timestamp": ""})
    final_chat_messages.append({"id": "user-prompt", "sender": "user", "text": prompt, "timestamp": _now()})
    final_chat_messages.append({"id": "ai-response", "sender": "ai", "text": final_synthesis_text, "timestamp": _now()})

    await save_session(
        session_id=session_id,
        title=prompt[:40] + "..." if len(prompt) > 40 else prompt,
        prompt=prompt,
        mode=complexity,
        nodes=nodes,
        edges=edges,
        chat_messages=final_chat_messages,
        agent_talk_logs=setup_metadata["agent_talk"],
        execution_state="setup",
        status_message="Execution completed",
        follow_up_suggestions=follow_up_suggestions,
    )

    # Cache result (exact hash, no embedding)
    try:
        prompt_hash = hashlib.sha256(prompt.encode("utf-8")).hexdigest()
        cached_val = {
            "metadata": {
                "complexity": complexity,
                "capabilities": capabilities,
                "thinking_summary": thinking_summary,
                "nodes": nodes,
                "edges": edges,
                "agent_talk": setup_metadata["agent_talk"],
                "follow_up_suggestions": follow_up_suggestions,
            },
            "text": final_synthesis_text,
        }
        await save_cached_response(prompt_hash, prompt, [], cached_val)
    except Exception:
        pass

    # Lazy memory store for cross-turn recall
    if final_synthesis_text:
        convo_memory = f"User: {prompt}\nAssistant: {final_synthesis_text[:800]}"
        asyncio.create_task(
            store_memory(f"session_{session_id}", convo_memory, api_key, session_id, provider=provider)
        )

    yield "event: done\ndata: {}\n\n"
