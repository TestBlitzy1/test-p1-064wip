"""
Messaging initialization module providing Kafka producer and consumer classes for asynchronous 
inter-service communication with comprehensive type hints and documentation.

This module exposes high-performance, production-ready Kafka messaging components that support:
- Asynchronous message publishing and consumption
- Reliable message delivery with retries
- Comprehensive monitoring and metrics
- Type-safe interfaces
- Enhanced error handling

Version: 1.0.0
"""

from typing import Dict, List, Optional, Callable, Awaitable

# Import Kafka components with type hints
from .kafka import (
    KafkaProducer,  # v1.0.0
    KafkaConsumer,  # v1.0.0
)

# Define module exports
__all__ = [
    'KafkaProducer',
    'KafkaConsumer'
]

# Module version
__version__ = '1.0.0'

# Type aliases for enhanced type safety
Message = Dict
MessageHandler = Callable[[Message], Awaitable[None]]
Topics = List[str]
Headers = Optional[Dict[str, str]]

# Re-export main classes with comprehensive type hints
KafkaProducer = KafkaProducer  # Enhanced producer with retry logic and monitoring
KafkaConsumer = KafkaConsumer  # Enhanced consumer with parallel processing support