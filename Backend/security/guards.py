"""
SSRF guard and jailbreak filter utilities.
"""
import socket
import ipaddress
from urllib.parse import urlparse
from typing import Optional


BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254"}
ALLOWED_SCHEMES = {"http", "https"}

JAILBREAK_KEYWORDS = [
    "ignore previous instructions",
    "ignore all instructions",
    "override system prompt",
    "you are now developer mode",
    "jailbreak",
    "act as dan",
    "pretend you have no restrictions",
]


def check_ssrf(url: str) -> Optional[str]:
    """
    Validate URL against SSRF attacks.
    Returns an error string if blocked, None if allowed.
    """
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ALLOWED_SCHEMES:
            return f"Scheme '{parsed.scheme}' not allowed. Use http/https."
        hostname = parsed.hostname
        if not hostname:
            return "Invalid URL: missing hostname."
        if hostname.lower() in BLOCKED_HOSTS:
            return "Access to internal/local addresses is blocked."
        try:
            ip_str = socket.gethostbyname(hostname)
            ip_obj = ipaddress.ip_address(ip_str)
            if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
                return "Access to internal/local addresses is blocked."
        except ValueError:
            pass  # Not a valid IP string after DNS resolve
        except Exception:
            pass
    except Exception as e:
        return f"Invalid URL: {str(e)}"
    return None


def check_jailbreak(prompt: str) -> Optional[str]:
    """
    Check for prompt injection / jailbreak attempts.
    Returns a safety alert string if detected, None if clean.
    """
    lower = prompt.lower()
    for keyword in JAILBREAK_KEYWORDS:
        if keyword in lower:
            return "Safety Alert: Input contains potential prompt injection or system instruction bypass."
    return None
