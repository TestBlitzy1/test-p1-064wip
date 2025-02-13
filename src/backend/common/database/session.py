"""
Database session management module providing SQLAlchemy session configuration,
connection pooling, and lifecycle management with comprehensive error handling.

Version: 1.0.0
"""

import logging
from contextlib import contextmanager
from typing import Generator, Optional

# SQLAlchemy imports - v2.0.0
from sqlalchemy import create_engine, event, exc
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import QueuePool

# Internal imports
from common.config.settings import BaseConfig
from common.database.models import Base

# Configure logging
logger = logging.getLogger(__name__)

# Global variables for engine and session factory
engine: Optional[Engine] = None
SessionLocal: Optional[sessionmaker] = None

def init_database(config: BaseConfig) -> None:
    """
    Initialize database engine and session factory with comprehensive configuration.
    
    Args:
        config: Application configuration instance containing database settings
    """
    global engine, SessionLocal
    
    try:
        db_config = config.get_database_config()
        
        # Construct database URL
        db_url = (
            f"postgresql://{db_config['user']}:{db_config['password']}"
            f"@{db_config['host']}:{db_config['port']}/{db_config['name']}"
        )
        
        # Configure connection pool settings
        pool_settings = {
            "poolclass": QueuePool,
            "pool_size": db_config["min_connections"],
            "max_overflow": db_config["max_connections"] - db_config["min_connections"],
            "pool_timeout": db_config["connection_timeout"],
            "pool_pre_ping": True,
            "pool_recycle": 3600,  # Recycle connections every hour
        }
        
        # Configure SSL if enabled
        connect_args = {
            "sslmode": db_config["ssl_mode"],
            "connect_timeout": db_config["connection_timeout"]
        }
        
        # Create engine with configured settings
        engine = create_engine(
            db_url,
            **pool_settings,
            connect_args=connect_args,
            echo=config.debug,
            future=True  # Use SQLAlchemy 2.0 features
        )
        
        # Configure engine event listeners for monitoring
        @event.listens_for(engine, "connect")
        def connect(dbapi_connection, connection_record):
            logger.info("New database connection established")
            
        @event.listens_for(engine, "checkout")
        def checkout(dbapi_connection, connection_record, connection_proxy):
            logger.debug("Database connection checked out from pool")
            
        @event.listens_for(engine, "checkin")
        def checkin(dbapi_connection, connection_record):
            logger.debug("Database connection returned to pool")
        
        # Create session factory with custom settings
        SessionLocal = sessionmaker(
            bind=engine,
            autocommit=False,
            autoflush=False,
            expire_on_commit=False
        )
        
        # Verify database connectivity
        with engine.connect() as connection:
            connection.execute("SELECT 1")
            logger.info("Database connection verified successfully")
            
        # Create all tables if they don't exist
        Base.metadata.create_all(bind=engine)
        logger.info("Database initialization completed successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}")
        raise

@contextmanager
def get_session() -> Generator[Session, None, None]:
    """
    Context manager providing database session with automatic cleanup and error handling.
    
    Yields:
        SQLAlchemy Session object
    
    Raises:
        SQLAlchemyError: For database-related errors
        Exception: For other unexpected errors
    """
    session: Optional[Session] = None
    
    try:
        if SessionLocal is None:
            raise RuntimeError("Database not initialized. Call init_database first.")
            
        session = SessionLocal()
        
        # Configure session-level settings
        session.execute("SET statement_timeout = '30s'")  # Query timeout
        session.execute("SET TRANSACTION ISOLATION LEVEL READ COMMITTED")
        
        # Configure session event listeners
        @event.listens_for(session, "after_transaction_end")
        def after_transaction_end(session, transaction):
            logger.debug("Transaction completed")
        
        logger.debug("Database session created")
        yield session
        
        # Commit transaction if no errors occurred
        session.commit()
        logger.debug("Transaction committed successfully")
        
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error occurred: {str(e)}")
        if session:
            session.rollback()
            logger.info("Transaction rolled back")
        raise
        
    except Exception as e:
        logger.error(f"Unexpected error occurred: {str(e)}")
        if session:
            session.rollback()
            logger.info("Transaction rolled back")
        raise
        
    finally:
        if session:
            session.close()
            logger.debug("Database session closed")

def close_database() -> None:
    """
    Close database connections and perform comprehensive cleanup of resources.
    """
    global engine, SessionLocal
    
    try:
        logger.info("Initiating database cleanup")
        
        if engine:
            # Cancel any pending queries
            with engine.connect() as connection:
                connection.execute("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid <> pg_backend_pid()")
            
            # Dispose engine connections
            engine.dispose()
            logger.info("Database engine disposed")
            
        # Clear session factory
        SessionLocal = None
        engine = None
        
        logger.info("Database cleanup completed successfully")
        
    except Exception as e:
        logger.error(f"Error during database cleanup: {str(e)}")
        raise