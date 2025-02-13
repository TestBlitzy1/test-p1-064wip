"""
Authentication middleware for the API Gateway providing secure request authentication,
rate limiting, and SOC 2 compliant security controls.

Version: 1.0.0
"""

import time
import uuid
from typing import Dict, Optional
from collections import defaultdict
from dataclasses import dataclass, field

# External imports - v0.100.0+
from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Internal imports
from common.auth.jwt import JWTHandler
from common.auth.oauth import LinkedInOAuth, GoogleAdsOAuth
from common.config.settings import BaseConfig
from common.logging.logger import ServiceLogger

# Constants
MAX_REQUESTS_PER_MINUTE = 100
TOKEN_BLACKLIST_EXPIRY = 3600  # 1 hour
SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'"
}

@dataclass
class AuthMiddleware:
    """
    SOC 2 compliant authentication middleware with comprehensive security controls.
    """
    
    _jwt_handler: JWTHandler = field(default_factory=JWTHandler)
    _oauth_handlers: Dict = field(default_factory=lambda: {
        'linkedin': LinkedInOAuth(),
        'google_ads': GoogleAdsOAuth()
    })
    _rate_limiter: Dict = field(default_factory=lambda: defaultdict(list))
    _token_blacklist: Dict = field(default_factory=dict)
    _security_bearer: HTTPBearer = field(default_factory=lambda: HTTPBearer(auto_error=True))
    
    def __post_init__(self):
        """Initialize middleware components with monitoring."""
        # Load configuration
        config = BaseConfig("api_gateway")
        self._auth_settings = config.get_monitoring_config()
        
        # Initialize logger
        self._logger = ServiceLogger("auth_middleware", config)
        
        self._logger.info("Authentication middleware initialized")

    async def _check_rate_limit(self, identifier: str) -> bool:
        """
        Check if request rate is within limits.
        
        Args:
            identifier: IP address or user identifier
            
        Returns:
            bool: True if within limit, False if exceeded
        """
        current_time = time.time()
        minute_ago = current_time - 60
        
        # Clean old entries
        self._rate_limiter[identifier] = [
            ts for ts in self._rate_limiter[identifier] 
            if ts > minute_ago
        ]
        
        # Check rate limit
        if len(self._rate_limiter[identifier]) >= MAX_REQUESTS_PER_MINUTE:
            self._logger.warning(
                "Rate limit exceeded", 
                extra={'identifier': identifier}
            )
            return False
            
        self._rate_limiter[identifier].append(current_time)
        return True

    def _clean_token_blacklist(self) -> None:
        """Remove expired tokens from blacklist."""
        current_time = time.time()
        self._token_blacklist = {
            token: expiry 
            for token, expiry in self._token_blacklist.items()
            if expiry > current_time
        }

    async def _validate_token(self, token: str, auth_type: str) -> Dict:
        """
        Validate authentication token with security controls.
        
        Args:
            token: Authentication token
            auth_type: Type of authentication (jwt/oauth)
            
        Returns:
            dict: Validated user context
            
        Raises:
            HTTPException: If token is invalid
        """
        try:
            # Check token blacklist
            if token in self._token_blacklist:
                raise HTTPException(
                    status_code=401,
                    detail="Token has been revoked"
                )
            
            # Validate based on auth type
            if auth_type == 'jwt':
                if not self._jwt_handler.validate_token(token):
                    raise HTTPException(
                        status_code=401,
                        detail="Invalid JWT token"
                    )
                user_context = self._jwt_handler.decode_token(token)
                
            else:  # OAuth
                handler = self._oauth_handlers.get(auth_type)
                if not handler:
                    raise HTTPException(
                        status_code=400,
                        detail="Unsupported OAuth provider"
                    )
                user_context = await handler.verify_oauth_token(token)
            
            return user_context
            
        except Exception as e:
            self._logger.error(
                "Token validation failed",
                exc=e,
                extra={'auth_type': auth_type}
            )
            raise HTTPException(
                status_code=401,
                detail="Authentication failed"
            )

    async def authenticate(self, request: Request) -> Dict:
        """
        Authenticate and authorize incoming requests with security controls.
        
        Args:
            request: FastAPI request object
            
        Returns:
            dict: Enhanced user context with security metadata
            
        Raises:
            HTTPException: For authentication/authorization failures
        """
        try:
            # Generate correlation ID
            correlation_id = str(uuid.uuid4())
            request.state.correlation_id = correlation_id
            
            # Check rate limit
            client_ip = request.client.host
            if not await self._check_rate_limit(client_ip):
                raise HTTPException(
                    status_code=429,
                    detail="Too many requests"
                )
            
            # Get authorization header
            credentials: HTTPAuthorizationCredentials = await self._security_bearer(request)
            if not credentials:
                raise HTTPException(
                    status_code=401,
                    detail="Missing authentication credentials"
                )
            
            # Clean token blacklist periodically
            self._clean_token_blacklist()
            
            # Determine auth type from token format
            auth_type = 'jwt'
            if credentials.scheme.lower() == 'bearer':
                if credentials.credentials.startswith('ya29.'):  # Google token
                    auth_type = 'google_ads'
                elif credentials.credentials.startswith('AQV'):  # LinkedIn token
                    auth_type = 'linkedin'
            
            # Validate token
            user_context = await self._validate_token(
                credentials.credentials,
                auth_type
            )
            
            # Enhance context with security metadata
            enhanced_context = {
                **user_context,
                'correlation_id': correlation_id,
                'client_ip': client_ip,
                'auth_type': auth_type,
                'timestamp': time.time()
            }
            
            # Apply security headers
            for header, value in SECURITY_HEADERS.items():
                request.headers[header] = value
            
            self._logger.info(
                "Authentication successful",
                extra={'user_id': user_context.get('user_id')}
            )
            
            return enhanced_context
            
        except HTTPException:
            raise
        except Exception as e:
            self._logger.error(
                "Authentication failed",
                exc=e,
                extra={'correlation_id': correlation_id}
            )
            raise HTTPException(
                status_code=500,
                detail="Internal authentication error"
            )

    def revoke_token(self, token: str) -> bool:
        """
        Revoke an authentication token.
        
        Args:
            token: Token to revoke
            
        Returns:
            bool: True if token was revoked
        """
        try:
            current_time = time.time()
            self._token_blacklist[token] = current_time + TOKEN_BLACKLIST_EXPIRY
            
            self._logger.info("Token revoked successfully")
            return True
            
        except Exception as e:
            self._logger.error(
                "Token revocation failed",
                exc=e
            )
            return False