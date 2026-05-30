import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from providers import get_provider_config, resolve_api_key, fetch_models_from_provider

def test_ollama_cloud_config():
    config = get_provider_config("ollama_cloud")
    assert config is not None
    assert config["name"] == "Ollama Cloud"
    assert config["base_url"] == "https://ollama.com/v1"
    assert config["adapter"] == "openai"
    assert "chat" in config["capabilities"]
    assert "streaming" in config["capabilities"]

def test_ollama_cloud_resolve_api_key():
    # User key
    key = resolve_api_key("ollama_cloud", user_key="user-test-key")
    assert key == "user-test-key"

    # API keys dict
    key = resolve_api_key("ollama_cloud", api_keys={"ollama_cloud": "dict-test-key"})
    assert key == "dict-test-key"

    # Environment variable fallback
    with patch.dict("os.environ", {"OLLAMA_API_KEY": "env-test-key"}):
        key = resolve_api_key("ollama_cloud")
        assert key == "env-test-key"

@pytest.mark.asyncio
async def test_ollama_cloud_fetch_models():
    mock_response = {
        "models": [
            {"name": "llama3:latest"},
            {"name": "mistral:latest"},
        ]
    }
    
    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client_cls.return_value = mock_client
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__ = AsyncMock()

        # Mock the get call response
        mock_resp = AsyncMock()
        mock_resp.status_code = 200
        mock_resp.json = MagicMock(return_value=mock_response)
        mock_client.get.return_value = mock_resp

        models = await fetch_models_from_provider("ollama_cloud", "mock-api-key")
        
        assert len(models) == 2
        assert models[0]["id"] == "llama3:latest"
        assert models[0]["name"] == "llama3:latest"
        assert models[0]["tier"] == "cloud"
        assert models[1]["id"] == "mistral:latest"
        assert models[1]["name"] == "mistral:latest"
        assert models[1]["tier"] == "cloud"

        # Verify client.get called with correct URL and headers
        mock_client.get.assert_called_once_with("https://ollama.com/api/tags", headers={"Authorization": "Bearer mock-api-key"})
