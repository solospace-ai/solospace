"""
Agent tools: web_search, web_browse, execute_code, api_call, memory operations.
All I/O is async. SSRF protection is applied to all external URL calls.
"""
import os
import sys
import json
import asyncio
import tempfile
import subprocess
import datetime
from typing import List, Optional, Dict, Any

import httpx
from bs4 import BeautifulSoup

from security.guards import check_ssrf

# ─── HTTP Client Singleton (connection pooling) ───────────────────────
_http_client: Optional[httpx.AsyncClient] = None


def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(15.0),
            follow_redirects=True,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                )
            },
        )
    return _http_client


# ─── Web Search ──────────────────────────────────────────────────────

async def execute_web_search(query: str) -> str:
    """Search DuckDuckGo and return top 3 snippets."""
    url = f"https://html.duckduckgo.com/html/?q={query}"
    client = get_http_client()
    try:
        r = await client.get(url)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, "html.parser")
            snippets = [
                div.get_text().strip()
                for div in soup.find_all("a", class_="result__snippet")[:5]
            ]
            if snippets:
                return "\n".join(snippets)
    except Exception as e:
        return f"Search failed: {str(e)}"
    return f"No search results found for: '{query}'."


# ─── Web Browse ──────────────────────────────────────────────────────

async def execute_web_browse(url: str) -> str:
    """Fetch and extract readable text from a URL. SSRF-protected."""
    err = check_ssrf(url)
    if err:
        return f"Error: {err}"
    client = get_http_client()
    try:
        r = await client.get(url)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
                tag.decompose()
            return soup.get_text(separator="\n", strip=True)[:3000]
        return f"Browse failed with status {r.status_code}"
    except Exception as e:
        return f"Browse error: {str(e)}"


# ─── Code Executor ───────────────────────────────────────────────────

async def execute_python_code(code: str) -> str:
    """
    Execute Python code in a restricted subprocess.
    Network access is blocked, file access limited to temp dir,
    and dangerous builtins are restricted via sys.modules blocking.
    """
    SANDBOX_HEADER = """\
import sys
import os
import tempfile

# Block network by neutering socket
import socket as _socket
class _NoSocket:
    def __init__(self, *a, **k): raise PermissionError("Network access is disabled in sandbox.")
sys.modules['socket'] = type(sys)('socket')
sys.modules['socket'].socket = _NoSocket

# Restrict file access to temp dir
_temp_dir = os.path.abspath(tempfile.gettempdir())
_builtin_open = open
def _safe_open(name, *args, **kwargs):
    resolved = os.path.abspath(str(name))
    if not resolved.startswith(_temp_dir):
        raise PermissionError(f"File access outside temp dir denied: {name}")
    return _builtin_open(name, *args, **kwargs)
import builtins
builtins.open = _safe_open

# Block dangerous modules
for _mod in ['subprocess', 'multiprocessing', 'ctypes', 'cffi', '_thread']:
    sys.modules[_mod] = None
"""

    sandboxed_code = SANDBOX_HEADER + "\n" + code

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(sandboxed_code)
        temp_path = f.name

    try:
        env = {k: v for k, v in os.environ.items()
               if k not in ("GEMINI_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY",
                            "DATABASE_URL", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY")}
        p = subprocess.Popen(
            [sys.executable, temp_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=tempfile.gettempdir(),
            env=env,
        )
        try:
            stdout, stderr = await asyncio.get_event_loop().run_in_executor(
                None, lambda: p.communicate(timeout=15.0)
            )
        except Exception:
            p.kill()
            return "Error: Code execution timed out (15s limit)."

        output = ""
        if stdout:
            output += f"STDOUT:\n{stdout[:2000]}\n"
        if stderr:
            output += f"STDERR:\n{stderr[:1000]}\n"
        return output or "Code executed successfully with no output."
    except Exception as e:
        return f"Execution error: {str(e)}"
    finally:
        try:
            os.unlink(temp_path)
        except Exception:
            pass


# ─── API Connector ───────────────────────────────────────────────────

async def execute_api_call(
    url: str, method: str = "GET", payload_json: Optional[str] = None
) -> str:
    """Make an external API call. SSRF-protected."""
    err = check_ssrf(url)
    if err:
        return f"Error: {err}"
    client = get_http_client()
    try:
        if method.upper() == "POST":
            data = json.loads(payload_json) if payload_json else {}
            r = await client.post(url, json=data)
        else:
            r = await client.get(url)
        return f"Status: {r.status_code}\nResponse: {r.text[:1500]}"
    except Exception as e:
        return f"API call failed: {str(e)}"


# ─── Memory (ChromaDB upgrade in vector_store.py) ───




async def store_memory(
    agent_id: str,
    text: str,
    api_key: str,
    session_id: Optional[str] = None,
    provider: str = "gemini",
):
    """Store a memory entry with embedding using ChromaDB."""
    from storage.vector_store import store_vector_memory
    await store_vector_memory(agent_id, text, api_key, session_id, provider)


async def query_memory(
    query: str,
    api_key: str,
    top_k: int = 2,
    agent_id: Optional[str] = None,
    session_id: Optional[str] = None,
    provider: str = "gemini",
) -> List[str]:
    """Query memories by cosine similarity using ChromaDB."""
    from storage.vector_store import query_vector_memory
    return await query_vector_memory(query, api_key, top_k, agent_id, session_id, provider)
