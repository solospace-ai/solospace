import pytest
from unittest.mock import AsyncMock, patch
from core import planner

@pytest.mark.asyncio
async def test_route_request_trivial():
    # Mock call_provider_json to return TRIVIAL classification
    with patch("core.planner.call_provider_json", new_callable=AsyncMock) as mock_call:
        mock_call.return_value = {
            "category": "TRIVIAL",
            "confidence": 0.95,
            "reason": "greetings and simple math"
        }
        category = await planner.route_request("hello", "gemini", "mock-key")
        assert category == "TRIVIAL"
        mock_call.assert_called_once()

@pytest.mark.asyncio
async def test_route_request_low_confidence_escalation():
    # Mock call_provider_json to return TRIVIAL with low confidence
    with patch("core.planner.call_provider_json", new_callable=AsyncMock) as mock_call:
        mock_call.return_value = {
            "category": "TRIVIAL",
            "confidence": 0.45,
            "reason": "simple statement but low confidence"
        }
        # Low confidence TRIVIAL should escalate to TOOL_USE
        category = await planner.route_request("run code for me", "gemini", "mock-key")
        assert category == "TOOL_USE"

@pytest.mark.asyncio
async def test_route_request_fallback_on_exception():
    # Mock call_provider_json to raise an exception
    with patch("core.planner.call_provider_json", side_effect=Exception("API failure")):
        # Should fallback to COMPLEX on any error
        category = await planner.route_request("hello", "gemini", "mock-key")
        assert category == "COMPLEX"
