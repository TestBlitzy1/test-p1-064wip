"""
Setup configuration for the Sales and Intelligence Platform backend services.
Defines package metadata, dependencies, and installation requirements for production deployment.

Version: 1.0.0
"""

import os
from pathlib import Path
from setuptools import setup, find_packages

# Import version from common package
from common import VERSION

# Constants
DESCRIPTION = "Enterprise-grade AI-powered B2B digital advertising campaign automation platform with advanced ML capabilities"
README = Path('README.md').read_text(encoding='utf-8')
REQUIRED_PYTHON = ">=3.11"
DEVELOPMENT_STATUS = "Development Status :: 4 - Beta"

def get_requirements(req_type: str) -> list:
    """
    Reads and parses requirements file to get package dependencies.
    
    Args:
        req_type: Type of requirements file ('base', 'dev', or 'prod')
        
    Returns:
        List of package requirements with version specifications
    """
    requirements_map = {
        'base': 'requirements.txt',
        'dev': 'requirements-dev.txt',
        'prod': 'requirements-prod.txt'
    }
    
    requirements_file = requirements_map.get(req_type, 'requirements.txt')
    requirements_path = Path(__file__).parent / requirements_file
    
    if not requirements_path.exists():
        return []
        
    with open(requirements_path, 'r', encoding='utf-8') as f:
        return [
            line.strip()
            for line in f
            if line.strip() and not line.startswith('#')
        ]

setup(
    # Package metadata
    name="sales-intelligence-platform",
    version=VERSION,
    description=DESCRIPTION,
    long_description=README,
    long_description_content_type="text/markdown",
    author="Sales Intelligence Platform Team",
    author_email="team@sales-intelligence-platform.com",
    
    # Package configuration
    packages=find_packages(include=[
        'ai_service*',
        'analytics_service*',
        'api_gateway*',
        'audience_service*',
        'campaign_service*',
        'common*',
        'integration_service*',
        'monitoring*',
        'security*'
    ]),
    
    # Dependencies
    python_requires=REQUIRED_PYTHON,
    install_requires=get_requirements('base'),
    extras_require={
        'dev': get_requirements('dev'),
        'prod': get_requirements('prod')
    },
    
    # Package data and entry points
    package_data={
        '': ['*.json', '*.yaml', '*.yml', '*.ini', '*.conf']
    },
    include_package_data=True,
    zip_safe=False,
    entry_points={
        'console_scripts': [
            'sip-admin=common.cli:admin_cli',
            'sip-service=common.cli:service_cli'
        ]
    },
    
    # Classifiers
    classifiers=[
        DEVELOPMENT_STATUS,
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
        'Programming Language :: Python :: 3.11',
        'Topic :: Software Development :: Libraries :: Application Frameworks'
    ],
    
    # Project URLs
    project_urls={
        'Documentation': 'https://docs.sales-intelligence-platform.com',
        'Source': 'https://github.com/org/sales-intelligence-platform'
    }
)