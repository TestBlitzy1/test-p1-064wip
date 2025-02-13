"""
Core Pydantic base schemas and validation functionality for the Sales and Intelligence Platform.
Provides base classes, mixins and validation utilities for all data schemas with comprehensive
validation rules, ORM integration and security features.
"""

from datetime import datetime
from typing import Dict, Any, Optional, Type
from uuid import UUID, uuid4

from pydantic import BaseModel as PydanticBaseModel, Field, validator, ValidationError  # pydantic 2.0.0

from common.database.models import BaseModel as OrmBaseModel

# Valid status values and transitions
STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']

STATUS_TRANSITIONS = {
    'DRAFT': ['ACTIVE', 'ARCHIVED'],
    'ACTIVE': ['PAUSED', 'COMPLETED', 'ARCHIVED'],
    'PAUSED': ['ACTIVE', 'COMPLETED', 'ARCHIVED'],
    'COMPLETED': ['ARCHIVED'],
    'ARCHIVED': []
}

# Standardized validation error messages
VALIDATION_ERRORS = {
    'invalid_status': 'Invalid status transition from {current} to {new}',
    'invalid_dates': 'End date must be after start date',
    'future_start': 'Start date cannot be in the past',
    'invalid_timestamp': 'Updated timestamp must be after created timestamp'
}

class TimestampMixin(PydanticBaseModel):
    """Enhanced mixin for timestamp validation with audit support."""
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    timestamp_meta: Dict[str, Any] = Field(default_factory=dict)

    @validator('updated_at')
    def validate_timestamps(cls, v: datetime, values: Dict[str, Any]) -> datetime:
        """
        Comprehensive timestamp validation.
        
        Args:
            v: Updated timestamp to validate
            values: Current field values
            
        Returns:
            Validated updated timestamp
            
        Raises:
            ValidationError: If timestamp validation fails
        """
        created_at = values.get('created_at')
        if created_at and v < created_at:
            raise ValidationError(VALIDATION_ERRORS['invalid_timestamp'])
            
        if v < datetime.utcnow():
            # Allow small clock skew of up to 5 minutes
            if (datetime.utcnow() - v).total_seconds() > 300:
                raise ValidationError('Updated timestamp cannot be in the past')
                
        return v

class BaseSchema(TimestampMixin):
    """
    Enhanced base Pydantic schema providing comprehensive validation and ORM integration 
    for all data schemas.
    """
    
    id: UUID = Field(default_factory=uuid4)
    status: str = Field(default='DRAFT')
    _audit_trail: Dict[str, Any] = Field(default_factory=dict, alias='audit_trail')
    _schema_version: int = Field(default=1, const=True)

    class Config:
        """Pydantic model configuration."""
        arbitrary_types_allowed = True
        orm_mode = True
        validate_assignment = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }

    def __init__(self, **kwargs: Dict[str, Any]) -> None:
        """
        Initialize base schema with enhanced validation and auditing.
        
        Args:
            **kwargs: Schema attributes to initialize
            audit_context: Optional audit context information
        """
        audit_context = kwargs.pop('audit_context', {})
        
        # Initialize audit trail
        kwargs['audit_trail'] = {
            'created_by': audit_context.get('user_id'),
            'created_at': datetime.utcnow(),
            'modifications': []
        }
        
        super().__init__(**kwargs)

    @validator('status')
    def validate_status(cls, v: str, values: Dict[str, Any]) -> str:
        """
        Comprehensive status transition validation.
        
        Args:
            v: New status value
            values: Current field values
            
        Returns:
            Validated status value
            
        Raises:
            ValidationError: If status transition is invalid
        """
        if v not in STATUSES:
            raise ValidationError(f'Invalid status: {v}')
            
        current_status = values.get('status', 'DRAFT')
        if current_status and v != current_status:
            valid_transitions = STATUS_TRANSITIONS.get(current_status, [])
            if v not in valid_transitions:
                raise ValidationError(
                    VALIDATION_ERRORS['invalid_status'].format(
                        current=current_status, 
                        new=v
                    )
                )
        return v

    @classmethod
    def validate_dates(cls, start_date: datetime, end_date: datetime, context: Dict[str, Any]) -> bool:
        """
        Enhanced date validation with business rules.
        
        Args:
            start_date: Start date to validate
            end_date: End date to validate
            context: Validation context
            
        Returns:
            True if dates are valid
            
        Raises:
            ValidationError: If date validation fails
        """
        now = datetime.utcnow()
        
        # Validate start date not in past
        if start_date < now:
            raise ValidationError(VALIDATION_ERRORS['future_start'])
            
        # Validate end date after start date
        if end_date <= start_date:
            raise ValidationError(VALIDATION_ERRORS['invalid_dates'])
            
        # Additional business validations
        if (end_date - start_date).days > context.get('max_campaign_days', 365):
            raise ValidationError('Campaign duration exceeds maximum allowed')
            
        return True

    def to_orm(self) -> OrmBaseModel:
        """
        Enhanced ORM conversion with relationship handling.
        
        Returns:
            ORM model instance with relationships
            
        Raises:
            ValidationError: If conversion fails
        """
        # Create ORM model instance
        orm_model = OrmBaseModel()
        
        # Copy validated data
        orm_data = self.dict(exclude={'audit_trail', 'schema_version'})
        for key, value in orm_data.items():
            setattr(orm_model, key, value)
            
        # Handle audit trail
        orm_model.update_timestamps()
        
        return orm_model

    def record_modification(self, user_id: str, changes: Dict[str, Any]) -> None:
        """
        Record modifications in audit trail.
        
        Args:
            user_id: ID of user making changes
            changes: Dictionary of changes made
        """
        self._audit_trail['modifications'].append({
            'user_id': user_id,
            'timestamp': datetime.utcnow(),
            'changes': changes
        })
        self.updated_at = datetime.utcnow()