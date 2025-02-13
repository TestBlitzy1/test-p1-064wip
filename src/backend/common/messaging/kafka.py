"""
Core Kafka messaging module providing asynchronous messaging capabilities for inter-service communication,
event handling, and data streaming between microservices with enhanced reliability, monitoring, and performance optimizations.

Version: 1.0.0
"""

import json
import asyncio
from typing import Dict, List, Optional, Callable, Awaitable
from dataclasses import dataclass, field
from datetime import datetime

# External package imports with versions
from confluent_kafka import Producer, Consumer, KafkaError, KafkaException  # v2.3.0

# Internal imports
from ..config.settings import BaseConfig
from ..logging.logger import ServiceLogger

# Global constants for configuration
DEFAULT_TIMEOUT_MS = 30000
MAX_RETRIES = 3
RETRY_BACKOFF_MS = 1000
BATCH_SIZE_BYTES = 1048576  # 1MB
MAX_POLL_RECORDS = 500
HEALTH_CHECK_INTERVAL_MS = 5000

@dataclass
class KafkaProducer:
    """Enhanced Kafka producer with retry logic, message validation, batching, and monitoring capabilities."""
    
    config: BaseConfig
    _producer: Producer = field(init=False)
    _logger: ServiceLogger = field(init=False)
    _metrics: Dict = field(default_factory=dict)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    
    def __post_init__(self):
        """Initialize Kafka producer with enhanced configuration and monitoring."""
        self._logger = ServiceLogger("kafka_producer", self.config)
        kafka_config = self.config.get_kafka_config()
        
        # Enhanced producer configuration
        producer_config = {
            'bootstrap.servers': ','.join(kafka_config['bootstrap_servers']),
            'security.protocol': kafka_config['security_protocol'],
            'sasl.mechanism': kafka_config['sasl_mechanism'],
            'compression.type': 'lz4',
            'batch.size': BATCH_SIZE_BYTES,
            'linger.ms': 10,
            'retry.backoff.ms': RETRY_BACKOFF_MS,
            'enable.idempotence': True,
            'message.send.max.retries': MAX_RETRIES,
            'delivery.timeout.ms': DEFAULT_TIMEOUT_MS
        }
        
        self._producer = Producer(producer_config)
        self._metrics = {
            'messages_sent': 0,
            'bytes_sent': 0,
            'errors': 0,
            'retries': 0
        }
        
        self._logger.info("Kafka producer initialized", extra={'config': producer_config})

    async def produce(self, topic: str, message: dict, key: Optional[str] = None,
                     headers: Optional[dict] = None) -> Awaitable[bool]:
        """
        Produces a message to a specified Kafka topic with enhanced reliability.
        
        Args:
            topic: Target Kafka topic
            message: Message payload as dictionary
            key: Optional message key
            headers: Optional message headers
        
        Returns:
            Awaitable[bool]: Success status of message production
        """
        async with self._lock:
            try:
                # Message validation and enrichment
                if not isinstance(message, dict):
                    raise ValueError("Message must be a dictionary")
                
                # Add metadata
                message['_metadata'] = {
                    'timestamp': datetime.utcnow().isoformat(),
                    'service': self.config.service_name,
                    'version': '1.0.0'
                }
                
                # Serialize message
                message_bytes = json.dumps(message).encode('utf-8')
                kafka_headers = [(k, str(v).encode('utf-8')) for k, v in (headers or {}).items()]
                
                # Delivery callback for monitoring
                def delivery_callback(err, msg):
                    if err:
                        self._metrics['errors'] += 1
                        self._logger.error(f"Message delivery failed: {err}", 
                                         extra={'topic': topic, 'error': str(err)})
                    else:
                        self._metrics['messages_sent'] += 1
                        self._metrics['bytes_sent'] += len(message_bytes)
                        self._logger.debug(f"Message delivered to {msg.topic()}", 
                                         extra={'partition': msg.partition(), 'offset': msg.offset()})
                
                # Produce with retry logic
                retries = 0
                while retries <= MAX_RETRIES:
                    try:
                        self._producer.produce(
                            topic=topic,
                            value=message_bytes,
                            key=key.encode('utf-8') if key else None,
                            headers=kafka_headers,
                            callback=delivery_callback
                        )
                        await asyncio.sleep(0)  # Yield control
                        self._producer.poll(0)  # Trigger delivery reports
                        return True
                    
                    except KafkaException as e:
                        retries += 1
                        self._metrics['retries'] += 1
                        if retries <= MAX_RETRIES:
                            await asyncio.sleep(RETRY_BACKOFF_MS / 1000 * retries)
                            continue
                        raise e
                
                return False
                
            except Exception as e:
                self._logger.error("Failed to produce message", exc=e,
                                 extra={'topic': topic, 'retries': retries})
                raise

    async def flush(self) -> None:
        """Flushes pending messages with monitoring."""
        try:
            self._logger.info("Flushing pending messages")
            self._producer.flush(timeout=DEFAULT_TIMEOUT_MS)
            self._logger.info("Flush completed", extra={'metrics': self._metrics})
        except Exception as e:
            self._logger.error("Flush failed", exc=e)
            raise

@dataclass
class KafkaConsumer:
    """Enhanced Kafka consumer with parallel processing, error handling, and monitoring."""
    
    config: BaseConfig
    topics: List[str]
    _consumer: Consumer = field(init=False)
    _logger: ServiceLogger = field(init=False)
    _metrics: Dict = field(default_factory=dict)
    _running: bool = field(default=False)
    
    def __post_init__(self):
        """Initialize Kafka consumer with enhanced features."""
        self._logger = ServiceLogger("kafka_consumer", self.config)
        kafka_config = self.config.get_kafka_config()
        
        # Enhanced consumer configuration
        consumer_config = {
            'bootstrap.servers': ','.join(kafka_config['bootstrap_servers']),
            'group.id': kafka_config['consumer_group_id'],
            'auto.offset.reset': kafka_config['auto_offset_reset'],
            'enable.auto.commit': kafka_config['enable_auto_commit'],
            'max.poll.records': MAX_POLL_RECORDS,
            'session.timeout.ms': DEFAULT_TIMEOUT_MS,
            'security.protocol': kafka_config['security_protocol'],
            'sasl.mechanism': kafka_config['sasl_mechanism']
        }
        
        self._consumer = Consumer(consumer_config)
        self._consumer.subscribe(self.topics)
        
        self._metrics = {
            'messages_processed': 0,
            'bytes_processed': 0,
            'errors': 0,
            'processing_time': 0
        }
        
        self._logger.info("Kafka consumer initialized", 
                         extra={'topics': self.topics, 'config': consumer_config})

    async def consume(self, timeout: float = 1.0) -> Optional[dict]:
        """
        Consumes messages with enhanced processing capabilities.
        
        Args:
            timeout: Polling timeout in seconds
        
        Returns:
            Optional[dict]: Processed message or None
        """
        try:
            msg = self._consumer.poll(timeout)
            
            if msg is None:
                return None
            
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    self._logger.debug("Reached end of partition")
                    return None
                self._metrics['errors'] += 1
                self._logger.error(f"Consumer error: {msg.error()}")
                return None
            
            # Process message
            try:
                message_bytes = msg.value()
                message = json.loads(message_bytes)
                self._metrics['messages_processed'] += 1
                self._metrics['bytes_processed'] += len(message_bytes)
                
                self._logger.debug("Message consumed", 
                                 extra={'topic': msg.topic(), 
                                       'partition': msg.partition(),
                                       'offset': msg.offset()})
                return message
                
            except json.JSONDecodeError as e:
                self._metrics['errors'] += 1
                self._logger.error("Failed to decode message", exc=e)
                return None
                
        except Exception as e:
            self._metrics['errors'] += 1
            self._logger.error("Consumer error", exc=e)
            return None

    async def start_consuming(self, message_handler: Callable, 
                            parallel_workers: Optional[int] = None) -> None:
        """
        Starts enhanced consumption loop.
        
        Args:
            message_handler: Callback for processing messages
            parallel_workers: Optional number of parallel processing workers
        """
        self._running = True
        workers = parallel_workers or 1
        
        async def health_check():
            while self._running:
                self._logger.info("Consumer health check", extra={'metrics': self._metrics})
                await asyncio.sleep(HEALTH_CHECK_INTERVAL_MS / 1000)
        
        try:
            # Start health check task
            asyncio.create_task(health_check())
            
            # Start consumer workers
            tasks = []
            for _ in range(workers):
                task = asyncio.create_task(self._consume_worker(message_handler))
                tasks.append(task)
            
            await asyncio.gather(*tasks)
            
        except Exception as e:
            self._logger.error("Consumer loop error", exc=e)
            raise
        finally:
            self._running = False
            self._consumer.close()
    
    async def _consume_worker(self, message_handler: Callable) -> None:
        """Worker process for parallel message consumption."""
        while self._running:
            message = await self.consume()
            if message:
                try:
                    await message_handler(message)
                except Exception as e:
                    self._logger.error("Message handler error", exc=e)

    def stop(self) -> None:
        """Stops the consumer gracefully."""
        self._running = False
        self._logger.info("Consumer stopping", extra={'metrics': self._metrics})