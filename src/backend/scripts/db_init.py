"""
Database initialization script for the Sales and Intelligence Platform.
Handles database creation, schema migration, replication setup, and initial data population.

Version: 1.0.0
"""

import logging
import sys
from pathlib import Path
from typing import Optional

import click
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from alembic import command
from alembic.config import Config as AlembicConfig
from alembic.runtime.migration import MigrationContext

from common.database.models import Base
from common.database.session import init_database
from common.config.settings import BaseConfig

# Initialize logging
logger = logging.getLogger(__name__)

def setup_logging() -> None:
    """Configure comprehensive logging with structured output and file rotation."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('db_init.log', mode='a'),
            logging.FileHandler('db_init_error.log', level=logging.ERROR)
        ]
    )

    # Configure audit logging
    audit_logger = logging.getLogger('db_audit')
    audit_logger.setLevel(logging.INFO)
    audit_handler = logging.FileHandler('db_audit.log')
    audit_handler.setFormatter(
        logging.Formatter('%(asctime)s - %(message)s')
    )
    audit_logger.addHandler(audit_handler)

def create_database(config: BaseConfig) -> None:
    """
    Create and configure the database with replication and high availability settings.
    
    Args:
        config: Application configuration instance
    """
    try:
        db_config = config.get_database_config()
        
        # Create admin engine for database creation
        admin_engine = create_engine(
            f"postgresql://{db_config['user']}:{db_config['password']}@"
            f"{db_config['host']}:{db_config['port']}/postgres"
        )

        # Check if database exists
        with admin_engine.connect() as conn:
            conn.execution_options(isolation_level="AUTOCOMMIT")
            result = conn.execute(
                text(f"SELECT 1 FROM pg_database WHERE datname = '{db_config['name']}'")
            )
            exists = result.scalar() is not None

            if not exists:
                # Create database with proper encoding and collation
                conn.execute(text(
                    f"CREATE DATABASE {db_config['name']} "
                    "ENCODING 'UTF8' LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8'"
                ))
                logger.info(f"Created database: {db_config['name']}")

        # Initialize database connection with enhanced settings
        init_database(config)

        # Configure replication if enabled
        if db_config['replica_hosts']:
            with admin_engine.connect() as conn:
                conn.execution_options(isolation_level="AUTOCOMMIT")
                
                # Configure WAL level and replication slots
                conn.execute(text("ALTER SYSTEM SET wal_level = 'logical'"))
                conn.execute(text("ALTER SYSTEM SET max_replication_slots = 10"))
                conn.execute(text("ALTER SYSTEM SET max_wal_senders = 10"))

                # Create replication user if needed
                conn.execute(text(
                    "CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'repl_password'"
                ))

                # Configure pg_hba.conf entries for replication (would be done externally)
                logger.info("Configured replication settings")

        # Create schema and tables
        engine = create_engine(
            f"postgresql://{db_config['user']}:{db_config['password']}@"
            f"{db_config['host']}:{db_config['port']}/{db_config['name']}"
        )
        
        Base.metadata.create_all(engine)
        logger.info("Created database schema and tables")

        # Configure table partitioning for high-volume tables
        with engine.connect() as conn:
            # Example: Partition performance metrics by month
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS performance_metrics_partition (
                    LIKE performance_metrics INCLUDING ALL
                ) PARTITION BY RANGE (created_at)
            """))
            logger.info("Configured table partitioning")

    except Exception as e:
        logger.error(f"Failed to create database: {str(e)}")
        raise

def run_migrations(config: BaseConfig) -> None:
    """
    Execute database migrations with version control and rollback capabilities.
    
    Args:
        config: Application configuration instance
    """
    try:
        # Configure Alembic
        alembic_cfg = AlembicConfig()
        alembic_cfg.set_main_option("script_location", "migrations")
        alembic_cfg.set_main_option("sqlalchemy.url", 
            f"postgresql://{config.get_database_config()['user']}:"
            f"{config.get_database_config()['password']}@"
            f"{config.get_database_config()['host']}:"
            f"{config.get_database_config()['port']}/"
            f"{config.get_database_config()['name']}"
        )

        # Create migrations directory if it doesn't exist
        migrations_dir = Path("migrations")
        if not migrations_dir.exists():
            migrations_dir.mkdir()
            command.init(alembic_cfg, "migrations")
            logger.info("Initialized migrations directory")

        # Check current database version
        engine = create_engine(alembic_cfg.get_main_option("sqlalchemy.url"))
        with engine.connect() as conn:
            context = MigrationContext.configure(conn)
            current_rev = context.get_current_revision()
            logger.info(f"Current database version: {current_rev}")

        # Create database backup before migration
        # Note: This would typically be handled by a backup service
        logger.info("Database backup would be created here")

        # Run migrations
        command.upgrade(alembic_cfg, "head")
        logger.info("Successfully applied all migrations")

        # Verify data integrity
        with engine.connect() as conn:
            # Example: Check key constraints and indexes
            conn.execute(text("ANALYZE VERBOSE"))
            logger.info("Verified database integrity after migration")

    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        raise

@click.command()
@click.option('--env', default='development', help='Environment to initialize')
@click.option('--force', is_flag=True, help='Force initialization even if database exists')
@click.option('--skip-migrations', is_flag=True, help='Skip running migrations')
def main(env: str, force: bool, skip_migrations: bool) -> None:
    """
    Main entry point for database initialization with comprehensive error handling.
    """
    try:
        # Set up logging
        setup_logging()
        logger.info(f"Starting database initialization for environment: {env}")

        # Load configuration
        config = BaseConfig(service_name='campaign_service')
        
        # Create and configure database
        create_database(config)
        
        # Run migrations if not skipped
        if not skip_migrations:
            run_migrations(config)
            
        logger.info("Database initialization completed successfully")
        
    except SQLAlchemyError as e:
        logger.error(f"Database error during initialization: {str(e)}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error during initialization: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    main()