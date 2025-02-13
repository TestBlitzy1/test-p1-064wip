#!/usr/bin/env python3
"""
Development environment setup script for the Sales and Intelligence Platform.
Initializes and configures all required services, databases, and dependencies.

Version: 1.0.0
"""

import os
import argparse
import subprocess
import logging
from typing import Dict, List, Optional
from pathlib import Path

# External imports
from dotenv import load_dotenv  # v1.0.0

# Internal imports
from common.config.settings import BaseConfig, get_service_config
from common.database.session import init_database
from common.database.models import Base

# Global constants
SERVICES = ["ai_service", "analytics_service", "audience_service", 
           "campaign_service", "integration_service"]
DEV_ENV_FILE = ".env.development"
SERVICE_HEALTH_TIMEOUT = 30
DEV_RESOURCE_LIMITS = {
    "cpu": "2",
    "memory": "4Gi",
    "storage": "10Gi"
}

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def setup_parser() -> argparse.ArgumentParser:
    """Configure argument parser with development setup options."""
    parser = argparse.ArgumentParser(
        description="Setup development environment for Sales and Intelligence Platform",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    
    parser.add_argument(
        "--services",
        nargs="+",
        choices=SERVICES,
        default=SERVICES,
        help="Specify services to setup"
    )
    
    parser.add_argument(
        "--skip-db",
        action="store_true",
        help="Skip database initialization"
    )
    
    parser.add_argument(
        "--skip-deps",
        action="store_true",
        help="Skip dependency installation"
    )
    
    parser.add_argument(
        "--env-file",
        default=DEV_ENV_FILE,
        help="Environment file path"
    )
    
    parser.add_argument(
        "--resource-limits",
        type=str,
        help="Custom resource limits (JSON format)"
    )
    
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging"
    )
    
    return parser

def install_dependencies(verbose: bool = False) -> bool:
    """Install and validate Python dependencies for development."""
    try:
        logger.info("Installing development dependencies...")
        
        # Verify poetry installation
        subprocess.run(["poetry", "--version"], check=True, capture_output=not verbose)
        
        # Install dependencies
        subprocess.run(["poetry", "install"], check=True, capture_output=not verbose)
        
        # Install development extras
        subprocess.run(
            ["poetry", "install", "--extras", "dev"],
            check=True,
            capture_output=not verbose
        )
        
        # Setup pre-commit hooks
        subprocess.run(
            ["poetry", "run", "pre-commit", "install"],
            check=True,
            capture_output=not verbose
        )
        
        logger.info("Dependencies installed successfully")
        return True
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to install dependencies: {str(e)}")
        return False

def setup_environment(env_file: str, resource_limits: Dict) -> Dict:
    """Setup development environment configuration."""
    try:
        logger.info(f"Setting up development environment using {env_file}")
        
        env_path = Path(env_file)
        if not env_path.exists():
            template_path = Path(f"{env_file}.template")
            if template_path.exists():
                env_path.write_text(template_path.read_text())
            else:
                raise FileNotFoundError(f"Environment template not found: {template_path}")
        
        # Load environment variables
        load_dotenv(env_path)
        
        # Configure development-specific settings
        os.environ["ENV"] = "development"
        os.environ["DEBUG"] = "true"
        
        # Set resource limits
        for key, value in resource_limits.items():
            os.environ[f"DEV_RESOURCE_{key.upper()}"] = str(value)
        
        # Validate configuration
        test_config = get_service_config("campaign_service")
        
        return {
            "status": "success",
            "env_file": str(env_path),
            "resource_limits": resource_limits
        }
        
    except Exception as e:
        logger.error(f"Failed to setup environment: {str(e)}")
        raise

def init_development_db(verbose: bool = False) -> Dict:
    """Initialize development database with schema and sample data."""
    try:
        logger.info("Initializing development database...")
        
        # Get database configuration
        config = get_service_config("campaign_service")
        
        # Initialize database
        init_database(config)
        
        # Verify database connection and schema
        with config.get_database_config() as db:
            # Verify connection
            db.execute("SELECT 1")
            
            # Create development admin user
            db.execute("""
                INSERT INTO users (id, email, role, status)
                VALUES ('dev-admin', 'admin@dev.local', 'admin', 'ACTIVE')
                ON CONFLICT (id) DO NOTHING
            """)
            
            db.commit()
        
        return {
            "status": "success",
            "tables": [table.name for table in Base.metadata.tables.values()]
        }
        
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}")
        raise

def setup_services(
    services: List[str],
    resource_limits: Dict,
    verbose: bool = False
) -> Dict:
    """Setup and validate specified backend services."""
    try:
        logger.info(f"Setting up services: {', '.join(services)}")
        results = {}
        
        for service in services:
            logger.info(f"Configuring {service}...")
            
            # Get service configuration
            config = get_service_config(service)
            
            # Configure service resources
            service_config = {
                "name": service,
                "resource_limits": resource_limits,
                "health_endpoint": f"http://localhost:8000/{service}/health",
                "metrics_endpoint": f"http://localhost:9090/{service}/metrics"
            }
            
            # Validate service configuration
            results[service] = {
                "status": "configured",
                "config": service_config
            }
        
        return {
            "status": "success",
            "services": results
        }
        
    except Exception as e:
        logger.error(f"Failed to setup services: {str(e)}")
        raise

def main() -> int:
    """Main entry point for development environment setup."""
    parser = setup_parser()
    args = parser.parse_args()
    
    # Configure logging
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    try:
        # Install dependencies
        if not args.skip_deps:
            if not install_dependencies(args.verbose):
                return 1
        
        # Setup environment
        resource_limits = DEV_RESOURCE_LIMITS
        if args.resource_limits:
            import json
            resource_limits.update(json.loads(args.resource_limits))
        
        env_result = setup_environment(args.env_file, resource_limits)
        logger.info("Environment setup completed")
        
        # Initialize database
        if not args.skip_db:
            db_result = init_development_db(args.verbose)
            logger.info("Database initialization completed")
        
        # Setup services
        service_result = setup_services(args.services, resource_limits, args.verbose)
        logger.info("Service setup completed")
        
        # Display setup summary
        logger.info("\nDevelopment Environment Setup Summary:")
        logger.info(f"Environment: {env_result['env_file']}")
        logger.info(f"Services: {', '.join(args.services)}")
        logger.info("Setup completed successfully")
        
        return 0
        
    except Exception as e:
        logger.error(f"Setup failed: {str(e)}")
        return 1

if __name__ == "__main__":
    exit(main())