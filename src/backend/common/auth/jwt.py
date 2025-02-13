"""
Enterprise-grade JWT authentication module providing secure token management with encryption,
rate limiting, and SOC 2 compliance features.

Version: 1.0.0
"""

from datetime import datetime, timedelta
from typing import Dict, Optional
import logging
from jose import jwt, JWTError, ExpiredSignatureError
from time import time
from collections import defaultdict

# Internal imports
from common.config.settings import BaseConfig
from common.security.encryption import EncryptionService

# Configure logging
logger = logging.getLogger(__name__)

# Constants
TOKEN_EXPIRY = 3600  # 1 hour in seconds
ALGORITHM = "HS256"
MAX_TOKEN_GENERATION_RATE = 100  # Tokens per minute
TOKEN_BLACKLIST_EXPIRY = 86400  # 24 hours in seconds

class JWTHandler:
    """
    Handles JWT token operations with enhanced security features including encryption,
    rate limiting, and token blacklisting for SOC 2 compliance.
    """

    def __init__(self):
        """Initialize JWT handler with security configuration."""
        try:
            # Load configuration
            config = BaseConfig("auth_service")
            auth_settings = config.get_monitoring_config()
            
            # Initialize security components
            self._secret_key = auth_settings.get("jwt_secret_key")
            if not self._secret_key:
                raise ValueError("JWT secret key not configured")
            
            self._algorithm = ALGORITHM
            self._token_expiry = TOKEN_EXPIRY
            
            # Initialize encryption service
            self._encryption_handler = EncryptionService(
                kms_key_id=auth_settings.get("kms_key_id"),
                region_name=auth_settings.get("aws_region")
            )
            
            # Initialize token blacklist and rate limiting
            self._token_blacklist = {}  # {token: expiry_timestamp}
            self._rate_limit_counter = defaultdict(list)  # {ip: [timestamps]}
            
            logger.info("JWT Handler initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize JWT Handler: {str(e)}")
            raise

    def _check_rate_limit(self, ip_address: str) -> bool:
        """
        Check if token generation rate limit is exceeded.
        
        Args:
            ip_address: Client IP address
            
        Returns:
            bool: True if within limit, False if exceeded
        """
        current_time = time()
        minute_ago = current_time - 60
        
        # Clean old entries
        self._rate_limit_counter[ip_address] = [
            ts for ts in self._rate_limit_counter[ip_address] 
            if ts > minute_ago
        ]
        
        # Check rate limit
        if len(self._rate_limit_counter[ip_address]) >= MAX_TOKEN_GENERATION_RATE:
            logger.warning(f"Rate limit exceeded for IP: {ip_address}")
            return False
            
        self._rate_limit_counter[ip_address].append(current_time)
        return True

    def generate_token(self, user_data: Dict, ip_address: Optional[str] = None) -> str:
        """
        Generate an encrypted JWT token with rate limiting.
        
        Args:
            user_data: User information to encode in token
            ip_address: Optional client IP for rate limiting
            
        Returns:
            str: Encrypted JWT token
            
        Raises:
            ValueError: If user data is invalid
            RateLimitExceeded: If token generation limit is exceeded
        """
        try:
            # Rate limiting check
            if ip_address and not self._check_rate_limit(ip_address):
                raise ValueError("Token generation rate limit exceeded")
            
            # Validate user data
            required_fields = {"user_id", "role", "permissions"}
            if not all(field in user_data for field in required_fields):
                raise ValueError("Missing required user data fields")
            
            # Create token payload with security claims
            current_time = datetime.utcnow()
            payload = {
                **user_data,
                "iat": current_time,
                "exp": current_time + timedelta(seconds=self._token_expiry),
                "jti": f"{user_data['user_id']}_{int(time())}",
                "iss": "sales_intelligence_platform",
                "aud": "api_gateway"
            }
            
            # Generate token
            token = jwt.encode(
                payload,
                self._secret_key,
                algorithm=self._algorithm
            )
            
            # Encrypt token
            encrypted_token = self._encryption_handler.encrypt(token)
            
            logger.info(f"Generated token for user: {user_data['user_id']}")
            return encrypted_token
            
        except Exception as e:
            logger.error(f"Token generation failed: {str(e)}")
            raise

    def validate_token(self, encrypted_token: str) -> bool:
        """
        Validate an encrypted JWT token.
        
        Args:
            encrypted_token: Encrypted JWT token to validate
            
        Returns:
            bool: Token validity status
        """
        try:
            # Check blacklist
            if encrypted_token in self._token_blacklist:
                logger.warning("Attempt to use blacklisted token")
                return False
            
            # Decrypt token
            token = self._encryption_handler.decrypt(encrypted_token)
            
            # Verify token
            payload = jwt.decode(
                token,
                self._secret_key,
                algorithms=[self._algorithm],
                audience="api_gateway",
                issuer="sales_intelligence_platform"
            )
            
            # Validate claims
            current_time = datetime.utcnow().timestamp()
            if payload["exp"] < current_time:
                logger.warning("Expired token detected")
                return False
                
            return True
            
        except ExpiredSignatureError:
            logger.warning("Token has expired")
            return False
        except JWTError as e:
            logger.error(f"Token validation failed: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Token validation error: {str(e)}")
            return False

    def decode_token(self, encrypted_token: str) -> Dict:
        """
        Decode and return claims from an encrypted token.
        
        Args:
            encrypted_token: Encrypted JWT token to decode
            
        Returns:
            dict: Validated token claims
            
        Raises:
            JWTError: If token is invalid
        """
        try:
            # Decrypt token
            token = self._encryption_handler.decrypt(encrypted_token)
            
            # Decode and verify
            payload = jwt.decode(
                token,
                self._secret_key,
                algorithms=[self._algorithm],
                audience="api_gateway",
                issuer="sales_intelligence_platform"
            )
            
            return {
                "user_id": payload["user_id"],
                "role": payload["role"],
                "permissions": payload["permissions"],
                "exp": payload["exp"]
            }
            
        except Exception as e:
            logger.error(f"Token decoding failed: {str(e)}")
            raise

    def refresh_token(self, encrypted_token: str) -> str:
        """
        Generate a new token with refreshed expiration.
        
        Args:
            encrypted_token: Current encrypted token
            
        Returns:
            str: New encrypted token
            
        Raises:
            JWTError: If current token is invalid
        """
        try:
            # Validate current token
            if not self.validate_token(encrypted_token):
                raise JWTError("Invalid token for refresh")
            
            # Get current claims
            claims = self.decode_token(encrypted_token)
            
            # Blacklist old token
            self.revoke_token(encrypted_token)
            
            # Generate new token
            return self.generate_token(claims)
            
        except Exception as e:
            logger.error(f"Token refresh failed: {str(e)}")
            raise

    def revoke_token(self, encrypted_token: str) -> bool:
        """
        Revoke a token by adding it to the blacklist.
        
        Args:
            encrypted_token: Token to revoke
            
        Returns:
            bool: Revocation success status
        """
        try:
            current_time = time()
            
            # Clean expired entries
            self._token_blacklist = {
                token: expiry 
                for token, expiry in self._token_blacklist.items()
                if expiry > current_time
            }
            
            # Add token to blacklist
            self._token_blacklist[encrypted_token] = current_time + TOKEN_BLACKLIST_EXPIRY
            
            logger.info("Token successfully revoked")
            return True
            
        except Exception as e:
            logger.error(f"Token revocation failed: {str(e)}")
            return False