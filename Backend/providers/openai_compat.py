import os
import json
import httpx
from typing import List, Dict, Any, AsyncGenerator

def _build_openai_messages(
    messages: List[Dict[str, str]],
    system_prompt: str,
    model: str,
) -> List[Dict[str, str]]:
    """Convert internal message format to OpenAI-compatible messages."""
    result = []
    is_reasoning = any(m in model.lower() for m in ["o1", "o3", "o4"])
    if system_prompt:
        result.append({
            "role": "developer" if is_reasoning else "system",
            "content": system_prompt,
        })
    for msg in messages:
        result.append({
            "role": msg.get("role", "user"),
            "content": msg.get("content", ""),
        })
    return result


# ─── OpenAI-Compatible Adapter ───────────────────────────────────────

async def _call_openai_compatible(
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
    """Non-streaming call to any OpenAI-compatible endpoint."""
    base_url = config["base_url"].rstrip("/")
    chat_path = config.get("chat_path", "/chat/completions")
    
    requires_deployment = config.get("requires_deployment", False)
    if requires_deployment:
        api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
        url = f"{base_url}/{model}/chat/completions?api-version={api_version}"
        headers = {
            "Content-Type": "application/json",
            "api-key": api_key,
        }
    else:
        url = f"{base_url}{chat_path}"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}" if api_key else "",
        }
        if not api_key:
            headers.pop("Authorization", None)

    if "openrouter" in base_url:
        headers["HTTP-Referer"] = "https://solospace.app"
        headers["X-Title"] = "Solospace"

    oa_msgs = _build_openai_messages(messages, system_prompt, model)

    payload: Dict[str, Any] = {
        "model": model,
        "messages": oa_msgs,
        "temperature": temperature,
        "max_tokens": 8192,
    }

    if any(m in model.lower() for m in ["o1", "o3", "o4", "deepseek-reasoner"]):
        payload.pop("temperature", None)

    if json_mode:
        payload["response_format"] = {"type": "json_object"}
        if json_schema_hint:
            last_msg = oa_msgs[-1] if oa_msgs else {}
            if last_msg.get("role") == "user":
                last_msg["content"] = f"{last_msg.get('content', '')}\n\nIMPORTANT: Respond ONLY with valid JSON matching this structure:\n{json_schema_hint}"

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, headers=headers, timeout=timeout)
        if resp.status_code != 200:
            raise Exception(f"Provider error ({resp.status_code}): {resp.text[:500]}")
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def _stream_openai_compatible(
    config: Dict[str, Any],
    model: str,
    api_key: str,
    messages: List[Dict[str, str]],
    system_prompt: str,
    temperature: float = 0.7,
    timeout: float = 90.0,
) -> AsyncGenerator[str, None]:
    """Streaming call to any OpenAI-compatible endpoint. Yields text chunks."""
    base_url = config["base_url"].rstrip("/")
    chat_path = config.get("chat_path", "/chat/completions")
    
    requires_deployment = config.get("requires_deployment", False)
    if requires_deployment:
        api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
        url = f"{base_url}/{model}/chat/completions?api-version={api_version}"
        headers = {
            "Content-Type": "application/json",
            "api-key": api_key,
        }
    else:
        url = f"{base_url}{chat_path}"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}" if api_key else "",
        }
        if not api_key:
            headers.pop("Authorization", None)

    if "openrouter" in base_url:
        headers["HTTP-Referer"] = "https://solospace.app"
        headers["X-Title"] = "Solospace"

    oa_msgs = _build_openai_messages(messages, system_prompt, model)

    payload: Dict[str, Any] = {
        "model": model,
        "messages": oa_msgs,
        "temperature": temperature,
        "max_tokens": 8192,
        "stream": True,
    }
    if any(m in model.lower() for m in ["o1", "o3", "o4", "deepseek-reasoner"]):
        payload.pop("temperature", None)

    async with httpx.AsyncClient() as client:
        async with client.stream("POST", url, json=payload, headers=headers, timeout=timeout) as resp:
            if resp.status_code != 200:
                err_body = await resp.aread()
                raise Exception(f"Provider stream error ({resp.status_code}): {err_body.decode()[:500]}")
            async for line in resp.aiter_lines():
                line = line.strip()
                if not line or not line.startswith("data:"):
                    continue
                data_str = line[5:].strip()
                if data_str == "[DONE]":
                    break
                try:
                    obj = json.loads(data_str)
                    delta = obj.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield content
                except (json.JSONDecodeError, IndexError, KeyError):
                    continue
