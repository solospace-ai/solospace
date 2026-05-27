"""
Solospace AI OS — Provider Registry
Re-exports all provider functions for backward compatibility.
"""

from .base import (
    PROVIDERS,
    get_provider_config,
    get_available_providers,
    resolve_api_key,
    extract_json_from_text,
    call_with_retry,
)
from .openai_compat import (
    _build_openai_messages,
    _call_openai_compatible,
    _stream_openai_compatible,
)
from .gemini import (
    _build_gemini_contents,
    _call_gemini,
    _stream_gemini,
)
from .claude import (
    _build_claude_messages,
    _call_claude,
    _stream_claude,
)
from .registry import (
    call_provider,
    stream_provider,
    call_provider_json,
    get_embedding,
    fetch_models_from_provider,
)

__all__ = [
    "PROVIDERS",
    "get_provider_config",
    "get_available_providers",
    "resolve_api_key",
    "extract_json_from_text",
    "call_with_retry",
    "_build_openai_messages",
    "_call_openai_compatible",
    "_stream_openai_compatible",
    "_build_gemini_contents",
    "_call_gemini",
    "_stream_gemini",
    "_build_claude_messages",
    "_call_claude",
    "_stream_claude",
    "call_provider",
    "stream_provider",
    "call_provider_json",
    "get_embedding",
    "fetch_models_from_provider",
]
