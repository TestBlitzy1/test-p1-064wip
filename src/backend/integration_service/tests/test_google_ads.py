import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch
from google.ads.googleads.errors import GoogleAdsException
from tenacity import RetryError

from integration_service.adapters.google_ads import GoogleAdsAdapter
from integration_service.models.platform_config import GoogleAdsConfig

# Test constants with secure credentials
MOCK_CREDENTIALS = {
    'client_id': 'test_client_id_123456789abc',
    'client_secret': 'test_client_secret_ABC123xyz789',
    'developer_token': 'test1234ABCD5678EFGH9012IJKL3456MNOP',
    'access_token': 'test_access_token_987654321zyx',
    'customer_id': '1234567890',
    'refresh_token': 'test_refresh_token_456789abc123'
}

# Test campaign data matching Google Ads structure
MOCK_CAMPAIGN_DATA = {
    'name': 'B2B SaaS Campaign Q4',
    'budget': {
        'amount': 1000.00,
        'type': 'DAILY'
    },
    'targeting': {
        'locations': ['US', 'CA'],
        'languages': ['en'],
        'demographics': {
            'age_range': ['25-54'],
            'industries': ['Technology', 'SaaS']
        }
    },
    'ad_groups': [{
        'name': 'Enterprise Solutions',
        'cpc_bid': 2.50,
        'ads': [{
            'headline': 'Enterprise SaaS Solutions',
            'description': 'Boost Your B2B Sales by 300%'
        }]
    }]
}

# Test performance metrics data
MOCK_PERFORMANCE_DATA = {
    'metrics': {
        'impressions': 1000,
        'clicks': 100,
        'conversions': 10,
        'cost_micros': 500000000
    },
    'segments': {
        'date': datetime.now().strftime('%Y-%m-%d')
    }
}

class TestGoogleAdsAdapter:
    """
    Comprehensive test suite for GoogleAdsAdapter with security, performance,
    and error handling validation.
    """
    
    @pytest.fixture(autouse=True)
    async def setup(self):
        """Setup test environment with secure configuration."""
        # Initialize secure configuration
        self.config = GoogleAdsConfig(
            client_id=MOCK_CREDENTIALS['client_id'],
            client_secret=MOCK_CREDENTIALS['client_secret'],
            developer_token=MOCK_CREDENTIALS['developer_token'],
            access_token=MOCK_CREDENTIALS['access_token'],
            customer_id=MOCK_CREDENTIALS['customer_id']
        )
        
        # Initialize adapter with mocked dependencies
        self.mock_client = Mock()
        self.mock_service = Mock()
        self.mock_client.get_service.return_value = self.mock_service
        
        with patch('google.ads.googleads.client.GoogleAdsClient') as mock_client_class:
            mock_client_class.load_from_dict.return_value = self.mock_client
            self.adapter = GoogleAdsAdapter(self.config)
            
        # Initialize metrics cache
        self.adapter._metrics_cache = {}
        
        yield
        
        # Cleanup sensitive data
        self.adapter._metrics_cache.clear()

    @pytest.mark.asyncio
    async def test_adapter_initialization(self):
        """Test secure adapter initialization and configuration validation."""
        assert self.adapter._config.customer_id == MOCK_CREDENTIALS['customer_id']
        assert self.adapter._client is not None
        assert self.adapter._metrics_cache == {}
        
        # Verify secure credential handling
        assert not hasattr(self.adapter, '_raw_credentials')
        assert isinstance(self.adapter._config.developer_token, str)

    @pytest.mark.asyncio
    async def test_create_campaign_success(self):
        """Test successful campaign creation with validation."""
        # Setup mock response
        campaign_id = '1234567890'
        mock_response = Mock()
        mock_response.results = [Mock(resource_name=campaign_id)]
        self.mock_service.mutate_campaigns.return_value = mock_response
        
        # Execute campaign creation
        result = await self.adapter.create_campaign(MOCK_CAMPAIGN_DATA)
        
        # Verify campaign creation
        assert result == campaign_id
        self.mock_service.mutate_campaigns.assert_called_once()
        
        # Verify data transformation
        call_args = self.mock_service.mutate_campaigns.call_args[1]
        assert call_args['customer_id'] == MOCK_CREDENTIALS['customer_id']
        assert len(call_args['operations']) == 1

    @pytest.mark.asyncio
    async def test_create_campaign_rate_limit(self):
        """Test rate limit handling during campaign creation."""
        # Setup rate limit error
        error_response = Mock()
        error_response.failure.errors = [
            Mock(error_code=Mock(rate_limit_error=Mock()))
        ]
        self.mock_service.mutate_campaigns.side_effect = GoogleAdsException(
            error_response, Mock(), Mock()
        )
        
        # Attempt campaign creation
        with pytest.raises(RetryError):
            await self.adapter.create_campaign(MOCK_CAMPAIGN_DATA)
        
        # Verify retry attempts
        assert self.mock_service.mutate_campaigns.call_count == 3

    @pytest.mark.asyncio
    async def test_get_campaign_performance(self):
        """Test campaign performance metrics retrieval and caching."""
        campaign_id = '1234567890'
        
        # Setup mock response
        mock_response = Mock()
        mock_response.results = [Mock(metrics=MOCK_PERFORMANCE_DATA['metrics'])]
        self.mock_service.search.return_value = mock_response
        
        # First call - should hit API
        result = await self.adapter.get_campaign_performance(
            campaign_id,
            {'metrics': ['impressions', 'clicks', 'conversions', 'cost_micros']}
        )
        
        # Verify API call and response
        assert result['impressions'] == MOCK_PERFORMANCE_DATA['metrics']['impressions']
        assert result['clicks'] == MOCK_PERFORMANCE_DATA['metrics']['clicks']
        self.mock_service.search.assert_called_once()
        
        # Second call - should use cache
        cached_result = await self.adapter.get_campaign_performance(
            campaign_id,
            {'metrics': ['impressions', 'clicks', 'conversions', 'cost_micros']}
        )
        
        # Verify cache hit
        assert self.mock_service.search.call_count == 1
        assert cached_result == result

    @pytest.mark.asyncio
    async def test_update_campaign(self):
        """Test campaign update functionality with validation."""
        campaign_id = '1234567890'
        updates = {
            'status': 'PAUSED',
            'budget': {'amount': 2000.00}
        }
        
        # Setup mock response
        mock_response = Mock()
        mock_response.results = [Mock(resource_name=campaign_id)]
        self.mock_service.mutate_campaigns.return_value = mock_response
        
        # Execute update
        result = await self.adapter.update_campaign(campaign_id, updates)
        
        # Verify update
        assert result['campaign_id'] == campaign_id
        assert result['status'] == 'success'
        assert 'timestamp' in result
        self.mock_service.mutate_campaigns.assert_called_once()

    @pytest.mark.asyncio
    async def test_validation_error_handling(self):
        """Test handling of validation errors."""
        invalid_data = {
            'name': 'Invalid Campaign',
            # Missing required fields
        }
        
        with pytest.raises(ValueError) as exc_info:
            await self.adapter.create_campaign(invalid_data)
        
        assert 'Missing required fields' in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_api_error_handling(self):
        """Test handling of Google Ads API errors."""
        # Setup API error
        error_response = Mock()
        error_response.failure.errors = [
            Mock(
                message='API Error',
                error_code=Mock(authentication_error=Mock()),
                trigger=Mock(string_value='Invalid credentials')
            )
        ]
        self.mock_service.mutate_campaigns.side_effect = GoogleAdsException(
            error_response, Mock(), Mock()
        )
        
        with pytest.raises(GoogleAdsException) as exc_info:
            await self.adapter.create_campaign(MOCK_CAMPAIGN_DATA)
        
        assert 'API Error' in str(exc_info.value)