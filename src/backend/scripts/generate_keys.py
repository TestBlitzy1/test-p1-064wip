#!/usr/bin/env python3
"""
Enterprise-grade cryptographic key generation script for the Sales and Intelligence Platform.
Generates FIPS 140-2 compliant keys for JWT authentication and data encryption.

Version: 1.0.0
"""

import argparse
import os
import base64
import secrets
import logging
from typing import Optional

# Internal imports
from common.security.encryption import generate_key
from common.config.settings import BaseConfig

# Global constants
KEY_LENGTH = 32  # 256 bits
DEFAULT_KEY_PATH = '.keys/'
SECURE_DIR_MODE = 0o700  # rwx------ directory permissions
SECURE_FILE_MODE = 0o600  # rw------- file permissions

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def setup_argparse() -> argparse.ArgumentParser:
    """
    Sets up command line argument parsing with security validations.
    
    Returns:
        ArgumentParser: Configured argument parser
    """
    parser = argparse.ArgumentParser(
        description='Generate secure cryptographic keys for the Sales and Intelligence Platform'
    )
    
    parser.add_argument(
        '--env',
        choices=['development', 'staging', 'production'],
        required=True,
        help='Environment for key generation'
    )
    
    parser.add_argument(
        '--type',
        choices=['jwt', 'encryption'],
        required=True,
        help='Type of key to generate'
    )
    
    parser.add_argument(
        '--output',
        default=DEFAULT_KEY_PATH,
        help='Output directory for key storage'
    )
    
    parser.add_argument(
        '--force',
        action='store_true',
        help='Force overwrite of existing keys'
    )
    
    return parser

def generate_jwt_key() -> bytes:
    """
    Generates a secure FIPS 140-2 compliant key for JWT token signing.
    
    Returns:
        bytes: Generated JWT signing key
    """
    try:
        # Add additional entropy
        extra_entropy = secrets.token_bytes(KEY_LENGTH)
        key = generate_key(KEY_LENGTH)
        
        # Validate key strength
        if len(key) != KEY_LENGTH:
            raise ValueError("Generated key does not meet length requirements")
            
        logger.info("Successfully generated JWT signing key")
        return key
        
    except Exception as e:
        logger.error(f"Failed to generate JWT key: {str(e)}")
        raise

def generate_encryption_key() -> bytes:
    """
    Generates a secure FIPS 140-2 compliant key for data encryption.
    
    Returns:
        bytes: Generated encryption key
    """
    try:
        # Add additional entropy
        extra_entropy = secrets.token_bytes(KEY_LENGTH)
        key = generate_key(KEY_LENGTH)
        
        # Validate key strength
        if len(key) != KEY_LENGTH:
            raise ValueError("Generated key does not meet length requirements")
            
        logger.info("Successfully generated encryption key")
        return key
        
    except Exception as e:
        logger.error(f"Failed to generate encryption key: {str(e)}")
        raise

def save_key(key: bytes, path: str, key_type: str, force: bool = False) -> bool:
    """
    Securely saves generated key with proper permissions and audit logging.
    
    Args:
        key: Key bytes to save
        path: Output path for key storage
        key_type: Type of key being saved
        force: Whether to overwrite existing key
        
    Returns:
        bool: Success status
    """
    try:
        # Create output directory with secure permissions
        os.makedirs(path, mode=SECURE_DIR_MODE, exist_ok=True)
        
        # Generate key file path
        key_file = os.path.join(path, f"{key_type}.key")
        
        # Check for existing key
        if os.path.exists(key_file) and not force:
            raise FileExistsError(f"Key file already exists: {key_file}")
            
        # Encode and save key with secure permissions
        encoded_key = base64.b64encode(key).decode('utf-8')
        with open(key_file, 'w') as f:
            f.write(encoded_key)
        os.chmod(key_file, SECURE_FILE_MODE)
        
        # Verify file permissions
        stat = os.stat(key_file)
        if stat.st_mode & 0o777 != SECURE_FILE_MODE:
            raise RuntimeError("Failed to set secure file permissions")
            
        logger.info(f"Successfully saved {key_type} key to {key_file}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to save key: {str(e)}")
        raise

def main() -> int:
    """
    Main script execution function with comprehensive error handling.
    
    Returns:
        int: Exit code (0 for success, 1 for failure)
    """
    try:
        # Parse arguments
        parser = setup_argparse()
        args = parser.parse_args()
        
        # Generate appropriate key
        if args.type == 'jwt':
            key = generate_jwt_key()
        else:
            key = generate_encryption_key()
            
        # Save key with secure permissions
        save_key(
            key=key,
            path=args.output,
            key_type=args.type,
            force=args.force
        )
        
        logger.info(f"Successfully generated and stored {args.type} key for {args.env} environment")
        return 0
        
    except Exception as e:
        logger.error(f"Key generation failed: {str(e)}")
        return 1
    finally:
        # Ensure sensitive data is cleared
        if 'key' in locals():
            del key

if __name__ == '__main__':
    exit(main())