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

MAX_RETRIES = 2          # ── PERF: Reduced from 3 → 2
BASE_DELAY = 0.5         # ── PERF: Reduced from 1.0 → 0.5
MAX_DELAY = 5.0          # ── PERF: Reduced from 10.0 → 5.0
JITTER_FACTOR = 0.3      # ── PERF: Reduced from 0.5 → 0.3

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
            {"id": "gemini-2.5-flash-lite", "name": "Gemini 2.5 Flash Lite", "tier": "fast"},
            {"id": "gemini-2.0-flash-lite", "name": "Gemini 2.0 Flash Lite", "tier": "fast"},
            {"id": "gemma-3-27b-it", "name": "Gemma 3 27B IT", "tier": "open"},
            {"id": "gemma-3-12b-it", "name": "Gemma 3 12B IT", "tier": "open"},
            {"id": "gemma-3-4b-it", "name": "Gemma 3 4B IT", "tier": "open"},
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
            {"id": "gpt-4.1", "name": "GPT-4.1", "tier": "advanced"},
            {"id": "gpt-4.1-mini", "name": "GPT-4.1 Mini", "tier": "fast"},
            {"id": "gpt-4.1-nano", "name": "GPT-4.1 Nano", "tier": "fast"},
            {"id": "gpt-4o", "name": "GPT-4o", "tier": "advanced"},
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "tier": "fast"},
            {"id": "o4-mini", "name": "o4-mini", "tier": "reasoning"},
            {"id": "o3", "name": "o3", "tier": "reasoning"},
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
        "default_model": "claude-sonnet-4-20250514",
        "models": [
            {"id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4", "tier": "advanced"},
            {"id": "claude-opus-4-20250115", "name": "Claude Opus 4", "tier": "reasoning"},
            {"id": "claude-3-7-sonnet-20250219", "name": "Claude 3.7 Sonnet", "tier": "advanced"},
            {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet", "tier": "advanced"},
            {"id": "claude-3-5-haiku-20241022", "name": "Claude 3.5 Haiku", "tier": "fast"},
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
            {"id": "anthropic/claude-3.7-sonnet", "name": "Claude 3.7 Sonnet", "tier": "advanced"},
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
            {"id": "qwen3-32b", "name": "Qwen 3 32B", "tier": "fast"},
            {"id": "deepseek-r1-distill-llama-70b", "name": "DeepSeek R1 Distill Llama 70B", "tier": "reasoning"},
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
            {"id": "mistral-medium-3", "name": "Mistral Medium 3", "tier": "fast"},
            {"id": "codestral-2501", "name": "Codestral 2501", "tier": "code"},
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
            {"id": "sonar-deep-research", "name": "Sonar Deep Research", "tier": "advanced"},
            {"id": "sonar-reasoning", "name": "Sonar Reasoning", "tier": "reasoning"},
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
        "default_model": "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
        "models": [
            {"id": "us.anthropic.claude-3-7-sonnet-20250219-v1:0", "name": "Claude 3.7 Sonnet (US)", "tier": "advanced"},
            {"id": "anthropic.claude-3-7-sonnet-20250219-v1:0", "name": "Claude 3.7 Sonnet", "tier": "advanced"},
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
        "description": "Grok-3 and Grok-2 reasoning models",
        "base_url": "https://api.x.ai/v1",
        "chat_path": "/chat/completions",
        "default_model": "grok-3",
        "models": [
            {"id": "grok-3", "name": "Grok 3", "tier": "advanced"},
            {"id": "grok-3-mini", "name": "Grok 3 Mini", "tier": "fast"},
            {"id": "grok-2", "name": "Grok 2", "tier": "advanced"},
            {"id": "grok-2-mini", "name": "Grok 2-mini", "tier": "fast"},
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
    "alibaba": {
        "name": "Alibaba Cloud (Qwen)",
        "description": "Qwen model family via DashScope OpenAI-compatible endpoint",
        "base_url": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        "chat_path": "/chat/completions",
        "default_model": "qwen-turbo",
        "adapter": "openai",
        "models": [
            { "id": "qwen-turbo", "name": "Qwen Turbo", "tier": "fast" },
            { "id": "qwen-plus", "name": "Qwen Plus", "tier": "advanced" },
            { "id": "qwen-max", "name": "Qwen Max", "tier": "advanced" },
            { "id": "qwen-long", "name": "Qwen Long", "tier": "advanced" },
            { "id": "qwen2.5-72b-instruct", "name": "Qwen 2.5 72B Instruct", "tier": "advanced" },
            { "id": "qwen2.5-14b-instruct", "name": "Qwen 2.5 14B Instruct", "tier": "fast" }
        ],
        "key_url": "https://www.alibabacloud.com/help/en/model-studio/developer-reference/api-key",
        "key_hint": "sk-...",
        "capabilities": ["chat", "streaming", "json_mode"],
    },
    "nvidia": {
        "name": "NVIDIA NIM",
        "description": "NVIDIA NIM inference microservices — optimized open models",
        "base_url": "https://integrate.api.nvidia.com/v1",
        "chat_path": "/chat/completions",
        "default_model": "meta/llama-3.1-70b-instruct",
        "adapter": "openai",
        "models": [
            { "id": "meta/llama-3.1-70b-instruct", "name": "Llama 3.1 70B Instruct", "tier": "advanced" },
            { "id": "meta/llama-3.1-8b-instruct", "name": "Llama 3.1 8B Instruct", "tier": "fast" },
            { "id": "mistralai/mixtral-8x7b-instruct-v0.1", "name": "Mixtral 8x7B Instruct", "tier": "fast" },
            { "id": "microsoft/phi-3-mini-128k-instruct", "name": "Phi-3 Mini 128K", "tier": "fast" },
            { "id": "google/gemma-2-9b-it", "name": "Gemma 2 9B IT", "tier": "fast" },
            { "id": "nvidia/llama3-chatqa-1.5-70b", "name": "ChatQA 1.5 70B", "tier": "advanced" }
        ],
        "key_url": "https://build.nvidia.com",
        "key_hint": "nvapi-...",
        "capabilities": ["chat", "streaming", "json_mode"],
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
        "alibaba": "ALIBABA_API_KEY",
        "nvidia": "NVIDIA_API_KEY",
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


