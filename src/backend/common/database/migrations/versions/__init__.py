"""
Database migration versions management module providing thread-safe version tracking,
validation, and comprehensive history management with zero-downtime deployment support.

Version: 1.0.0
"""

import os
import re
import threading
from typing import Dict, List, Tuple, Optional
from functools import wraps
import alembic  # v1.12.0

from ...__init__ import MIGRATION_LOGGER

# Global constants
VERSION_DIRECTORY = os.path.dirname(os.path.abspath(__file__))
REVISION_HISTORY = threading.local()
MIGRATION_LOCK = threading.Lock()

# Semantic version format for migration IDs
VERSION_PATTERN = re.compile(r'^[0-9a-f]{12}_[a-z0-9_]+$')

def validate_revision_format(func):
    """Decorator to validate migration revision ID format."""
    @wraps(func)
    def wrapper(revision_id: str, *args, **kwargs):
        if not VERSION_PATTERN.match(revision_id):
            MIGRATION_LOGGER.error(f"Invalid revision format: {revision_id}")
            raise ValueError(f"Revision ID must match format: {VERSION_PATTERN.pattern}")
        return func(revision_id, *args, **kwargs)
    return wrapper

def cache_results(func):
    """Decorator to cache migration history results."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        if not hasattr(REVISION_HISTORY, 'cache'):
            REVISION_HISTORY.cache = {}
        
        cache_key = f"{func.__name__}_{args}_{kwargs}"
        if cache_key not in REVISION_HISTORY.cache:
            REVISION_HISTORY.cache[cache_key] = func(*args, **kwargs)
        return REVISION_HISTORY.cache[cache_key]
    return wrapper

@MIGRATION_LOCK.acquire
@validate_revision_format
def register_migration(revision_id: str, description: str, dependencies: Dict) -> bool:
    """
    Register a new migration script with validation and thread-safe history tracking.
    
    Args:
        revision_id: Unique identifier for the migration
        description: Description of the migration changes
        dependencies: Dictionary of migration dependencies
        
    Returns:
        bool: True if registration successful
        
    Raises:
        ValueError: If revision format or dependencies are invalid
    """
    try:
        # Initialize revision history if not exists
        if not hasattr(REVISION_HISTORY, 'revisions'):
            REVISION_HISTORY.revisions = {}
            
        # Check for duplicate revision
        if revision_id in REVISION_HISTORY.revisions:
            MIGRATION_LOGGER.error(f"Duplicate revision ID: {revision_id}")
            return False
            
        # Validate script file existence
        script_path = os.path.join(VERSION_DIRECTORY, f"{revision_id}.py")
        if not os.path.exists(script_path):
            MIGRATION_LOGGER.error(f"Migration script not found: {script_path}")
            return False
            
        # Validate dependencies
        for dep_id in dependencies.get('depends_on', []):
            if dep_id not in REVISION_HISTORY.revisions:
                MIGRATION_LOGGER.error(f"Missing dependency: {dep_id}")
                return False
                
        # Register migration
        REVISION_HISTORY.revisions[revision_id] = {
            'description': description,
            'dependencies': dependencies,
            'script_path': script_path,
            'status': 'pending'
        }
        
        MIGRATION_LOGGER.info(f"Successfully registered migration: {revision_id}")
        return True
        
    except Exception as e:
        MIGRATION_LOGGER.error(f"Failed to register migration {revision_id}: {str(e)}")
        raise

@cache_results
def get_migration_history(include_pending: bool = True) -> List[Dict]:
    """
    Retrieve ordered migration history with comprehensive metadata.
    
    Args:
        include_pending: Whether to include pending migrations
        
    Returns:
        List of migration revisions with metadata
    """
    try:
        if not hasattr(REVISION_HISTORY, 'revisions'):
            return []
            
        history = []
        with MIGRATION_LOCK:
            for revision_id, metadata in REVISION_HISTORY.revisions.items():
                if not include_pending and metadata['status'] == 'pending':
                    continue
                    
                history.append({
                    'revision_id': revision_id,
                    'description': metadata['description'],
                    'dependencies': metadata['dependencies'],
                    'status': metadata['status'],
                    'script_path': metadata['script_path']
                })
                
        # Sort by dependency order
        history.sort(key=lambda x: len(x['dependencies'].get('depends_on', [])))
        return history
        
    except Exception as e:
        MIGRATION_LOGGER.error(f"Failed to retrieve migration history: {str(e)}")
        raise

def validate_migration(revision_id: str, metadata: Dict) -> Tuple[bool, str]:
    """
    Validate migration script format and dependencies.
    
    Args:
        revision_id: Migration revision ID to validate
        metadata: Migration metadata including dependencies
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        # Validate revision format
        if not VERSION_PATTERN.match(revision_id):
            return False, f"Invalid revision format: {revision_id}"
            
        # Validate script file
        script_path = os.path.join(VERSION_DIRECTORY, f"{revision_id}.py")
        if not os.path.exists(script_path):
            return False, f"Migration script not found: {script_path}"
            
        # Validate dependencies
        for dep_id in metadata.get('dependencies', {}).get('depends_on', []):
            if dep_id not in REVISION_HISTORY.revisions:
                return False, f"Missing dependency: {dep_id}"
                
            # Check for circular dependencies
            if revision_id in REVISION_HISTORY.revisions[dep_id]['dependencies'].get('depends_on', []):
                return False, f"Circular dependency detected with {dep_id}"
                
        # Validate script structure
        with open(script_path, 'r') as f:
            content = f.read()
            if 'upgrade()' not in content or 'downgrade()' not in content:
                return False, "Missing upgrade() or downgrade() functions"
                
        return True, "Validation successful"
        
    except Exception as e:
        MIGRATION_LOGGER.error(f"Migration validation failed for {revision_id}: {str(e)}")
        return False, str(e)