"""
Comprehensive test suite for LinkedIn Ads adapter implementation validating campaign creation,
management, and performance data retrieval functionality.

Version: 1.0.0
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any
from uuid import uuid4

from aioresponses import aioresponses  # v0.7.4
from integration_service.adapters.linkedin_ads import LinkedInAdsAdapter
from integration_service.models.platform_config import LinkedInAdsConfig

# Test configuration constants
TEST_CREDENTIALS = {
    "client_id": "test-client-id",
    "client_secret": "test-client-secret",
    "access_token": "test-access-token",
    "account_id": "test-account-id",
    "api_version": "202401"
}

TEST_CAMPAIGN_DATA = {
    "name": "Test B2B Campaign",
    "objective": "LEAD_GENERATION",
    "budget": 5000,
    "start_date": "2024-01-01",
    "end_date": "2024-12-31",
    "targeting": {
        "industries": ["SOFTWARE", "TECHNOLOGY"],
        "company_size": ["50-200", "201-500", "501-1000"],
        "job_titles": ["CTO", "VP Engineering", "Technical Director"]
    }
}

class TestLinkedInAdsAdapter:
    """Comprehensive test suite for LinkedIn Ads adapter functionality."""

    @pytest.fixture(autouse=True)
    async def setup(self):
        """Setup test fixtures and mocks."""
        self.config = LinkedInAdsConfig(**TEST_CREDENTIALS)
        self.adapter = LinkedInAdsAdapter(self.config)
        self.mock_api = aioresponses()
        self.mock_api.start()
        self.correlation_id = str(uuid4())
        yield
        self.mock_api.stop()
        await self.adapter._session.close()

    @pytest.mark.asyncio
    async def test_linkedin_ads_adapter_initialization(self):
        """Test successful adapter initialization with security validation."""
        adapter = LinkedInAdsAdapter(self.config)
        
        assert adapter._config.account_id == TEST_CREDENTIALS["account_id"]
        assert adapter._config.api_version == TEST_CREDENTIALS["api_version"]
        assert adapter._session is not None
        assert "Authorization" in adapter._session._default_headers
        assert "X-Restli-Protocol-Version" in adapter._session._default_headers
        
        # Verify secure credential handling
        assert adapter._config.client_secret.get_secret_value() == TEST_CREDENTIALS["client_secret"]
        assert adapter._config.access_token.get_secret_value() == TEST_CREDENTIALS["access_token"]

    @pytest.mark.asyncio
    async def test_create_campaign_success(self):
        """Test successful campaign creation with comprehensive validation."""
        campaign_id = "test-campaign-123"
        api_url = f"https://api.linkedin.com/v2/adAccounts/{TEST_CREDENTIALS['account_id']}/campaigns"
        
        self.mock_api.post(
            api_url,
            status=201,
            payload={"id": campaign_id}
        )

        result = await self.adapter.create_campaign(
            campaign_data=TEST_CAMPAIGN_DATA,
            correlation_id=self.correlation_id
        )

        assert result == campaign_id
        
        # Verify API request format
        request = self.mock_api.requests[("POST", api_url)][0]
        request_json = await request.json()
        
        assert request_json["name"] == TEST_CAMPAIGN_DATA["name"]
        assert request_json["objective"] == TEST_CAMPAIGN_DATA["objective"]
        assert request_json["account"] == f"urn:li:sponsoredAccount:{TEST_CREDENTIALS['account_id']}"
        assert "targeting" in request_json

    @pytest.mark.asyncio
    async def test_get_campaign_performance(self):
        """Test retrieval and validation of campaign performance metrics."""
        campaign_id = "test-campaign-123"
        api_url = f"https://api.linkedin.com/v2/adAccounts/{TEST_CREDENTIALS['account_id']}/analytics"
        
        mock_metrics = {
            "elements": [{
                "metrics": [
                    {"name": "impressions", "value": 10000},
                    {"name": "clicks", "value": 250},
                    {"name": "conversions", "value": 25}
                ]
            }]
        }
        
        self.mock_api.get(
            api_url,
            status=200,
            payload=mock_metrics
        )

        metrics_config = {
            "start_date": (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d"),
            "end_date": datetime.now().strftime("%Y-%m-%d"),
            "metrics": ["impressions", "clicks", "conversions"]
        }

        result = await self.adapter.get_campaign_performance(
            campaign_id=campaign_id,
            metrics_config=metrics_config,
            correlation_id=self.correlation_id
        )

        assert result["impressions"] == 10000
        assert result["clicks"] == 250
        assert result["conversions"] == 25

        # Verify analytics request format
        request = self.mock_api.requests[("GET", api_url)][0]
        assert "campaigns[0]" in request.kwargs["params"]
        assert request.kwargs["params"]["fields"] == "impressions,clicks,conversions"

    @pytest.mark.asyncio
    async def test_rate_limit_handling(self):
        """Test rate limit handling with exponential backoff."""
        api_url = f"https://api.linkedin.com/v2/adAccounts/{TEST_CREDENTIALS['account_id']}/campaigns"
        
        # Mock rate limit response
        self.mock_api.post(
            api_url,
            status=429,
            headers={"Retry-After": "2"},
            repeat=True
        )

        with pytest.raises(Exception) as exc_info:
            await self.adapter.create_campaign(
                campaign_data=TEST_CAMPAIGN_DATA,
                correlation_id=self.correlation_id
            )

        assert "rate limit exceeded" in str(exc_info.value).lower()
        
        # Verify retry attempts
        requests = self.mock_api.requests[("POST", api_url)]
        assert len(requests) == 3  # Default retry attempts

    @pytest.mark.asyncio
    async def test_error_handling(self):
        """Test comprehensive error handling scenarios."""
        api_url = f"https://api.linkedin.com/v2/adAccounts/{TEST_CREDENTIALS['account_id']}/campaigns"
        
        error_scenarios = [
            (400, "Invalid campaign data", ValueError),
            (401, "Invalid access token", ValueError),
            (403, "Insufficient permissions", ValueError),
            (500, "Internal server error", Exception)
        ]

        for status, message, exception_type in error_scenarios:
            self.mock_api.post(
                api_url,
                status=status,
                payload={"message": message}
            )

            with pytest.raises(exception_type) as exc_info:
                await self.adapter.create_campaign(
                    campaign_data=TEST_CAMPAIGN_DATA,
                    correlation_id=self.correlation_id
                )

            assert message.lower() in str(exc_info.value).lower()
            self.mock_api.clear()

    @pytest.mark.asyncio
    async def test_update_campaign(self):
        """Test campaign update functionality."""
        campaign_id = "test-campaign-123"
        api_url = f"https://api.linkedin.com/v2/adAccounts/{TEST_CREDENTIALS['account_id']}/campaigns/{campaign_id}"
        
        update_data = {
            "status": "PAUSED",
            "budget": 6000
        }

        self.mock_api.patch(
            api_url,
            status=200,
            payload={"success": True}
        )

        result = await self.adapter.update_campaign(
            campaign_id=campaign_id,
            updates=update_data,
            correlation_id=self.correlation_id
        )

        assert result is True
        
        # Verify update request format
        request = self.mock_api.requests[("PATCH", api_url)][0]
        request_json = await request.json()
        assert request_json["status"] == update_data["status"]
        assert request_json["budget"] == update_data["budget"]