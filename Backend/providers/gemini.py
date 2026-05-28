import json
import httpx
from typing import List, Dict, Any, AsyncGenerator

def _build_gemini_contents(
    messages: List[Dict[str, str]],
    system_prompt: str,
) -> Dict[str, Any]:
    """Convert internal message format to Gemini contents format."""
    contents = []
    for msg in messages:
        role = "model" if msg.get("role") in ["model", "assistant"] else "user"
        contents.append({
            "role": role,
            "parts": [{"text": msg.get("content", "")}],
        })
    return {
        "contents": contents,
        "systemInstruction": {"parts": [{"text": system_prompt}]} if system_prompt else None,
    }


# ─── Gemini Adapter ──────────────────────────────────────────────────

GEMINI_SAFETY = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]


async def _call_gemini(
    config: Dict[str, Any],
    model: str,
    api_key: str,
    messages: List[Dict[str, str]],
    system_prompt: str,
    temperature: float = 0.7,
    json_schema: Dict[str, Any] = None,
    timeout: float = 30.0,
) -> str:
    """Non-streaming call to Gemini API."""
    base_url = config["base_url"].rstrip("/")
    url = f"{base_url}/models/{model}:generateContent?key={api_key}"

    gemini_data = _build_gemini_contents(messages, system_prompt)

    payload: Dict[str, Any] = {
        **gemini_data,
        "generationConfig": {"temperature": temperature},
        "safetySettings": GEMINI_SAFETY,
    }

    if json_schema:
        payload["generationConfig"]["responseMimeType"] = "application/json"
        payload["generationConfig"]["responseSchema"] = json_schema

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, timeout=timeout)
        if resp.status_code != 200:
            raise Exception(f"Gemini error ({resp.status_code}): {resp.text[:500]}")
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][-1]["text"]


async def _stream_gemini(
    config: Dict[str, Any],
    model: str,
    api_key: str,
    messages: List[Dict[str, str]],
    system_prompt: str,
    temperature: float = 0.7,
    timeout: float = 90.0,
) -> AsyncGenerator[str, None]:
    """Streaming call to Gemini API. Yields text chunks."""
    base_url = config["base_url"].rstrip("/")
    url = f"{base_url}/models/{model}:streamGenerateContent?alt=sse&key={api_key}"

    gemini_data = _build_gemini_contents(messages, system_prompt)

    payload: Dict[str, Any] = {
        **gemini_data,
        "generationConfig": {"temperature": temperature},
        "safetySettings": GEMINI_SAFETY,
    }

    async with httpx.AsyncClient() as client:
        async with client.stream("POST", url, json=payload, timeout=timeout) as resp:
            if resp.status_code != 200:
                err_body = await resp.aread()
                raise Exception(f"Gemini stream error ({resp.status_code}): {err_body.decode()[:500]}")
            async for line in resp.aiter_lines():
                line = line.strip()
                if not line or not line.startswith("data:"):
                    continue
                data_str = line[5:].strip()
                if not data_str:
                    continue
                try:
                    obj = json.loads(data_str)
                    for cand in obj.get("candidates", []):
                        for part in cand.get("content", {}).get("parts", []):
                            text = part.get("text", "")
                            if text:
                                yield text
                except (json.JSONDecodeError, IndexError, KeyError):
                    continue
