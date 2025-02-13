"""
Database initialization module that configures SQLAlchemy, sets up connection pooling,
and provides database session management with support for master-slave replication.

Version: 2.0.0
"""

from contextlib import contextmanager
from typing import Generator, Optional

from sqlalchemy import create_engine, event  # sqlalchemy v2.0.0
from sqlalchemy.orm import Session
from prometheus_client import Counter, Gauge, Histogram  # prometheus_client v0.17.0

from common.database.models import Base
from common.database.session import DatabaseSession
from common.config.settings import BaseConfig

# Global configuration constants
POOL_SIZE: int = 10
MAX_OVERFLOW: int = 20
POOL_TIMEOUT: int = 30

# Initialize metrics
db_connections = Gauge('database_connections_active', 'Number of active database connections')
db_pool_size = Gauge('database_pool_size', 'Current database connection pool size')
db_errors = Counter('database_errors_total', 'Total number of database errors', ['type'])
query_duration = Histogram('database_query_duration_seconds', 'Database query duration in seconds')

# Initialize database session with configuration
db_session = DatabaseSession(BaseConfig())
engine = db_session.engine

def initialize_database() -> None:
    """
    Initializes the database by creating all tables, setting up connection pooling,
    and configuring master-slave replication.
    """
    try:
        # Configure connection pool
        db_pool_size.set(POOL_SIZE)
        
        # Set up connection monitoring
        @event.listens_for(engine, 'checkout')
        def receive_checkout(dbapi_connection, connection_record, connection_proxy):
            db_connections.inc()

        @event.listens_for(engine, 'checkin')
        def receive_checkin(dbapi_connection, connection_record):
            db_connections.dec()

        # Create database schema
        Base.metadata.create_all(bind=engine)

        # Configure statement cache
        engine.dialect.statement_cache_size = 500

        # Set up query timeout and statement timeout
        with db_session.get_session() as session:
            session.execute("SET statement_timeout = '30s'")
            session.execute("SET idle_in_transaction_session_timeout = '60s'")

        # Verify database connectivity
        engine.connect().close()

    except Exception as e:
        db_errors.labels(type='initialization').inc()
        raise RuntimeError(f"Failed to initialize database: {str(e)}")

@contextmanager
def get_session(read_only: bool = False) -> Generator[Session, None, None]:
    """
    Context manager that provides a database session with comprehensive error handling and monitoring.
    
    Args:
        read_only: If True, uses replica database for read operations
        
    Yields:
        SQLAlchemy Session object
        
    Raises:
        SQLAlchemyError: For database-related errors
        Exception: For other unexpected errors
    """
    with query_duration.time():
        try:
            session = db_session.get_session(read_only=read_only)
            
            # Configure session-level settings
            if read_only:
                session.execute("SET TRANSACTION READ ONLY")
                session.execute("SET TRANSACTION ISOLATION LEVEL READ COMMITTED")
            else:
                session.execute("SET TRANSACTION ISOLATION LEVEL READ COMMITTED")
            
            yield session
            
            if not read_only:
                session.commit()
                
        except Exception as e:
            db_errors.labels(type='session').inc()
            if not read_only:
                session.rollback()
            raise
        finally:
            db_session.cleanup(session)

def cleanup_database() -> None:
    """
    Performs comprehensive cleanup of database connections and resources with monitoring.
    """
    try:
        # Stop monitoring
        db_connections.set(0)
        db_pool_size.set(0)
        
        # Close all active sessions
        db_session.monitor_connections()
        
        # Terminate active queries
        with get_session() as session:
            session.execute(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                "WHERE pid <> pg_backend_pid() AND state = 'active'"
            )
        
        # Dispose engine and clear pools
        if engine:
            engine.dispose()
            
    except Exception as e:
        db_errors.labels(type='cleanup').inc()
        raise RuntimeError(f"Failed to cleanup database resources: {str(e)}")