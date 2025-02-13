"""
Platform configuration models for ad platform integrations with comprehensive security,
validation and monitoring capabilities for LinkedIn Ads and Google Ads platforms.
"""

from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, validator, SecretStr  # pydantic 2.0.0
from common.schemas.base import BaseSchema

# API Version Constants
LINKEDIN_API_VERSION = "v2"
GOOGLE_ADS_API_VERSION = "v14"

# Rate Limiting and Timeout Constants
DEFAULT_RETRY_ATTEMPTS = 3
DEFAULT_TIMEOUT_SECONDS = 30
MAX_RATE_LIMIT_WINDOW = 3600  # 1 hour in seconds
MIN_RATE_LIMIT_WINDOW = 60    # 1 minute in seconds

class BasePlatformConfig(BaseModel):
    """
    Enhanced base configuration for ad platform integrations with secure credential handling
    and comprehensive validation.
    """
    client_id: SecretStr
    client_secret: SecretStr
    access_token: SecretStr
    timeout_seconds: int = Field(default=DEFAULT_TIMEOUT_SECONDS, ge=1, le=300)
    max_retries: int = Field(default=DEFAULT_RETRY_ATTEMPTS, ge=1, le=10)
    audit_log: Dict[str, Any] = Field(default_factory=dict)

    @validator("client_id", "client_secret", "access_token")
    def validate_credentials(cls, v: SecretStr) -> SecretStr:
        """
        Enhanced credential validation with security checks.
        
        Args:
            v: Credential value to validate
            
        Returns:
            Validated SecretStr credential
            
        Raises:
            ValueError: If credential validation fails
        """
        secret_value = v.get_secret_value()
        
        # Validate credential length and format
        if not secret_value or len(secret_value) < 16:
            raise ValueError("Credential must be at least 16 characters long")
            
        if not any(c.isupper() for c in secret_value) or \
           not any(c.islower() for c in secret_value) or \
           not any(c.isdigit() for c in secret_value):
            raise ValueError("Credential must contain uppercase, lowercase and numeric characters")
            
        return v

    class Config:
        """Pydantic model configuration"""
        validate_assignment = True
        extra = "forbid"
        

class LinkedInAdsConfig(BasePlatformConfig):
    """
    LinkedIn Ads platform configuration with comprehensive rate limiting 
    and campaign management capabilities.
    """
    api_version: str = Field(default=LINKEDIN_API_VERSION)
    account_id: str
    rate_limits: Dict[str, Any] = Field(default_factory=lambda: {
        "campaign_creation": {
            "requests": 100,
            "window_seconds": MIN_RATE_LIMIT_WINDOW
        },
        "reporting": {
            "requests": 500,
            "window_seconds": MIN_RATE_LIMIT_WINDOW
        }
    })
    campaign_defaults: Dict[str, Any] = Field(default_factory=dict)
    performance_metrics: Dict[str, Any] = Field(default_factory=dict)

    @validator("rate_limits")
    def validate_rate_limits(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        """
        Comprehensive rate limit validation and monitoring.
        
        Args:
            v: Rate limit configuration to validate
            
        Returns:
            Validated rate limit configuration
            
        Raises:
            ValueError: If rate limit validation fails
        """
        required_keys = {"campaign_creation", "reporting"}
        if not all(key in v for key in required_keys):
            raise ValueError(f"Rate limits must include: {required_keys}")
            
        for key, config in v.items():
            if "requests" not in config or "window_seconds" not in config:
                raise ValueError(f"Invalid rate limit configuration for {key}")
                
            requests = config["requests"]
            window = config["window_seconds"]
            
            if not isinstance(requests, int) or requests <= 0:
                raise ValueError(f"Invalid request limit for {key}")
                
            if not isinstance(window, int) or \
               window < MIN_RATE_LIMIT_WINDOW or \
               window > MAX_RATE_LIMIT_WINDOW:
                raise ValueError(
                    f"Window must be between {MIN_RATE_LIMIT_WINDOW} and {MAX_RATE_LIMIT_WINDOW} seconds"
                )
                
        return v


class GoogleAdsConfig(BasePlatformConfig):
    """
    Google Ads platform configuration with enhanced security and 
    campaign management capabilities.
    """
    api_version: str = Field(default=GOOGLE_ADS_API_VERSION)
    developer_token: SecretStr
    customer_id: str
    campaign_settings: Dict[str, Any] = Field(default_factory=dict)
    performance_tracking: Dict[str, Any] = Field(default_factory=dict)

    @validator("developer_token")
    def validate_developer_token(cls, v: SecretStr) -> SecretStr:
        """
        Enhanced developer token validation with security checks.
        
        Args:
            v: Developer token to validate
            
        Returns:
            Validated developer token
            
        Raises:
            ValueError: If token validation fails
        """
        token = v.get_secret_value()
        
        # Validate token format and length
        if not token or len(token) != 32:
            raise ValueError("Developer token must be 32 characters long")
            
        # Validate token format (alphanumeric)
        if not token.isalnum():
            raise ValueError("Developer token must contain only alphanumeric characters")
            
        return v

    @validator("customer_id")
    def validate_customer_id(cls, v: str) -> str:
        """
        Validate Google Ads customer ID format.
        
        Args:
            v: Customer ID to validate
            
        Returns:
            Validated customer ID
            
        Raises:
            ValueError: If customer ID validation fails
        """
        # Remove hyphens and validate format (10 digits)
        cleaned_id = v.replace("-", "")
        if not cleaned_id.isdigit() or len(cleaned_id) != 10:
            raise ValueError("Customer ID must be a 10-digit number")
            
        return v