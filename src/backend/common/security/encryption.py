"""
Enterprise-grade encryption service providing FIPS 140-2 compliant cryptographic operations
for securing sensitive data across the Sales and Intelligence Platform.

Version: 1.0.0
"""

import base64
import logging
from dataclasses import dataclass
from threading import Lock
from typing import Dict, Optional, Union

# External package imports with versions
import boto3  # v1.28.0
from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # v41.0.0
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.exceptions import InvalidTag

# Internal imports
from common.config.settings import BaseConfig

# Global constants
ENCRYPTION_ALGORITHM = "AES-256-GCM"
KEY_LENGTH = 32  # 256 bits
IV_LENGTH = 12  # 96 bits for GCM
TAG_LENGTH = 16  # 128 bits
KEY_ROTATION_INTERVAL = 90  # days

# Configure logging
logger = logging.getLogger(__name__)

def generate_key(length: int) -> bytes:
    """
    Generates a FIPS 140-2 compliant cryptographically secure random key.
    
    Args:
        length: Length of the key in bytes
        
    Returns:
        bytes: Cryptographically secure random key
    """
    try:
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=length,
            salt=AESGCM.generate_key(KEY_LENGTH),
            iterations=100000,
        )
        key = kdf.derive(AESGCM.generate_key(length))
        return key
    except Exception as e:
        logger.error(f"Failed to generate key: {str(e)}")
        raise

def generate_iv() -> bytes:
    """
    Generates a cryptographically secure random initialization vector.
    
    Returns:
        bytes: Random IV of IV_LENGTH bytes
    """
    try:
        return AESGCM.generate_key(IV_LENGTH)
    except Exception as e:
        logger.error(f"Failed to generate IV: {str(e)}")
        raise

@dataclass
class EncryptionService:
    """Thread-safe encryption service using AES-256-GCM with AWS KMS integration."""
    
    def __init__(self, kms_key_id: str, region_name: str):
        """
        Initialize encryption service with KMS integration.
        
        Args:
            kms_key_id: AWS KMS key identifier
            region_name: AWS region name
        """
        self._lock = Lock()
        self._key_cache: Dict[str, bytes] = {}
        self._metrics: Dict[str, int] = {"encryptions": 0, "decryptions": 0}
        
        try:
            self._kms_client = boto3.client(
                'kms',
                region_name=region_name,
                config=boto3.Config(
                    retries=dict(max_attempts=3),
                    connect_timeout=5,
                    read_timeout=5
                )
            )
            
            # Initialize master key from KMS
            response = self._kms_client.generate_data_key(
                KeyId=kms_key_id,
                KeySpec='AES_256'
            )
            self._key = response['Plaintext']
            self._key_cache['current'] = self._key
            
            # Set up monitoring
            monitoring_config = BaseConfig.get_monitoring_config()
            logging.getLogger().setLevel(monitoring_config['log_level'])
            
        except Exception as e:
            logger.error(f"Failed to initialize encryption service: {str(e)}")
            raise

    def encrypt(self, data: Union[str, bytes], key_version: Optional[str] = None) -> str:
        """
        Encrypts data using AES-256-GCM with authentication.
        
        Args:
            data: Data to encrypt
            key_version: Optional key version for key rotation support
            
        Returns:
            str: Base64 encoded encrypted data with IV and authentication tag
        """
        try:
            with self._lock:
                # Convert string input to bytes
                if isinstance(data, str):
                    data = data.encode('utf-8')
                
                # Get encryption key
                key = self._key_cache.get(key_version, self._key)
                
                # Generate IV and create cipher
                iv = generate_iv()
                aesgcm = AESGCM(key)
                
                # Encrypt data with authentication
                ciphertext = aesgcm.encrypt(iv, data, None)
                
                # Combine IV and ciphertext
                encrypted_data = iv + ciphertext
                
                self._metrics['encryptions'] += 1
                
                return base64.b64encode(encrypted_data).decode('utf-8')
                
        except Exception as e:
            logger.error(f"Encryption failed: {str(e)}")
            raise

    def decrypt(self, encrypted_data: str, key_version: Optional[str] = None) -> str:
        """
        Decrypts AES-256-GCM encrypted data with authentication verification.
        
        Args:
            encrypted_data: Base64 encoded encrypted data
            key_version: Optional key version for key rotation support
            
        Returns:
            str: Decrypted data as string
        """
        try:
            with self._lock:
                # Decode base64 input
                encrypted_bytes = base64.b64decode(encrypted_data.encode('utf-8'))
                
                # Extract IV and ciphertext
                iv = encrypted_bytes[:IV_LENGTH]
                ciphertext = encrypted_bytes[IV_LENGTH:]
                
                # Get decryption key
                key = self._key_cache.get(key_version, self._key)
                
                # Create cipher and decrypt
                aesgcm = AESGCM(key)
                plaintext = aesgcm.decrypt(iv, ciphertext, None)
                
                self._metrics['decryptions'] += 1
                
                return plaintext.decode('utf-8')
                
        except InvalidTag:
            logger.error("Authentication failed during decryption")
            raise
        except Exception as e:
            logger.error(f"Decryption failed: {str(e)}")
            raise

    def rotate_key(self) -> bool:
        """
        Performs secure key rotation using AWS KMS.
        
        Returns:
            bool: Success status of key rotation
        """
        try:
            with self._lock:
                # Generate new key version
                response = self._kms_client.generate_data_key(
                    KeyId=self._kms_client.config.kms_key_id,
                    KeySpec='AES_256'
                )
                
                # Store old key in cache with timestamp
                import time
                timestamp = str(int(time.time()))
                self._key_cache[timestamp] = self._key
                
                # Update current key
                self._key = response['Plaintext']
                self._key_cache['current'] = self._key
                
                logger.info("Successfully rotated encryption key")
                return True
                
        except Exception as e:
            logger.error(f"Key rotation failed: {str(e)}")
            return False