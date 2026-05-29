import json
import random
import asyncio
import httpx
from typing import Optional, List, Dict, Any, AsyncGenerator

from .base import (
    get_provider_config,
    resolve_api_key,
    PROVIDERS,
    extract_json_from_text,
    call_with_retry,
    MAX_RETRIES,
    BASE_DELAY,
    MAX_DELAY,
    JITTER_FACTOR,
)
from .gemini import _call_gemini, _stream_gemini
from .claude import _call_claude, _stream_claude
from .openai_compat import _call_openai_compatible, _stream_openai_compatible


# ─── Cohere Adapter ──────────────────────────────────────────────────

async def _call_cohere(
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
    url = "https://api.cohere.ai/v2/chat"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    
    cohere_msgs = []
    if system_prompt:
        cohere_msgs.append({"role": "system", "content": system_prompt})
    for msg in messages:
        role = "assistant" if msg.get("role") in ["model", "assistant"] else "user"
        cohere_msgs.append({"role": role, "content": msg.get("content", "")})

    payload = {
        "model": model or "command-r-plus",
        "messages": cohere_msgs,
        "temperature": temperature,
    }
    
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, headers=headers, timeout=timeout)
        if resp.status_code != 200:
            raise Exception(f"Cohere error ({resp.status_code}): {resp.text[:500]}")
        data = resp.json()
        return data["message"]["content"][0]["text"]


async def _stream_cohere(
    config: Dict[str, Any],
    model: str,
    api_key: str,
    messages: List[Dict[str, str]],
    system_prompt: str,
    temperature: float = 0.7,
    timeout: float = 90.0,
) -> AsyncGenerator[str, None]:
    url = "https://api.cohere.ai/v2/chat"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    
    cohere_msgs = []
    if system_prompt:
        cohere_msgs.append({"role": "system", "content": system_prompt})
    for msg in messages:
        role = "assistant" if msg.get("role") in ["model", "assistant"] else "user"
        cohere_msgs.append({"role": role, "content": msg.get("content", "")})

    payload = {
        "model": model or "command-r-plus",
        "messages": cohere_msgs,
        "temperature": temperature,
        "stream": True,
    }

    async with httpx.AsyncClient() as client:
        async with client.stream("POST", url, json=payload, headers=headers, timeout=timeout) as resp:
            if resp.status_code != 200:
                err_body = await resp.aread()
                raise Exception(f"Cohere stream error ({resp.status_code}): {err_body.decode()[:500]}")
            async for line in resp.aiter_lines():
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    event_type = obj.get("type", "")
                    if event_type == "content-delta":
                        text = obj.get("delta", {}).get("message", {}).get("content", {}).get("text", "")
                        if text:
                            yield text
                except Exception:
                    continue


# ─── AWS Bedrock Adapter ─────────────────────────────────────────────

async def _call_bedrock(
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
    import boto3
    session = boto3.Session()
    client = session.client(service_name="bedrock-runtime")
    
    converse_msgs = []
    for msg in messages:
        role = "assistant" if msg.get("role") in ["model", "assistant"] else "user"
        converse_msgs.append({
            "role": role,
            "content": [{"text": msg.get("content", "")}]
        })
    
    system_config = []
    if system_prompt:
        system_config.append({"text": system_prompt})

    loop = asyncio.get_event_loop()
    def _run():
        return client.converse(
            modelId=model,
            messages=converse_msgs,
            system=system_config,
            inferenceConfig={
                "temperature": temperature,
                "maxTokens": 4096
            }
        )
        
    resp = await loop.run_in_executor(None, _run)
    return resp["output"]["message"]["content"][0]["text"]


async def _stream_bedrock(
    config: Dict[str, Any],
    model: str,
    api_key: str,
    messages: List[Dict[str, str]],
    system_prompt: str,
    temperature: float = 0.7,
    timeout: float = 90.0,
) -> AsyncGenerator[str, None]:
    import boto3
    session = boto3.Session()
    client = session.client(service_name="bedrock-runtime")
    
    converse_msgs = []
    for msg in messages:
        role = "assistant" if msg.get("role") in ["model", "assistant"] else "user"
        converse_msgs.append({
            "role": role,
            "content": [{"text": msg.get("content", "")}]
        })
        
    system_config = []
    if system_prompt:
        system_config.append({"text": system_prompt})

    loop = asyncio.get_event_loop()
    def _run_stream():
        return client.converse_stream(
            modelId=model,
            messages=converse_msgs,
            system=system_config,
            inferenceConfig={
                "temperature": temperature,
                "maxTokens": 4096
            }
        )
        
    response = await loop.run_in_executor(None, _run_stream)
    stream = response.get("stream")
    if stream:
        for event in stream:
            if "contentBlockDelta" in event:
                text = event["contentBlockDelta"]["delta"].get("text", "")
                if text:
                    yield text


# ─── Registry Operations ─────────────────────────────────────────────

async def call_provider(
    provider: str,
    model: Optional[str],
    api_key: str,
    messages: List[Dict[str, str]],
    system_prompt: str = "",
    temperature: float = 0.7,
    json_schema: Dict[str, Any] = None,
    json_schema_hint: str = None,
    timeout: float = 30.0,
    fallback_provider: Optional[str] = None,
    api_keys: Optional[Dict[str, str]] = None,
    base_url: Optional[str] = None,
    backup_api_keys: Optional[List[str]] = None,
) -> str:
    """Unified non-streaming call to any provider with retry and fallback routing."""
    config = get_provider_config(provider)
    if not config:
        raise Exception(f"Unknown provider: {provider}")

    resolved_model = model or config.get("default_model", "")
    resolved_base_url = base_url or config.get("base_url", "")
    
    cloned_config = dict(config)
    if resolved_base_url:
        cloned_config["base_url"] = resolved_base_url

    resolved_key = resolve_api_key(provider, api_key, api_keys, backup_keys=backup_api_keys)
    
    other_keys = [k for k in (backup_api_keys or []) if k.strip() and k.strip() != resolved_key]
    keys_to_try = [resolved_key] + other_keys
    keys_to_try = [k for k in keys_to_try if k]
    if not keys_to_try and not cloned_config.get("is_local", False):
        raise Exception(f"API key missing for provider {provider}")

    adapter = cloned_config.get("adapter", "openai")
    wants_json = json_schema is not None or json_schema_hint is not None

    if cloned_config.get("is_local", False):
        timeout = max(timeout, 120.0)

    last_error = None
    for current_key in (keys_to_try or [None]):
        async def _call():
            if adapter == "gemini":
                return await _call_gemini(cloned_config, resolved_model, current_key, messages, system_prompt,
                                           temperature=temperature, json_schema=json_schema, timeout=timeout)
            elif adapter == "claude":
                return await _call_claude(cloned_config, resolved_model, current_key, messages, system_prompt,
                                           temperature=temperature, json_mode=wants_json,
                                           json_schema_hint=json_schema_hint, timeout=timeout)
            elif adapter == "cohere":
                return await _call_cohere(cloned_config, resolved_model, current_key, messages, system_prompt,
                                           temperature=temperature, json_mode=wants_json,
                                           json_schema_hint=json_schema_hint, timeout=timeout)
            elif adapter == "bedrock":
                return await _call_bedrock(cloned_config, resolved_model, current_key, messages, system_prompt,
                                           temperature=temperature, json_mode=wants_json,
                                           json_schema_hint=json_schema_hint, timeout=timeout)
            else:  # openai-compatible
                return await _call_openai_compatible(cloned_config, resolved_model, current_key, messages, system_prompt,
                                                     temperature=temperature, json_mode=wants_json,
                                                     json_schema_hint=json_schema_hint, timeout=timeout)

        try:
            return await call_with_retry(_call)
        except Exception as e:
            last_error = e
            print(f"[KEY ROTATION] Key failed for {provider}, trying next... ({e})")
            continue

    if fallback_provider and fallback_provider.lower() != provider.lower():
        print(f"[FALLBACK] Primary provider {provider} failed all keys: {last_error}. Routing to fallback {fallback_provider}...")
        fallback_config = get_provider_config(fallback_provider)
        fallback_model = fallback_config.get("default_model", "")
        fallback_key = resolve_api_key(fallback_provider, None, api_keys)
        
        fallback_base_url = None
        
        return await call_provider(
            provider=fallback_provider,
            model=fallback_model,
            api_key=fallback_key,
            messages=messages,
            system_prompt=system_prompt,
            temperature=temperature,
            json_schema=json_schema,
            json_schema_hint=json_schema_hint,
            timeout=timeout,
            fallback_provider=None,
            api_keys=api_keys,
            base_url=fallback_base_url,
            backup_api_keys=None
        )
    else:
        raise last_error


async def stream_provider(
    provider: str,
    model: Optional[str],
    api_key: str,
    messages: List[Dict[str, str]],
    system_prompt: str = "",
    temperature: float = 0.7,
    timeout: float = 90.0,
    fallback_provider: Optional[str] = None,
    api_keys: Optional[Dict[str, str]] = None,
    base_url: Optional[str] = None,
    backup_api_keys: Optional[List[str]] = None,
) -> AsyncGenerator[str, None]:
    """Unified streaming call to any provider with retry and fallback routing."""
    config = get_provider_config(provider)
    if not config:
        raise Exception(f"Unknown provider: {provider}")

    resolved_model = model or config.get("default_model", "")
    resolved_base_url = base_url or config.get("base_url", "")
    
    cloned_config = dict(config)
    if resolved_base_url:
        cloned_config["base_url"] = resolved_base_url

    resolved_key = resolve_api_key(provider, api_key, api_keys, backup_keys=backup_api_keys)
    
    other_keys = [k for k in (backup_api_keys or []) if k.strip() and k.strip() != resolved_key]
    keys_to_try = [resolved_key] + other_keys
    keys_to_try = [k for k in keys_to_try if k]
    if not keys_to_try and not cloned_config.get("is_local", False):
        raise Exception(f"API key missing for provider {provider}")

    adapter = cloned_config.get("adapter", "openai")

    if cloned_config.get("is_local", False):
        timeout = max(timeout, 120.0)

    last_error = None
    success = False
    
    for current_key in (keys_to_try or [None]):
        async def _stream():
            if adapter == "gemini":
                async for chunk in _stream_gemini(cloned_config, resolved_model, current_key, messages, system_prompt,
                                                   temperature=temperature, timeout=timeout):
                    yield chunk
            elif adapter == "claude":
                async for chunk in _stream_claude(cloned_config, resolved_model, current_key, messages, system_prompt,
                                                   temperature=temperature, timeout=timeout):
                    yield chunk
            elif adapter == "cohere":
                async for chunk in _stream_cohere(cloned_config, resolved_model, current_key, messages, system_prompt,
                                                   temperature=temperature, timeout=timeout):
                    yield chunk
            elif adapter == "bedrock":
                async for chunk in _stream_bedrock(cloned_config, resolved_model, current_key, messages, system_prompt,
                                                   temperature=temperature, timeout=timeout):
                    yield chunk
            else:  # openai-compatible
                async for chunk in _stream_openai_compatible(cloned_config, resolved_model, current_key, messages, system_prompt,
                                                             temperature=temperature, timeout=timeout):
                    yield chunk

        retries = 0
        try:
            while retries <= MAX_RETRIES:
                try:
                    async for chunk in _stream():
                        yield chunk
                    success = True
                    return
                except Exception as e:
                    retries += 1
                    if retries > MAX_RETRIES:
                        raise e
                    delay = min(MAX_DELAY, BASE_DELAY * (2 ** retries))
                    delay += random.uniform(-JITTER_FACTOR * delay, JITTER_FACTOR * delay)
                    await asyncio.sleep(delay)
        except Exception as e:
            last_error = e
            print(f"[KEY ROTATION STREAM] Key failed for {provider}, trying next... ({e})")
            continue

    if not success:
        if fallback_provider and fallback_provider.lower() != provider.lower():
            print(f"[FALLBACK STREAM] Primary {provider} failed all keys: {last_error}. Switching to fallback {fallback_provider}...")
            fallback_config = get_provider_config(fallback_provider)
            fallback_model = fallback_config.get("default_model", "")
            fallback_key = resolve_api_key(fallback_provider, None, api_keys)
            
            async for chunk in stream_provider(
                provider=fallback_provider,
                model=fallback_model,
                api_key=fallback_key,
                messages=messages,
                system_prompt=system_prompt,
                temperature=temperature,
                timeout=timeout,
                fallback_provider=None,
                api_keys=api_keys,
                base_url=None,
                backup_api_keys=None
            ):
                yield chunk
            return
        else:
            raise last_error


async def call_provider_json(
    provider: str,
    model: Optional[str],
    api_key: str,
    messages: List[Dict[str, str]],
    system_prompt: str = "",
    temperature: float = 0.2,
    json_schema: Dict[str, Any] = None,
    timeout: float = 30.0,
    fallback_provider: Optional[str] = None,
    api_keys: Optional[Dict[str, str]] = None,
    base_url: Optional[str] = None,
    backup_api_keys: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Unified JSON completions call with fallback validation."""
    schema_hint = None
    if json_schema:
        schema_hint = json.dumps(json_schema, indent=2)

    response_text = await call_provider(
        provider=provider,
        model=model,
        api_key=api_key,
        messages=messages,
        system_prompt=system_prompt,
        temperature=temperature,
        json_schema=json_schema,
        json_schema_hint=schema_hint,
        timeout=timeout,
        fallback_provider=fallback_provider,
        api_keys=api_keys,
        base_url=base_url,
        backup_api_keys=backup_api_keys
    )
    
    parsed = extract_json_from_text(response_text)
    if parsed is None:
        raise ValueError(f"Failed to extract JSON from response: {response_text[:1000]}")
    return parsed


# ─── Embedding Abstraction ───────────────────────────────────────────

async def get_embedding(provider: str, api_key: str, text: str, api_keys: Optional[Dict[str, str]] = None) -> List[float]:
    """Unified embedding generator."""
    resolved_key = resolve_api_key(provider, api_key, api_keys)
    if not resolved_key:
        return []

    if provider.lower() == "gemini":
        url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={resolved_key}"
        payload = {
            "model": "models/text-embedding-004",
            "content": {"parts": [{"text": text}]}
        }
        async with httpx.AsyncClient() as client:
            try:
                r = await client.post(url, json=payload, timeout=15.0)
                if r.status_code == 200:
                    return r.json().get("embedding", {}).get("values", [])
            except Exception as e:
                print(f"[EMBEDDING ERROR] Gemini embedding failed: {e}")
    elif provider.lower() == "openai":
        url = "https://api.openai.com/v1/embeddings"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {resolved_key}"
        }
        payload = {
            "model": "text-embedding-3-small",
            "input": text
        }
        async with httpx.AsyncClient() as client:
            try:
                r = await client.post(url, json=payload, headers=headers, timeout=15.0)
                if r.status_code == 200:
                    return r.json().get("data", [{}])[0].get("embedding", [])
            except Exception as e:
                print(f"[EMBEDDING ERROR] OpenAI embedding failed: {e}")
    return []


# ─── Dynamic Model Fetching ─────────────────────────────────────────

async def fetch_models_from_provider(
    provider: str,
    api_key: str,
    api_keys: Optional[Dict[str, str]] = None,
    base_url: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Fetch available models from the provider's API dynamically."""
    config = get_provider_config(provider)
    if not config:
        return []
    
    resolved_key = resolve_api_key(provider, api_key, api_keys)
    if not resolved_key and not config.get("is_local", False):
        return []

    resolved_base_url = base_url or config.get("base_url", "")
    adapter = config.get("adapter", "openai")
    base_url_str = resolved_base_url.rstrip("/")
    
    if adapter == "gemini":
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={resolved_key}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    models = []
                    for item in data.get("models", []):
                        supported = item.get("supportedGenerationMethods", [])
                        if "generateContent" in supported:
                            model_id = item.get("name", "").replace("models/", "")
                            if model_id:
                                models.append({
                                    "id": model_id,
                                    "name": item.get("displayName", model_id),
                                    "tier": "fast" if "flash" in model_id else "advanced"
                                })
                    if models:
                        return models
        except Exception as e:
            print(f"[FETCH MODELS ERROR] Gemini: {e}")

    elif adapter == "claude":
        url = "https://api.anthropic.com/v1/models"
        headers = {
            "x-api-key": resolved_key,
            "anthropic-version": "2024-10-22",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    models = []
                    for item in data.get("data", []):
                        model_id = item.get("id", "")
                        if model_id:
                            tier = "reasoning" if "opus" in model_id else \
                                   "fast" if "haiku" in model_id else "advanced"
                            models.append({
                                    "id": model_id,
                                    "name": item.get("display_name", model_id),
                                    "tier": tier
                            })
                    if models:
                        return models
        except Exception as e:
            print(f"[FETCH MODELS ERROR] Claude: {e}")

    elif adapter in ("openai", "openai-compatible"):
        if not base_url_str:
            return config.get("models", [])
        url = f"{base_url_str}/models"
        headers = {}
        if resolved_key:
            if config.get("requires_deployment"):
                headers["api-key"] = resolved_key
            else:
                headers["Authorization"] = f"Bearer {resolved_key}"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    models = []
                    for item in data.get("data", []):
                        model_id = item.get("id")
                        if model_id:
                            models.append({
                                "id": model_id,
                                "name": model_id,
                                "tier": "custom"
                            })
                    if models:
                        return models
        except Exception as e:
            print(f"[FETCH MODELS ERROR] Failed to fetch models for {provider}: {e}")
            
    return config.get("models", [])
