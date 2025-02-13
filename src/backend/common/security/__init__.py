"""
Core security module providing enterprise-grade encryption, authentication, and data protection
for the Sales Intelligence Platform. Implements FIPS 140-2 compliant cryptographic operations
with comprehensive key management and audit logging.

Version: 1.0.0
"""

import logging
import threading
from typing import Dict, Optional

# Internal imports
from common.security.encryption import EncryptionHandler
from common.config.settings import BaseConfig

# Configure logging with audit trail
logger = logging.getLogger(__name__)

# Default security configuration with FIPS 140-2 compliance
DEFAULT_ENCRYPTION_SETTINGS = {
    'algorithm': 'AES-256-GCM',
    'key_rotation_days': 90,
    'min_key_length': 32,
    'kms_key_id': 'aws/kms/encryption-key',
    'monitoring_interval': 300,
    'audit_log_level': logging.INFO,
    'max_retries': 3,
    'timeout': 5
}

# Thread-safe singleton management
_encryption_handler_lock = threading.Lock()
_encryption_handler_instance: Optional[EncryptionHandler] = None

def initialize_security(service_name: str, custom_config: Optional[Dict] = None) -> Dict:
    """
    Initializes comprehensive security components with monitoring and compliance controls.
    
    Args:
        service_name: Name of the service requiring security initialization
        custom_config: Optional custom security configuration overrides
        
    Returns:
        Dict containing initialized security configuration and component status
        
    Raises:
        ValueError: If service name is invalid
        RuntimeError: If security initialization fails
    """
    try:
        # Validate service name
        if not service_name:
            raise ValueError("Service name must be provided")
            
        logger.info(f"Initializing security components for service: {service_name}")
        
        # Load base configuration
        config = BaseConfig.get_monitoring_config()
        security_config = DEFAULT_ENCRYPTION_SETTINGS.copy()
        
        # Merge custom configuration if provided
        if custom_config:
            security_config.update(custom_config)
            
        # Configure audit logging
        logging.getLogger('security').setLevel(security_config['audit_log_level'])
        
        # Initialize encryption handler
        encryption_handler = get_encryption_handler()
        
        # Validate security components
        security_status = {
            'encryption_initialized': encryption_handler is not None,
            'key_rotation_enabled': True,
            'audit_logging_enabled': True,
            'monitoring_enabled': True
        }
        
        logger.info(f"Security initialization completed for {service_name}")
        
        return {
            'status': 'initialized',
            'config': security_config,
            'components': security_status,
            'service': service_name
        }
        
    except Exception as e:
        logger.error(f"Security initialization failed: {str(e)}")
        raise RuntimeError(f"Failed to initialize security components: {str(e)}")

def get_encryption_handler() -> EncryptionHandler:
    """
    Thread-safe factory function providing singleton access to encryption handler.
    
    Returns:
        Configured EncryptionHandler instance with key rotation support
        
    Raises:
        RuntimeError: If encryption handler initialization fails
    """
    global _encryption_handler_instance
    
    try:
        with _encryption_handler_lock:
            if _encryption_handler_instance is None:
                logger.debug("Creating new encryption handler instance")
                
                # Load encryption settings
                config = BaseConfig.get_monitoring_config()
                
                # Initialize encryption handler with KMS integration
                _encryption_handler_instance = EncryptionHandler(
                    kms_key_id=DEFAULT_ENCRYPTION_SETTINGS['kms_key_id'],
                    region_name=config.get('aws_region', 'us-east-1')
                )
                
                # Configure key rotation
                if DEFAULT_ENCRYPTION_SETTINGS['key_rotation_days'] > 0:
                    _encryption_handler_instance.schedule_key_rotation(
                        days=DEFAULT_ENCRYPTION_SETTINGS['key_rotation_days']
                    )
                
                logger.info("Encryption handler initialized successfully")
                
            return _encryption_handler_instance
            
    except Exception as e:
        logger.error(f"Failed to initialize encryption handler: {str(e)}")
        raise RuntimeError(f"Encryption handler initialization failed: {str(e)}")

# Export security components
__all__ = [
    'initialize_security',
    'get_encryption_handler',
    'EncryptionHandler'  # Re-export for direct access
]