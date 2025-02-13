"""
Test suite for API Gateway rate limiting middleware validating rate limit enforcement,
token bucket algorithm, Redis cache integration, and performance under load.

Version: 1.0.0
"""

import pytest
import asyncio
from typing import Dict, Any
from unittest.mock import Mock, AsyncMock
import pytest_asyncio  # v0.21.0

from middleware.rate_limiter import RateLimiter
from common.cache.redis import RedisCache
from api_gateway.constants import RATE_LIMITS, TIME_WINDOWS

class TestRateLimiter:
    """Test suite for validating rate limiting functionality."""

    @pytest.fixture(autouse=True)
    async def setup_method(self, mocker):
        """Setup test environment before each test."""
        # Mock Redis cache
        self.redis_cache = Mock(spec=RedisCache)
        self.redis_cache.get = AsyncMock(return_value=None)
        self.redis_cache.set = AsyncMock(return_value=True)
        self.redis_cache.incr = AsyncMock(return_value=1)
        self.redis_cache.expire = AsyncMock(return_value=True)
        
        # Initialize rate limiter with test configuration
        self.rate_limiter = RateLimiter(
            app=Mock(),
            cache=self.redis_cache,
            rate_limits=RATE_LIMITS,
            time_windows=TIME_WINDOWS,
            burst_multiplier=1.5
        )
        
        # Mock request and response objects
        self.mock_request = Mock()
        self.mock_request.url.path = "/api/v1/linkedin_ads_campaign/create"
        self.mock_request.headers = {"X-API-Key": "test-client"}
        self.mock_request.client.host = "127.0.0.1"
        
        self.mock_response = Mock()
        self.mock_response.headers = {}

    @pytest.mark.asyncio
    async def test_rate_limit_enforcement(self):
        """Test rate limit enforcement for different endpoints."""
        # Test LinkedIn Ads campaign limit (100/min)
        self.mock_request.url.path = "/api/v1/linkedin_ads_campaign/create"
        
        # Simulate requests within limit
        for _ in range(100):
            self.redis_cache.incr.return_value = _ + 1
            is_allowed, remaining, _ = await self.rate_limiter._check_rate_limit(
                "linkedin_ads_campaign",
                "test-client"
            )
            assert is_allowed is True
            assert remaining == RATE_LIMITS["linkedin_ads_campaign"] * 1.5 - (_ + 1)
        
        # Verify rate limit exceeded
        self.redis_cache.incr.return_value = 151
        is_allowed, remaining, retry_after = await self.rate_limiter._check_rate_limit(
            "linkedin_ads_campaign",
            "test-client"
        )
        assert is_allowed is False
        assert remaining == 0
        assert retry_after > 0

    @pytest.mark.asyncio
    async def test_token_bucket_replenishment(self):
        """Test token bucket algorithm implementation."""
        endpoint = "google_ads_campaign"
        client_id = "test-client"
        
        # Consume all tokens
        self.redis_cache.incr.return_value = RATE_LIMITS[endpoint]
        await self.rate_limiter._check_rate_limit(endpoint, client_id)
        
        # Verify token replenishment after window
        await asyncio.sleep(0.1)  # Simulate time passage
        self.redis_cache.get.return_value = None  # Simulate expired window
        self.redis_cache.incr.return_value = 1
        
        is_allowed, remaining, _ = await self.rate_limiter._check_rate_limit(
            endpoint,
            client_id
        )
        assert is_allowed is True
        assert remaining == RATE_LIMITS[endpoint] * 1.5 - 1

    @pytest.mark.asyncio
    async def test_redis_integration(self):
        """Test Redis cache integration and failure handling."""
        # Test successful cache operations
        self.redis_cache.get.return_value = 5
        is_allowed, remaining, _ = await self.rate_limiter._check_rate_limit(
            "analytics",
            "test-client"
        )
        assert is_allowed is True
        assert remaining == RATE_LIMITS["analytics"] * 1.5 - 5
        
        # Test Redis connection failure
        self.redis_cache.get.side_effect = Exception("Redis connection failed")
        with pytest.raises(Exception) as exc_info:
            await self.rate_limiter._check_rate_limit("analytics", "test-client")
        assert "Redis connection failed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_performance(self):
        """Test rate limiter performance under load."""
        endpoint = "google_ads_reporting"
        client_id = "test-client"
        
        # Test concurrent requests
        async def make_request():
            return await self.rate_limiter._check_rate_limit(endpoint, client_id)
        
        # Simulate 100 concurrent requests
        tasks = [make_request() for _ in range(100)]
        results = await asyncio.gather(*tasks)
        
        # Verify all requests were processed
        assert len(results) == 100
        assert all(isinstance(r, tuple) and len(r) == 3 for r in results)
        
        # Verify response time under load
        start_time = asyncio.get_event_loop().time()
        await self.rate_limiter._check_rate_limit(endpoint, client_id)
        elapsed = asyncio.get_event_loop().time() - start_time
        assert elapsed < 0.03  # Response time under 30ms

    @pytest.mark.asyncio
    async def test_burst_handling(self):
        """Test burst traffic handling capabilities."""
        endpoint = "campaign_creation"
        client_id = "test-client"
        burst_limit = int(RATE_LIMITS[endpoint] * 1.5)
        
        # Test burst allowance
        self.redis_cache.incr.return_value = RATE_LIMITS[endpoint] + 1
        is_allowed, remaining, _ = await self.rate_limiter._check_rate_limit(
            endpoint,
            client_id
        )
        assert is_allowed is True
        assert remaining == burst_limit - (RATE_LIMITS[endpoint] + 1)
        
        # Test burst limit exceeded
        self.redis_cache.incr.return_value = burst_limit + 1
        is_allowed, remaining, retry_after = await self.rate_limiter._check_rate_limit(
            endpoint,
            client_id
        )
        assert is_allowed is False
        assert remaining == 0
        assert retry_after > 0

    @pytest.mark.asyncio
    async def test_sliding_window(self):
        """Test sliding window implementation."""
        endpoint = "audience"
        client_id = "test-client"
        
        # Test requests across window boundaries
        current_window = int(asyncio.get_event_loop().time())
        next_window = current_window + TIME_WINDOWS["per_minute"]
        
        # Simulate requests in current window
        self.redis_cache.get.return_value = RATE_LIMITS[endpoint] - 1
        is_allowed, _, _ = await self.rate_limiter._check_rate_limit(endpoint, client_id)
        assert is_allowed is True
        
        # Simulate window transition
        self.redis_cache.get.return_value = None
        is_allowed, _, _ = await self.rate_limiter._check_rate_limit(endpoint, client_id)
        assert is_allowed is True

def mock_request(endpoint: str, client_id: str, headers: Dict[str, Any] = None) -> Mock:
    """Create mock request object for testing."""
    request = Mock()
    request.url.path = f"/api/v1/{endpoint}/action"
    request.headers = headers or {"X-API-Key": client_id}
    request.client.host = "127.0.0.1"
    return request

def mock_response(status_code: int = 200, headers: Dict[str, Any] = None, 
                 body: Dict[str, Any] = None) -> Mock:
    """Create mock response object for testing."""
    response = Mock()
    response.status_code = status_code
    response.headers = headers or {}
    response.body = body or {}
    return response