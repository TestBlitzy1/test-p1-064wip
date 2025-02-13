"""
Test suite for API Gateway authentication middleware verifying JWT/OAuth token validation,
security requirements compliance, rate limiting, and audit logging functionality.

Version: 1.0.0
"""

import pytest
import pytest_asyncio  # v0.21.0+
from fastapi.testclient import TestClient  # v0.100.0+
from unittest.mock import Mock, patch
import logging
import time
from datetime import datetime, timedelta

# Internal imports
from api_gateway.middleware.auth import AuthMiddleware, SECURITY_HEADERS
from common.auth.jwt import JWTHandler
from common.auth.oauth import LinkedInOAuth, GoogleAdsOAuth
from common.logging.logger import ServiceLogger

# Test fixtures
@pytest.fixture
def test_user_data():
    """Provides test user data for authentication tests."""
    return {
        'user_id': 'test_user_123',
        'role': 'admin',
        'permissions': ['campaign:write', 'audience:read'],
        'email': 'test@example.com'
    }

@pytest.fixture
def mock_jwt_handler():
    """Provides mocked JWT handler with predefined responses."""
    handler = Mock(spec=JWTHandler)
    handler.generate_token.return_value = 'test.jwt.token'
    handler.validate_token.return_value = True
    return handler

@pytest.fixture
def mock_oauth_handler():
    """Provides mocked OAuth handler with test responses."""
    handler = Mock(spec=LinkedInOAuth)
    handler.verify_oauth_token.return_value = True
    handler.get_user_info.return_value = {'id': 'test_user_123', 'email': 'test@example.com'}
    return handler

@pytest.fixture
async def auth_middleware():
    """Provides AuthMiddleware instance with test configuration."""
    middleware = AuthMiddleware()
    middleware._jwt_handler = Mock(spec=JWTHandler)
    middleware._oauth_handlers = {
        'linkedin': Mock(spec=LinkedInOAuth),
        'google_ads': Mock(spec=GoogleAdsOAuth)
    }
    return middleware

@pytest.mark.asyncio
class TestAuthMiddleware:
    """
    Comprehensive test suite for authentication middleware functionality including
    JWT/OAuth validation, rate limiting, security headers, and audit logging.
    """

    async def test_valid_jwt_authentication(self, auth_middleware, test_user_data):
        """Tests successful JWT token authentication with valid claims."""
        # Setup
        token = f"Bearer test.jwt.token"
        request = Mock()
        request.headers = {
            'Authorization': token,
            **SECURITY_HEADERS
        }
        request.client.host = '127.0.0.1'
        
        auth_middleware._jwt_handler.validate_token.return_value = True
        auth_middleware._jwt_handler.decode_token.return_value = test_user_data

        # Execute
        result = await auth_middleware.authenticate(request)

        # Verify
        assert result['user_id'] == test_user_data['user_id']
        assert result['role'] == test_user_data['role']
        assert 'correlation_id' in result
        assert 'client_ip' in result
        auth_middleware._jwt_handler.validate_token.assert_called_once()

    async def test_invalid_jwt_token(self, auth_middleware):
        """Tests authentication failure scenarios with invalid JWT tokens."""
        # Setup
        token = f"Bearer invalid.jwt.token"
        request = Mock()
        request.headers = {'Authorization': token}
        request.client.host = '127.0.0.1'
        
        auth_middleware._jwt_handler.validate_token.return_value = False

        # Execute and verify
        with pytest.raises(Exception) as exc_info:
            await auth_middleware.authenticate(request)
        assert "Authentication failed" in str(exc_info.value)

    async def test_oauth_authentication_linkedin(self, auth_middleware, test_user_data):
        """Tests successful LinkedIn OAuth authentication flow."""
        # Setup
        token = f"Bearer AQV_linkedin_token"
        request = Mock()
        request.headers = {
            'Authorization': token,
            **SECURITY_HEADERS
        }
        request.client.host = '127.0.0.1'
        
        linkedin_handler = auth_middleware._oauth_handlers['linkedin']
        linkedin_handler.verify_oauth_token.return_value = test_user_data

        # Execute
        result = await auth_middleware.authenticate(request)

        # Verify
        assert result['user_id'] == test_user_data['user_id']
        assert 'auth_type' in result and result['auth_type'] == 'linkedin'
        linkedin_handler.verify_oauth_token.assert_called_once()

    async def test_oauth_authentication_google(self, auth_middleware, test_user_data):
        """Tests successful Google Ads OAuth authentication flow."""
        # Setup
        token = f"Bearer ya29.google_token"
        request = Mock()
        request.headers = {
            'Authorization': token,
            **SECURITY_HEADERS
        }
        request.client.host = '127.0.0.1'
        
        google_handler = auth_middleware._oauth_handlers['google_ads']
        google_handler.verify_oauth_token.return_value = test_user_data

        # Execute
        result = await auth_middleware.authenticate(request)

        # Verify
        assert result['user_id'] == test_user_data['user_id']
        assert 'auth_type' in result and result['auth_type'] == 'google_ads'
        google_handler.verify_oauth_token.assert_called_once()

    async def test_rate_limit_exceeded(self, auth_middleware):
        """Tests rate limiting functionality for authentication requests."""
        # Setup
        token = f"Bearer test.jwt.token"
        request = Mock()
        request.headers = {'Authorization': token}
        request.client.host = '127.0.0.1'

        # Execute multiple requests to trigger rate limit
        for _ in range(100):  # MAX_REQUESTS_PER_MINUTE
            auth_middleware._rate_limiter[request.client.host].append(time.time())

        # Verify rate limit exceeded
        with pytest.raises(Exception) as exc_info:
            await auth_middleware.authenticate(request)
        assert "Too many requests" in str(exc_info.value)

    async def test_missing_security_headers(self, auth_middleware):
        """Tests validation of required security headers."""
        # Setup
        token = f"Bearer test.jwt.token"
        request = Mock()
        request.headers = {'Authorization': token}  # Missing security headers
        request.client.host = '127.0.0.1'

        # Execute
        result = await auth_middleware.authenticate(request)

        # Verify security headers were added
        for header, value in SECURITY_HEADERS.items():
            assert request.headers.get(header) == value

    async def test_token_blacklist(self, auth_middleware):
        """Tests token blacklisting functionality."""
        # Setup
        token = "test.jwt.token"
        auth_middleware._token_blacklist[token] = time.time() + 3600

        # Execute and verify
        assert auth_middleware.revoke_token(token)
        assert token in auth_middleware._token_blacklist

    async def test_audit_logging(self, auth_middleware, test_user_data):
        """Tests audit logging of authentication events."""
        # Setup
        token = f"Bearer test.jwt.token"
        request = Mock()
        request.headers = {
            'Authorization': token,
            **SECURITY_HEADERS
        }
        request.client.host = '127.0.0.1'
        
        auth_middleware._jwt_handler.validate_token.return_value = True
        auth_middleware._jwt_handler.decode_token.return_value = test_user_data

        # Execute with log capture
        with patch.object(logging.getLogger('auth_middleware'), 'info') as mock_log:
            result = await auth_middleware.authenticate(request)

        # Verify logging
        mock_log.assert_called_with(
            "Authentication successful",
            extra={'user_id': test_user_data['user_id']}
        )