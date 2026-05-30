import json
import httpx
from typing import List, Dict, Any, AsyncGenerator

def _build_claude_messages(
    messages: List[Dict[str, str]],
    system_prompt: str,
) -> Dict[str, Any]:
    """Convert internal message format to Claude format."""
    claude_msgs = []
    for msg in messages:
        role = "assistant" if msg.get("role") in ["model", "assistant"] else "user"
        claude_msgs.append({
            "role": role,
            "content": msg.get("content", ""),
        })
    return {
        "system": system_prompt,
        "messages": claude_msgs,
    }


# ─── Claude Adapter ──────────────────────────────────────────────────

async def _call_claude(
    config: Dict[str, Any],
    model: str,
    api_key: str,
    messages: List[Dict[str, str]],
    system_prompt: str,
    temperature: float = 0.7,
    json_mode: bool = False,
    json_schema_hint: str = None,
    timeout: float = 30.0,
) -> str:
    """Non-streaming call to Claude API."""
    base_url = config["base_url"].rstrip("/")
    url = f"{base_url}/messages"

    claude_data = _build_claude_messages(messages, system_prompt)

    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
    }

    payload: Dict[str, Any] = {
        "model": model,
        "max_tokens": 8192,
        "temperature": temperature,
        **claude_data,
    }

    if json_mode:
        json_instruction = "IMPORTANT: You MUST respond ONLY with a single valid JSON object. No markdown, no explanation, no code fences. Just raw JSON."
        if json_schema_hint:
            json_instruction += f"\n\nThe JSON should match this structure:\n{json_schema_hint}"
        payload["system"] = f"{json_instruction}\n\n{claude_data.get('system', '')}"

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, headers=headers, timeout=timeout)
        if resp.status_code != 200:
            raise Exception(f"Claude error ({resp.status_code}): {resp.text[:500]}")
        data = resp.json()
        text_parts = []
        for block in data.get("content", []):
            if block.get("type") == "text":
                text_parts.append(block["text"])
        return "\n".join(text_parts)


async def _stream_claude(
    config: Dict[str, Any],
    model: str,
    api_key: str,
    messages: List[Dict[str, str]],
    system_prompt: str,
    temperature: float = 0.7,
    timeout: float = 90.0,
) -> AsyncGenerator[str, None]:
    """Streaming call to Claude API. Yields text chunks."""
    base_url = config["base_url"].rstrip("/")
    url = f"{base_url}/messages"

    claude_data = _build_claude_messages(messages, system_prompt)

    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
    }

    payload: Dict[str, Any] = {
        "model": model,
        "max_tokens": 8192,
        "temperature": temperature,
        "stream": True,
        **claude_data,
    }

    async with httpx.AsyncClient() as client:
        async with client.stream("POST", url, json=payload, headers=headers, timeout=timeout) as resp:
            if resp.status_code != 200:
                err_body = await resp.aread()
                raise Exception(f"Claude stream error ({resp.status_code}): {err_body.decode()[:500]}")
            async for line in resp.aiter_lines():
                line = line.strip()
                if not line or not line.startswith("data:"):
                    continue
                data_str = line[5:].strip()
                if not data_str:
                    continue
                try:
                    obj = json.loads(data_str)
                    event_type = obj.get("type", "")
                    if event_type == "content_block_delta":
                        delta = obj.get("delta", {})
                        if delta.get("type") == "text_delta":
                            text = delta.get("text", "")
                            if text:
                                yield text
                except (json.JSONDecodeError, KeyError):
                    continue
