"""
Integration service core package exposing platform integration and synchronization services
for managing multi-platform advertising campaigns with comprehensive monitoring and telemetry.

Version: 1.0.0
"""

from integration_service.services.platform_manager import PlatformManager
from integration_service.services.sync_manager import SyncManager

# Define package version
__version__ = "1.0.0"

# Export core service classes
__all__ = [
    "PlatformManager",  # Platform operations management with real-time performance tracking
    "SyncManager",      # Campaign data synchronization with fault tolerance
]

# Package metadata
PACKAGE_METADATA = {
    "name": "integration_service.services",
    "description": "Core integration services for multi-platform campaign management",
    "version": __version__,
    "supported_platforms": [
        "linkedin",  # LinkedIn Ads platform integration
        "google"     # Google Ads platform integration
    ],
    "service_dependencies": {
        "platform_manager": "Campaign and platform operations orchestration",
        "sync_manager": "Cross-platform data synchronization"
    }
}