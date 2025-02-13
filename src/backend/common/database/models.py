"""
Core SQLAlchemy models and common model functionality for the Sales and Intelligence Platform.
Provides base classes, mixins and utility functions for all database models.
"""

from datetime import datetime
import uuid
from typing import Dict, Any, Optional

from sqlalchemy import Column, String, DateTime
from sqlalchemy.ext.declarative import declarative_base, declared_attr  # sqlalchemy 2.0.0
from sqlalchemy.orm import registry

# Valid status values for models
STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']

# Create declarative base registry
mapper_registry = registry()
Base = declarative_base()

class TimestampMixin:
    """Mixin class providing timestamp functionality for models."""
    
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def update_timestamps(self) -> None:
        """Update the updated_at timestamp."""
        self.updated_at = datetime.utcnow()

class StatusMixin:
    """Mixin class providing status management functionality."""
    
    status = Column(String(50), nullable=False, default='DRAFT')

    def validate_status(self, new_status: str) -> bool:
        """
        Validate status transitions based on business rules.
        
        Args:
            new_status: The new status to validate
            
        Returns:
            bool: True if the status transition is valid
        """
        if new_status not in STATUSES:
            return False
            
        # Define valid status transitions
        valid_transitions = {
            'DRAFT': ['ACTIVE'],
            'ACTIVE': ['PAUSED', 'COMPLETED'],
            'PAUSED': ['ACTIVE', 'ARCHIVED'],
            'COMPLETED': ['ARCHIVED'],
            'ARCHIVED': []
        }
        
        return new_status in valid_transitions.get(self.status, [])

class BaseModel(Base, TimestampMixin, StatusMixin):
    """
    Abstract base model providing common fields and functionality for all database models.
    """
    
    __abstract__ = True

    # Primary key
    id = Column(String(36), primary_key=True)

    def __init__(self, **kwargs: Dict[str, Any]) -> None:
        """
        Initialize base model with common fields.
        
        Args:
            **kwargs: Model attributes to initialize
        """
        self.id = str(uuid.uuid4()) if 'id' not in kwargs else kwargs.pop('id')
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.status = kwargs.pop('status', 'DRAFT')
        
        # Initialize remaining attributes
        for key, value in kwargs.items():
            setattr(self, key, value)

    def to_dict(self, include_relationships: bool = False) -> Dict[str, Any]:
        """
        Convert model instance to dictionary representation.
        
        Args:
            include_relationships: Whether to include relationship fields
            
        Returns:
            Dictionary representation of model
        """
        result = {}
        
        # Add column values
        for column in self.__table__.columns:
            value = getattr(self, column.name)
            
            # Format datetime fields
            if isinstance(value, datetime):
                value = value.isoformat()
                
            result[column.name] = value
            
        # Add relationship values if requested
        if include_relationships:
            for relationship in self.__mapper__.relationships:
                related_obj = getattr(self, relationship.key)
                if related_obj is not None:
                    if hasattr(related_obj, 'to_dict'):
                        result[relationship.key] = related_obj.to_dict()
                    elif isinstance(related_obj, list):
                        result[relationship.key] = [
                            obj.to_dict() if hasattr(obj, 'to_dict') else str(obj)
                            for obj in related_obj
                        ]
                    else:
                        result[relationship.key] = str(related_obj)
                        
        return result

    def update(self, values: Dict[str, Any]) -> None:
        """
        Update model instance with new values.
        
        Args:
            values: Dictionary of values to update
        """
        # Validate status if being updated
        if 'status' in values:
            if not self.validate_status(values['status']):
                raise ValueError(f"Invalid status transition to {values['status']}")
        
        # Update fields
        for key, value in values.items():
            if hasattr(self, key):
                setattr(self, key, value)
                
        # Update timestamp
        self.update_timestamps()