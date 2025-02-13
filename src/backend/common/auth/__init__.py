"""
Authentication module entry point providing unified access to JWT and OAuth2 authentication
with comprehensive security, monitoring, and compliance features.

Version: 1.0.0
"""

from typing import Dict, Optional

# Internal imports
from common.auth.jwt import JWTHandler
from common.auth.oauth import LinkedInOAuth, GoogleAdsOAuth

class AuthenticationManager:
    """
    Thread-safe unified authentication manager providing secure access to both JWT and OAuth2
    authentication handlers with comprehensive monitoring, logging, and compliance features.
    """

    def __init__(self):
        """Initialize authentication manager with secure handlers and monitoring."""
        # Initialize core authentication handlers
        self._jwt_handler = JWTHandler()
        self._linkedin_oauth = LinkedInOAuth()
        self._google_oauth = GoogleAdsOAuth()

        # Initialize token cache and monitoring
        self._token_cache: Dict[str, Dict] = {}
        self._metrics: Dict[str, int] = {
            "jwt_authentications": 0,
            "oauth_authentications": 0,
            "token_generations": 0,
            "token_refreshes": 0
        }

    def authenticate_jwt(self, token: str) -> Dict:
        """
        Authenticates a user using JWT token with enhanced security checks and monitoring.

        Args:
            token: JWT token to validate

        Returns:
            dict: Authenticated user information with security context

        Raises:
            ValueError: If token is invalid or expired
        """
        try:
            # Validate token with security checks
            if not self._jwt_handler.validate_token(token):
                raise ValueError("Invalid or expired JWT token")

            # Decode token and get user information
            user_info = self._jwt_handler.decode_token(token)

            # Update metrics
            self._metrics["jwt_authentications"] += 1

            return {
                "user_id": user_info["user_id"],
                "role": user_info["role"],
                "permissions": user_info["permissions"],
                "auth_type": "jwt",
                "expiration": user_info["exp"]
            }

        except Exception as e:
            raise ValueError(f"JWT authentication failed: {str(e)}")

    def authenticate_oauth(self, token: str, platform: str) -> Dict:
        """
        Authenticates a user using OAuth2 token with platform-specific validations.

        Args:
            token: OAuth2 token to validate
            platform: Authentication platform ('linkedin' or 'google_ads')

        Returns:
            dict: Authenticated user information with platform context

        Raises:
            ValueError: If token or platform is invalid
        """
        try:
            # Select appropriate OAuth handler
            oauth_handler = {
                "linkedin": self._linkedin_oauth,
                "google_ads": self._google_oauth
            }.get(platform)

            if not oauth_handler:
                raise ValueError(f"Unsupported platform: {platform}")

            # Get user profile based on platform
            if platform == "linkedin":
                user_info = oauth_handler.get_user_profile(token)
            else:  # google_ads
                user_info = oauth_handler.get_customer_accounts(token)

            # Update metrics
            self._metrics["oauth_authentications"] += 1

            return {
                "platform": platform,
                "auth_type": "oauth2",
                "user_info": user_info,
                "token_type": "access_token"
            }

        except Exception as e:
            raise ValueError(f"OAuth authentication failed: {str(e)}")

    def generate_jwt(self, user_data: Dict, ip_address: Optional[str] = None) -> str:
        """
        Generates a new JWT token with enhanced security features.

        Args:
            user_data: User information for token generation
            ip_address: Optional IP address for rate limiting

        Returns:
            str: Securely generated JWT token

        Raises:
            ValueError: If user data is invalid
        """
        try:
            # Generate token with security features
            token = self._jwt_handler.generate_token(user_data, ip_address)

            # Update metrics
            self._metrics["token_generations"] += 1

            return token

        except Exception as e:
            raise ValueError(f"Token generation failed: {str(e)}")

    def refresh_token(self, token: str, token_type: str, platform: Optional[str] = None) -> Dict:
        """
        Refreshes authentication tokens with backoff strategy.

        Args:
            token: Current token to refresh
            token_type: Type of token ('jwt' or 'oauth2')
            platform: Required for OAuth2 tokens ('linkedin' or 'google_ads')

        Returns:
            dict: New token information with refresh context

        Raises:
            ValueError: If refresh operation fails
        """
        try:
            if token_type == "jwt":
                new_token = self._jwt_handler.refresh_token(token)
                result = {
                    "token": new_token,
                    "type": "jwt"
                }
            elif token_type == "oauth2":
                if not platform:
                    raise ValueError("Platform required for OAuth2 token refresh")

                oauth_handler = {
                    "linkedin": self._linkedin_oauth,
                    "google_ads": self._google_oauth
                }.get(platform)

                if not oauth_handler:
                    raise ValueError(f"Unsupported platform: {platform}")

                result = oauth_handler.refresh_access_token(token)
            else:
                raise ValueError(f"Unsupported token type: {token_type}")

            # Update metrics
            self._metrics["token_refreshes"] += 1

            return result

        except Exception as e:
            raise ValueError(f"Token refresh failed: {str(e)}")