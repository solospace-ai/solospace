"""
Unified multi-provider AI adapter.
Supports: Gemini, OpenAI, Claude, OpenRouter, Groq, DeepSeek,
          Together AI, Mistral, Fireworks, Perplexity, Cohere,
          Azure OpenAI, AWS Bedrock, Ollama, xAI, Cerebras, LM Studio, Custom.
"""

import json
import re
import os
import time
import random
import asyncio
from typing import List, Dict, Any, Optional, AsyncGenerator
import httpx

# ─── Retry / Backoff Configuration ──────────────────────────────────

MAX_RETRIES = 3
BASE_DELAY = 1.0
MAX_DELAY = 10.0
JITTER_FACTOR = 0.5

async def call_with_retry(func, *args, **kwargs):
    """Call a provider function with exponential backoff and jitter."""
    retries = 0
    while retries <= MAX_RETRIES:
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            retries += 1
            if retries > MAX_RETRIES:
                raise
            delay = min(MAX_DELAY, BASE_DELAY * (2 ** retries))
            delay += random.uniform(-JITTER_FACTOR * delay, JITTER_FACTOR * delay)
            await asyncio.sleep(delay)
    raise Exception("Retry loop exhausted")

# ─── Provider Registry ───────────────────────────────────────────────

PROVIDERS: Dict[str, Dict[str, Any]] = {
    "gemini": {
        "name": "Google Gemini",
        "description": "Multimodal AI with native JSON schema & embeddings",
        "base_url": "https://generativelanguage.googleapis.com/v1beta",
        "chat_path": None,
        "default_model": "gemini-2.5-flash",
        "models": [
            {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash", "tier": "fast"},
            {"id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro", "tier": "advanced"},
            {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash", "tier": "fast"},
        ],
        "capabilities": ["chat", "streaming", "json_schema", "embeddings"],
        "key_url": "https://aistudio.google.com/apikey",
        "key_hint": "AIzaSy...",
        "adapter": "gemini",
    },
    "openai": {
        "name": "OpenAI",
        "description": "GPT-4o, o3-mini, o1 reasoning models",
        "base_url": "https://api.openai.com/v1",
        "chat_path": "/chat/completions",
        "default_model": "gpt-4o",
        "models": [
            {"id": "gpt-4o", "name": "GPT-4o", "tier": "advanced"},
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "tier": "fast"},
            {"id": "gpt-4-turbo", "name": "GPT-4 Turbo", "tier": "advanced"},
            {"id": "o3-mini", "name": "o3-mini", "tier": "reasoning"},
            {"id": "o1", "name": "o1", "tier": "reasoning"},
        ],
        "capabilities": ["chat", "streaming", "json_mode", "embeddings"],
        "key_url": "https://platform.openai.com/api-keys",
        "key_hint": "sk-...",
        "adapter": "openai",
    },
    "claude": {
        "name": "Anthropic Claude",
        "description": "Claude Sonnet 4, Opus, Haiku family",
        "base_url": "https://api.anthropic.com/v1",
        "chat_path": "/messages",
        "default_model": "claude-3-5-sonnet-20241022",
        "models": [
            {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet", "tier": "advanced"},
            {"id": "claude-3-5-haiku-20241022", "name": "Claude 3.5 Haiku", "tier": "fast"},
            {"id": "claude-3-opus-20240229", "name": "Claude 3 Opus", "tier": "advanced"},
        ],
        "capabilities": ["chat", "streaming"],
        "key_url": "https://console.anthropic.com/settings/keys",
        "key_hint": "sk-ant-...",
        "adapter": "claude",
    },
    "openrouter": {
        "name": "OpenRouter",
        "description": "One API for 200+ models including GPT, Claude, Llama",
        "base_url": "https://openrouter.ai/api/v1",
        "chat_path": "/chat/completions",
        "default_model": "openai/gpt-4o",
        "models": [
            {"id": "openai/gpt-4o", "name": "GPT-4o", "tier": "advanced"},
            {"id": "anthropic/claude-sonnet-4", "name": "Claude Sonnet 4", "tier": "advanced"},
            {"id": "google/gemini-2.5-flash-preview", "name": "Gemini 2.5 Flash", "tier": "fast"},
            {"id": "meta-llama/llama-3.1-405b-instruct", "name": "Llama 3.1 405B", "tier": "open"},
            {"id": "deepseek/deepseek-chat", "name": "DeepSeek V3", "tier": "open"},
            {"id": "qwen/qwen-2.5-72b-instruct", "name": "Qwen 2.5 72B", "tier": "open"},
        ],
        "capabilities": ["chat", "streaming", "json_mode"],
        "key_url": "https://openrouter.ai/keys",
        "key_hint": "sk-or-...",
        "adapter": "openai",
    },
    "groq": {
        "name": "Groq",
        "description": "Ultra-fast LPU inference on open models",
        "base_url": "https://api.groq.com/openai/v1",
        "chat_path": "/chat/completions",
        "default_model": "llama-3.3-70b-versatile",
        "models": [
            {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B", "tier": "fast"},
            {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 8B Instant", "tier": "fast"},
            {"id": "mixtral-8x7b-32768", "name": "Mixtral 8x7B", "tier": "fast"},
            {"id": "gemma2-9b-it", "name": "Gemma 2 9B", "tier": "fast"},
        ],
        "capabilities": ["chat", "streaming", "json_mode"],
        "key_url": "https://console.groq.com/keys",
        "key_hint": "gsk_...",
        "adapter": "openai",
    },
    "deepseek": {
        "name": "DeepSeek",
        "description": "DeepSeek V3 & R1 reasoning models",
        "base_url": "https://api.deepseek.com/v1",
        "chat_path": "/chat/completions",
        "default_model": "deepseek-chat",
        "models": [
            {"id": "deepseek-chat", "name": "DeepSeek V3", "tier": "advanced"},
            {"id": "deepseek-reasoner", "name": "DeepSeek R1", "tier": "reasoning"},
        ],
        "capabilities": ["chat", "streaming", "json_mode"],
        "key_url": "https://platform.deepseek.com/api_keys",
        "key_hint": "sk-...",
        "adapter": "openai",
    },
    "together": {
        "name": "Together AI",
        "description": "Open-source models with fast hosted inference",
        "base_url": "https://api.together.xyz/v1",
        "chat_path": "/chat/completions",
        "default_model": "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo",
        "models": [
            {"id": "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo", "name": "Llama 3.1 405B Turbo", "tier": "advanced"},
            {"id": "mistralai/Mixtral-8x7B-Instruct-v0.1", "name": "Mixtral 8x7B", "tier": "fast"},
            {"id": "Qwen/Qwen2.5-72B-Instruct-Turbo", "name": "Qwen 2.5 72B Turbo", "tier": "advanced"},
        ],
        "capabilities": ["chat", "streaming", "json_mode"],
        "key_url": "https://api.together.xyz/settings/api-keys",
        "key_hint": "",
        "adapter": "openai",
    },
    "mistral": {
        "name": "Mistral AI",
        "description": "Mistral Large, Codestral, and more",
        "base_url": "https://api.mistral.ai/v1",
        "chat_path": "/chat/completions",
        "default_model": "mistral-large-latest",
        "models": [
            {"id": "mistral-large-latest", "name": "Mistral Large", "tier": "advanced"},
            {"id": "mistral-medium-latest", "name": "Mistral Medium", "tier": "fast"},
            {"id": "codestral-latest", "name": "Codestral", "tier": "code"},
            {"id": "open-mistral-nemo", "name": "Mistral Nemo (Free)", "tier": "fast"},
        ],
        "capabilities": ["chat", "streaming", "json_mode"],
        "key_url": "https://console.mistral.ai/api-keys/",
        "key_hint": "",
        "adapter": "openai",
    },
    "fireworks": {
        "name": "Fireworks AI",
        "description": "Fast inference on popular open-source models",
        "base_url": "https://api.fireworks.ai/inference/v1",
        "chat_path": "/chat/completions",
        "default_model": "accounts/fireworks/models/llama-v3p1-405b-instruct",
        "models": [
            {"id": "accounts/fireworks/models/llama-v3p1-405b-instruct", "name": "Llama 3.1 405B", "tier": "advanced"},
            {"id": "accounts/fireworks/models/mixtral-8x7b-instruct", "name": "Mixtral 8x7B", "tier": "fast"},
            {"id": "accounts/fireworks/models/qwen2p5-72b-instruct", "name": "Qwen 2.5 72B", "tier": "advanced"},
        ],
        "capabilities": ["chat", "streaming", "json_mode"],
        "key_url": "https://fireworks.ai/api-keys",
        "key_hint": "fw_...",
        "adapter": "openai",
    },
    "perplexity": {
        "name": "Perplexity",
        "description": "Online search-augmented generation models",
        "base_url": "https://api.perplexity.ai",
        "chat_path": "/chat/completions",
        "default_model": "sonar-pro",
        "models": [
            {"id": "sonar-pro", "name": "Sonar Pro", "tier": "advanced"},
            {"id": "sonar", "name": "Sonar", "tier": "fast"},
        ],
        "capabilities": ["chat", "streaming"],
        "key_url": "https://www.perplexity.ai/settings/api",
        "key_hint": "pplx-...",
        "adapter": "openai",
    },
    "cohere": {
        "name": "Cohere",
        "description": "Command R+ enterprise models with citations",
        "base_url": "https://api.cohere.ai/v2",
        "chat_path": "/chat",
        "default_model": "command-r-plus",
        "models": [
            {"id": "command-r-plus", "name": "Command R+", "tier": "advanced"},
            {"id": "command-r", "name": "Command R", "tier": "fast"},
        ],
        "capabilities": ["chat", "streaming"],
        "key_url": "https://dashboard.cohere.com/api-keys",
        "key_hint": "",
        "adapter": "cohere",
    },
    "azure_openai": {
        "name": "Azure OpenAI",
        "description": "Azure OpenAI service deployment",
        "base_url": "https://YOUR_RESOURCE.openai.azure.com/openai/deployments",
        "chat_path": "/chat/completions",
        "default_model": "gpt-4o",
        "models": [],
        "capabilities": ["chat", "streaming", "json_mode", "embeddings"],
        "key_url": "https://azure.microsoft.com/en-us/products/ai-services/openai",
        "key_hint": "Azure API key",
        "adapter": "openai",
        "requires_deployment": True,
        "requires_base_url": True,
    },
    "bedrock": {
        "name": "AWS Bedrock",
        "description": "AWS Bedrock models using boto3 runtime",
        "base_url": "",
        "default_model": "anthropic.claude-3-5-sonnet-20241022-v2:0",
        "models": [
            {"id": "anthropic.claude-3-5-sonnet-20241022-v2:0", "name": "Claude 3.5 Sonnet v2", "tier": "advanced"},
            {"id": "anthropic.claude-3-5-haiku-20241022-v1:0", "name": "Claude 3.5 Haiku", "tier": "fast"},
            {"id": "meta.llama3-3-70b-instruct-v1:0", "name": "Llama 3.3 70B", "tier": "advanced"},
            {"id": "meta.llama3-1-8b-instruct-v1:0", "name": "Llama 3.1 8B", "tier": "fast"},
        ],
        "capabilities": ["chat", "streaming", "json_mode"],
        "key_url": "https://aws.amazon.com/bedrock/",
        "key_hint": "AWS Access Key ID",
        "adapter": "bedrock",
        "requires_aws": True,
    },
    "ollama": {
        "name": "Ollama (Local)",
        "description": "Run local models on http://localhost:11434",
        "base_url": "http://localhost:11434/v1",
        "chat_path": "/chat/completions",
        "default_model": "llama3",
        "models": [],
        "capabilities": ["chat", "streaming", "json_mode"],
        "key_url": "",
        "key_hint": "No API key required",
        "adapter": "openai",
        "is_local": True,
        "requires_base_url": True,
    },
    "xai": {
        "name": "xAI Grok",
        "description": "Grok-2 and Grok-2-mini models",
        "base_url": "https://api.x.ai/v1",
        "chat_path": "/chat/completions",
        "default_model": "grok-2",
        "models": [
            {"id": "grok-2", "name": "Grok-2", "tier": "advanced"},
            {"id": "grok-2-mini", "name": "Grok-2-mini", "tier": "fast"},
        ],
        "capabilities": ["chat", "streaming", "json_mode"],
        "key_url": "https://x.ai/api-keys",
        "key_hint": "xai-...",
        "adapter": "openai",
    },
    "cerebras": {
        "name": "Cerebras",
        "description": "Ultra-fast Cerebras CS-3 inference on Llama models",
        "base_url": "https://api.cerebras.ai/v1",
        "chat_path": "/chat/completions",
        "default_model": "llama3.1-70b",
        "models": [
            {"id": "llama3.1-70b", "name": "Llama 3.1 70B", "tier": "advanced"},
            {"id": "llama3.1-8b", "name": "Llama 3.1 8B", "tier": "fast"},
        ],
        "capabilities": ["chat", "streaming", "json_mode"],
        "key_url": "https://cerebras.ai/api-keys",
        "key_hint": "cerebras-...",
        "adapter": "openai",
    },
    "lmstudio": {
        "name": "LM Studio (Local)",
        "description": "Local models served on http://localhost:1234",
        "base_url": "http://localhost:1234/v1",
        "chat_path": "/chat/completions",
        "default_model": "local-model",
        "models": [],
        "capabilities": ["chat", "streaming", "json_mode"],
        "key_url": "",
        "key_hint": "No API key required",
        "adapter": "openai",
        "is_local": True,
        "requires_base_url": True,
    },
    "custom": {
        "name": "Custom / Open Code",
        "description": "vLLM, LM Studio, Ollama or any OpenAI-compatible API",
        "base_url": "",
        "chat_path": "/v1/chat/completions",
        "default_model": "",
        "models": [],
        "capabilities": ["chat", "streaming", "json_mode"],
        "key_url": "",
        "key_hint": "Any key or leave empty",
        "adapter": "openai",
        "is_custom": True,
        "requires_base_url": True,
    },
}


def get_provider_config(provider_id: str) -> Dict[str, Any]:
    """Get config for a provider. Returns empty dict if not found."""
    return PROVIDERS.get(provider_id.lower(), {})


def get_available_providers() -> Dict[str, Any]:
    """Return provider registry for the frontend."""
    result = {}
    for pid, cfg in PROVIDERS.items():
        result[pid] = {
            "name": cfg["name"],
            "description": cfg["description"],
            "models": cfg["models"],
            "default_model": cfg["default_model"],
            "capabilities": cfg["capabilities"],
            "key_url": cfg["key_url"],
            "key_hint": cfg["key_hint"],
            "is_custom": cfg.get("is_custom", False),
            "is_local": cfg.get("is_local", False),
            "requires_base_url": cfg.get("requires_base_url", False),
        }
    return result


def resolve_api_key(provider: str, user_key: Optional[str] = None, api_keys: Optional[Dict[str, str]] = None) -> str:
    """Resolve key from user input dictionary, single user_key, or fallback to env."""
    if api_keys and provider in api_keys and api_keys[provider].strip():
        return api_keys[provider].strip()
    if user_key and user_key.strip():
        return user_key.strip()

    env_keys = {
        "gemini": "GEMINI_API_KEY",
        "openai": "OPENAI_API_KEY",
        "claude": "ANTHROPIC_API_KEY",
        "openrouter": "OPENROUTER_API_KEY",
        "groq": "GROQ_API_KEY",
        "deepseek": "DEEPSEEK_API_KEY",
        "together": "TOGETHER_API_KEY",
        "mistral": "MISTRAL_API_KEY",
        "fireworks": "FIREWORKS_API_KEY",
        "perplexity": "PERPLEXITY_API_KEY",
        "cohere": "COHERE_API_KEY",
        "azure_openai": "AZURE_OPENAI_API_KEY",
        "xai": "XAI_API_KEY",
        "cerebras": "CEREBRAS_API_KEY",
        "bedrock": "AWS_ACCESS_KEY_ID",
    }
    env_var_name = env_keys.get(provider.lower())
    if env_var_name:
        val = os.environ.get(env_var_name)
        if val:
            return val
    return ""


def extract_json_from_text(text: str) -> Optional[Dict[str, Any]]:
    """Extract and parse a JSON object from text that may contain markdown or extra content."""
    try:
        return json.loads(text.strip())
    except (json.JSONDecodeError, ValueError):
        pass

    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except (json.JSONDecodeError, ValueError):
            pass

    depth = 0
    start = -1
    for i, ch in enumerate(text):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start >= 0:
                try:
                    return json.loads(text[start:i + 1])
                except (json.JSONDecodeError, ValueError):
                    break
    return None


def _build_openai_messages(
    messages: List[Dict[str, str]],
    system_prompt: str,
    model: str,
) -> List[Dict[str, str]]:
    """Convert internal message format to OpenAI-compatible messages."""
    result = []
    is_reasoning = any(m in model.lower() for m in ["o1", "o3"])
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

    if any(m in model.lower() for m in ["o1", "o3", "deepseek-reasoner"]):
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
    if any(m in model.lower() for m in ["o1", "o3", "deepseek-reasoner"]):
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
        "max_tokens": 4096,
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
        "max_tokens": 4096,
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
    """Non-streaming call to Cohere v2 API."""
    base_url = config["base_url"].rstrip("/")
    url = f"{base_url}/chat"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    chat_history = []
    for msg in messages[:-1]:
        chat_history.append({
            "role": "USER" if msg.get("role") == "user" else "CHATBOT",
            "message": msg.get("content", ""),
        })

    payload: Dict[str, Any] = {
        "model": model,
        "message": messages[-1].get("content", "") if messages else "",
        "chat_history": chat_history,
        "temperature": temperature,
    }

    if system_prompt:
        payload["preamble"] = system_prompt

    if json_mode:
        json_instr = "Respond ONLY with valid JSON."
        if json_schema_hint:
            json_instr += f" Structure: {json_schema_hint}"
        payload["message"] = f"{json_instr}\n\n{payload['message']}"

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, headers=headers, timeout=timeout)
        if resp.status_code != 200:
            raise Exception(f"Cohere error ({resp.status_code}): {resp.text[:500]}")
        data = resp.json()
        return data.get("text", "")


async def _stream_cohere(
    config: Dict[str, Any],
    model: str,
    api_key: str,
    messages: List[Dict[str, str]],
    system_prompt: str,
    temperature: float = 0.7,
    timeout: float = 90.0,
) -> AsyncGenerator[str, None]:
    """Streaming call to Cohere v2 API. Yields text chunks."""
    base_url = config["base_url"].rstrip("/")
    url = f"{base_url}/chat"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    chat_history = []
    for msg in messages[:-1]:
        chat_history.append({
            "role": "USER" if msg.get("role") == "user" else "CHATBOT",
            "message": msg.get("content", ""),
        })

    payload: Dict[str, Any] = {
        "model": model,
        "message": messages[-1].get("content", "") if messages else "",
        "chat_history": chat_history,
        "temperature": temperature,
        "stream": True,
    }
    if system_prompt:
        payload["preamble"] = system_prompt

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
                    event_type = obj.get("event_type", "")
                    if event_type == "text-generation":
                        text = obj.get("text", "")
                        if text:
                            yield text
                except (json.JSONDecodeError, KeyError):
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
    """AWS Bedrock adapter using boto3 client."""
    try:
        import boto3
        from botocore.config import Config
    except ImportError:
        raise Exception("AWS Bedrock requires boto3 to be installed on the server.")

    conversation = []
    if system_prompt:
        conversation.append({"role": "system", "content": system_prompt})
    for msg in messages:
        # Convert assistant/model roles to assistant
        role = "assistant" if msg.get("role") in ["assistant", "model"] else "user"
        conversation.append({"role": role, "content": msg.get("content", "")})

    # Prepare client parameters
    client_params = {
        "region_name": os.environ.get("AWS_REGION", "us-east-1"),
        "config": Config(read_timeout=timeout)
    }
    if api_key:
        client_params["aws_access_key_id"] = api_key
        client_params["aws_secret_access_key"] = os.environ.get("AWS_SECRET_ACCESS_KEY", "")

    client = boto3.client("bedrock-runtime", **client_params)

    # Payload mapping (standard Anthropic Converse API style or model-specific invocation)
    body = {
        "messages": conversation,
        "temperature": temperature,
        "max_tokens": 4096
    }
    if json_mode:
        body["responseFormat"] = {"type": "json_object"}
        # Bedrock models don't support native structured schemas globally yet, inject hint
        if json_schema_hint:
            conversation.append({
                "role": "user",
                "content": f"Respond strictly in valid JSON matching this schema:\n{json_schema_hint}"
            })

    try:
        # We use Converse API which is standard across Amazon Bedrock models
        system_blocks = [{"text": system_prompt}] if system_prompt else []
        converse_messages = []
        for msg in messages:
            role = "assistant" if msg.get("role") in ["assistant", "model"] else "user"
            converse_messages.append({
                "role": role,
                "content": [{"text": msg.get("content", "")}]
            })
        
        # Converse request
        resp = client.converse(
            modelId=model,
            messages=converse_messages,
            system=system_blocks,
            inferenceConfig={"temperature": temperature, "maxTokens": 4096}
        )
        return resp["output"]["message"]["content"][0]["text"]
    except Exception as e:
        raise Exception(f"Bedrock converse call failed: {str(e)}")


async def _stream_bedrock(
    config: Dict[str, Any],
    model: str,
    api_key: str,
    messages: List[Dict[str, str]],
    system_prompt: str,
    temperature: float = 0.7,
    timeout: float = 90.0,
) -> AsyncGenerator[str, None]:
    """AWS Bedrock streaming adapter using converse_stream API."""
    try:
        import boto3
        from botocore.config import Config
    except ImportError:
        raise Exception("AWS Bedrock requires boto3 to be installed on the server.")

    client_params = {
        "region_name": os.environ.get("AWS_REGION", "us-east-1"),
        "config": Config(read_timeout=timeout)
    }
    if api_key:
        client_params["aws_access_key_id"] = api_key
        client_params["aws_secret_access_key"] = os.environ.get("AWS_SECRET_ACCESS_KEY", "")

    client = boto3.client("bedrock-runtime", **client_params)

    system_blocks = [{"text": system_prompt}] if system_prompt else []
    converse_messages = []
    for msg in messages:
        role = "assistant" if msg.get("role") in ["assistant", "model"] else "user"
        converse_messages.append({
            "role": role,
            "content": [{"text": msg.get("content", "")}]
        })

    try:
        resp = client.converse_stream(
            modelId=model,
            messages=converse_messages,
            system=system_blocks,
            inferenceConfig={"temperature": temperature, "maxTokens": 4096}
        )
        for event in resp.get("stream", []):
            if "contentBlockDelta" in event:
                delta = event["contentBlockDelta"].get("delta", {})
                if "text" in delta:
                    yield delta["text"]
    except Exception as e:
        raise Exception(f"Bedrock converse stream failed: {str(e)}")


# ─── Unified Interface ───────────────────────────────────────────────

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

    resolved_key = resolve_api_key(provider, api_key, api_keys)
    if not resolved_key and not cloned_config.get("is_local", False):
        raise Exception(f"API key missing for provider {provider}")

    adapter = cloned_config.get("adapter", "openai")
    wants_json = json_schema is not None or json_schema_hint is not None

    async def _call():
        if adapter == "gemini":
            return await _call_gemini(cloned_config, resolved_model, resolved_key, messages, system_prompt,
                                       temperature=temperature, json_schema=json_schema, timeout=timeout)
        elif adapter == "claude":
            return await _call_claude(cloned_config, resolved_model, resolved_key, messages, system_prompt,
                                       temperature=temperature, json_mode=wants_json,
                                       json_schema_hint=json_schema_hint, timeout=timeout)
        elif adapter == "cohere":
            return await _call_cohere(cloned_config, resolved_model, resolved_key, messages, system_prompt,
                                       temperature=temperature, json_mode=wants_json,
                                       json_schema_hint=json_schema_hint, timeout=timeout)
        elif adapter == "bedrock":
            return await _call_bedrock(cloned_config, resolved_model, resolved_key, messages, system_prompt,
                                       temperature=temperature, json_mode=wants_json,
                                       json_schema_hint=json_schema_hint, timeout=timeout)
        else:  # openai-compatible
            return await _call_openai_compatible(cloned_config, resolved_model, resolved_key, messages, system_prompt,
                                                 temperature=temperature, json_mode=wants_json,
                                                 json_schema_hint=json_schema_hint, timeout=timeout)

    try:
        return await call_with_retry(_call)
    except Exception as e:
        if fallback_provider and fallback_provider.lower() != provider.lower():
            print(f"[FALLBACK] Primary provider {provider} failed: {e}. Routing to fallback {fallback_provider}...")
            fallback_config = get_provider_config(fallback_provider)
            fallback_model = fallback_config.get("default_model", "")
            fallback_key = resolve_api_key(fallback_provider, None, api_keys)
            
            # Extract optional custom base URL for fallback from frontend dictionary if configured
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
                base_url=fallback_base_url
            )
        else:
            raise


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

    resolved_key = resolve_api_key(provider, api_key, api_keys)
    if not resolved_key and not cloned_config.get("is_local", False):
        raise Exception(f"API key missing for provider {provider}")

    adapter = cloned_config.get("adapter", "openai")

    async def _stream():
        if adapter == "gemini":
            async for chunk in _stream_gemini(cloned_config, resolved_model, resolved_key, messages, system_prompt,
                                               temperature=temperature, timeout=timeout):
                yield chunk
        elif adapter == "claude":
            async for chunk in _stream_claude(cloned_config, resolved_model, resolved_key, messages, system_prompt,
                                               temperature=temperature, timeout=timeout):
                yield chunk
        elif adapter == "cohere":
            async for chunk in _stream_cohere(cloned_config, resolved_model, resolved_key, messages, system_prompt,
                                               temperature=temperature, timeout=timeout):
                yield chunk
        elif adapter == "bedrock":
            async for chunk in _stream_bedrock(cloned_config, resolved_model, resolved_key, messages, system_prompt,
                                               temperature=temperature, timeout=timeout):
                yield chunk
        else:  # openai-compatible
            async for chunk in _stream_openai_compatible(cloned_config, resolved_model, resolved_key, messages, system_prompt,
                                                         temperature=temperature, timeout=timeout):
                yield chunk

    retries = 0
    while retries <= MAX_RETRIES:
        try:
            async for chunk in _stream():
                yield chunk
            return
        except Exception as e:
            retries += 1
            if retries > MAX_RETRIES:
                if fallback_provider and fallback_provider.lower() != provider.lower():
                    print(f"[FALLBACK STREAM] Primary {provider} failed: {e}. Switching to fallback {fallback_provider}...")
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
                        base_url=None
                    ):
                        yield chunk
                    return
                else:
                    raise
            delay = min(MAX_DELAY, BASE_DELAY * (2 ** retries))
            delay += random.uniform(-JITTER_FACTOR * delay, JITTER_FACTOR * delay)
            await asyncio.sleep(delay)


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
        base_url=base_url
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
    if not resolved_base_url:
        return config.get("models", [])

    adapter = config.get("adapter", "openai")
    base_url_str = resolved_base_url.rstrip("/")
    
    if adapter in ("openai", "openai-compatible"):
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
                    return models
        except Exception as e:
            print(f"[FETCH MODELS ERROR] Failed to fetch models for {provider}: {e}")
            
    return config.get("models", [])
