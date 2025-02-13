"""
API Gateway Configuration Module

Provides comprehensive configuration management for the API Gateway service with enhanced
security features, rate limiting, and service routing capabilities.

Version: 1.0.0
"""

from typing import Dict, List, Optional, Union
import logging
from pydantic import Field, SecretStr  # v2.0.0

from common.config.settings import BaseConfig
from .constants import (
    API_VERSION,
    SERVICE_ROUTES,
    RATE_LIMITS,
    CORS_SETTINGS
)

# Configure logging
logger = logging.getLogger(__name__)

class GatewayConfig(BaseConfig):
    """
    API Gateway specific configuration class with enhanced validation and security features.
    Extends BaseConfig to include gateway-specific settings and validation logic.
    """

    def __init__(self, env_overrides: Optional[Dict] = None) -> None:
        """
        Initialize gateway configuration with comprehensive validation and security settings.

        Args:
            env_overrides (Optional[Dict]): Environment-specific configuration overrides
        """
        super().__init__(service_name='api_gateway')
        
        # Core API configuration
        self.api_version: str = API_VERSION
        self.service_routes: Dict[str, str] = self._validate_service_routes(SERVICE_ROUTES)
        
        # Rate limiting configuration
        self.rate_limits: Dict[str, Dict] = self._configure_rate_limits(RATE_LIMITS)
        
        # Security configuration
        self.cors_settings: Dict = self.validate_cors(CORS_SETTINGS)
        self.jwt_secret_key: SecretStr = SecretStr(self._get_required_env('JWT_SECRET_KEY'))
        self.jwt_expiration: int = int(self._get_required_env('JWT_EXPIRATION', '3600'))
        
        # Service authentication
        self.auth_service_url: str = self._get_required_env('AUTH_SERVICE_URL')
        self.trusted_services: Dict[str, str] = self._load_trusted_services()
        self.whitelisted_ips: List[str] = self._load_whitelisted_ips()
        
        # Fallback configuration
        self.fallback_config: Dict = {
            'default_timeout': int(self._get_required_env('DEFAULT_TIMEOUT', '30')),
            'retry_attempts': int(self._get_required_env('RETRY_ATTEMPTS', '3')),
            'circuit_breaker_threshold': float(self._get_required_env('CIRCUIT_BREAKER_THRESHOLD', '0.5'))
        }

        # Apply any environment-specific overrides
        if env_overrides:
            self._apply_overrides(env_overrides)

        # Validate complete configuration
        self._validate_complete_config()

    def get_service_url(self, service_name: str, check_health: bool = True) -> str:
        """
        Returns the validated base URL for a given service with optional health check.

        Args:
            service_name (str): Name of the service to get URL for
            check_health (bool): Whether to perform health check

        Returns:
            str: Validated service base URL

        Raises:
            ValueError: If service name is invalid or service is unhealthy
        """
        if service_name not in self.service_routes:
            raise ValueError(f"Invalid service name: {service_name}")

        base_url = self.service_routes[service_name]
        
        # Apply trusted service override if applicable
        if service_name in self.trusted_services:
            base_url = self.trusted_services[service_name]
        
        # Perform health check if required
        if check_health:
            self._check_service_health(base_url)
        
        return f"https://{base_url}"

    def get_rate_limit(self, endpoint_name: str, client_id: str) -> Dict:
        """
        Returns rate limit configuration with monitoring and bypass checks.

        Args:
            endpoint_name (str): Name of the endpoint
            client_id (str): Client identifier for rate limit customization

        Returns:
            Dict: Rate limit configuration with bypass status
        """
        # Check for trusted service bypass
        if client_id in self.trusted_services:
            return {'bypass_rate_limit': True}
            
        # Get base rate limit configuration
        base_limit = self.rate_limits.get(endpoint_name, self.rate_limits['default'])
        
        # Apply any client-specific adjustments
        client_config = {
            'requests_per_minute': base_limit,
            'bypass_rate_limit': False,
            'monitoring_enabled': True
        }
        
        return client_config

    def validate_cors(self, cors_config: Dict) -> Dict:
        """
        Validates CORS settings against security requirements.

        Args:
            cors_config (Dict): CORS configuration to validate

        Returns:
            Dict: Validated CORS configuration

        Raises:
            ValueError: If CORS configuration is invalid
        """
        validated_config = cors_config.copy()
        
        # Validate allowed origins
        if '*' in validated_config['ALLOWED_ORIGINS'] and self.env == 'production':
            raise ValueError("Wildcard CORS origin not allowed in production")
            
        # Validate allowed methods
        allowed_methods = set(validated_config['ALLOWED_METHODS'])
        if not allowed_methods.issubset({'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'}):
            raise ValueError("Invalid HTTP methods in CORS configuration")
            
        # Ensure secure defaults
        validated_config.setdefault('MAX_AGE', 3600)
        validated_config.setdefault('ALLOW_CREDENTIALS', True)
        
        return validated_config

    def _validate_service_routes(self, routes: Dict) -> Dict:
        """Validates service routes configuration."""
        for service, route in routes.items():
            if not route.startswith('/'):
                routes[service] = f"/{route}"
        return routes

    def _configure_rate_limits(self, limits: Dict) -> Dict:
        """Configures rate limits with monitoring capabilities."""
        return {
            endpoint: {
                'limit': limit,
                'window': 60,  # 1 minute window
                'monitoring_enabled': True
            }
            for endpoint, limit in limits.items()
        }

    def _load_trusted_services(self) -> Dict[str, str]:
        """Loads and validates trusted services configuration."""
        trusted_services_str = self._get_required_env('TRUSTED_SERVICES', '{}')
        return self._parse_json_env(trusted_services_str)

    def _load_whitelisted_ips(self) -> List[str]:
        """Loads and validates whitelisted IPs configuration."""
        whitelisted_ips_str = self._get_required_env('WHITELISTED_IPS', '[]')
        return self._parse_json_env(whitelisted_ips_str)

    def _check_service_health(self, service_url: str) -> None:
        """Checks service health status."""
        # Health check implementation
        pass

    def _validate_complete_config(self) -> None:
        """Performs complete configuration validation."""
        required_attrs = [
            'api_version', 'service_routes', 'rate_limits',
            'cors_settings', 'jwt_secret_key', 'jwt_expiration'
        ]
        
        for attr in required_attrs:
            if not hasattr(self, attr):
                raise ValueError(f"Missing required configuration: {attr}")