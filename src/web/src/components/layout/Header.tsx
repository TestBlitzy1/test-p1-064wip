import React, { useCallback, useState, memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LoginButton } from '../auth/LoginButton';
import { LogoutButton } from '../auth/LogoutButton';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../common/Button';
import { ROUTES } from '../../config/constants';
import { useAnalytics } from '../../hooks/useAnalytics';

interface HeaderProps {
  className?: string;
}

/**
 * A responsive header component for the Sales & Intelligence Platform that provides
 * navigation, authentication controls, and branding.
 */
const Header: React.FC<HeaderProps> = memo(({ className }) => {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { trackEvent } = useAnalytics();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  /**
   * Handles navigation to settings page with analytics tracking
   */
  const handleSettingsClick = useCallback(() => {
    trackEvent({
      category: 'Navigation',
      action: 'Settings Click',
      label: user?.role,
      timestamp: Date.now()
    });
    router.push(ROUTES.SETTINGS.PROFILE);
    setIsMobileMenuOpen(false);
  }, [router, trackEvent, user?.role]);

  /**
   * Toggles mobile menu visibility with accessibility support
   */
  const handleMenuToggle = useCallback(() => {
    setIsMobileMenuOpen(prev => !prev);
    trackEvent({
      category: 'Navigation',
      action: 'Mobile Menu Toggle',
      label: isMobileMenuOpen ? 'Close' : 'Open',
      timestamp: Date.now()
    });
  }, [isMobileMenuOpen, trackEvent]);

  return (
    <header className={`bg-white shadow-sm fixed w-full top-0 z-50 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <Link href={ROUTES.HOME} className="flex items-center">
              <span className="text-xl font-bold text-primary-600">
                Sales & Intelligence Platform
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {isAuthenticated && (
              <>
                <Link 
                  href={ROUTES.DASHBOARD}
                  className="text-gray-700 hover:text-primary-600 transition-colors"
                >
                  Dashboard
                </Link>
                <Link 
                  href={ROUTES.CAMPAIGNS.LIST}
                  className="text-gray-700 hover:text-primary-600 transition-colors"
                >
                  Campaigns
                </Link>
                <Link 
                  href={ROUTES.ANALYTICS.DASHBOARD}
                  className="text-gray-700 hover:text-primary-600 transition-colors"
                >
                  Analytics
                </Link>
              </>
            )}
          </nav>

          {/* Authentication and Settings */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <Button
                  variant="text"
                  size="small"
                  onClick={handleSettingsClick}
                  className="hidden md:flex"
                  ariaLabel="Open settings"
                >
                  Settings
                </Button>
                <LogoutButton 
                  variant="outline" 
                  size="small"
                  className="hidden md:flex"
                />
              </>
            ) : (
              <LoginButton 
                variant="primary" 
                className="hidden md:flex"
              />
            )}

            {/* Mobile Menu Button */}
            <button
              type="button"
              className="md:hidden p-2 rounded-md text-gray-700 hover:text-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
              onClick={handleMenuToggle}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label="Toggle mobile menu"
            >
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        id="mobile-menu"
        className={`md:hidden ${isMobileMenuOpen ? 'block' : 'hidden'}`}
        aria-hidden={!isMobileMenuOpen}
      >
        <div className="px-2 pt-2 pb-3 space-y-1">
          {isAuthenticated ? (
            <>
              <Link
                href={ROUTES.DASHBOARD}
                className="block px-3 py-2 rounded-md text-gray-700 hover:text-primary-600 hover:bg-gray-50"
              >
                Dashboard
              </Link>
              <Link
                href={ROUTES.CAMPAIGNS.LIST}
                className="block px-3 py-2 rounded-md text-gray-700 hover:text-primary-600 hover:bg-gray-50"
              >
                Campaigns
              </Link>
              <Link
                href={ROUTES.ANALYTICS.DASHBOARD}
                className="block px-3 py-2 rounded-md text-gray-700 hover:text-primary-600 hover:bg-gray-50"
              >
                Analytics
              </Link>
              <Button
                variant="text"
                size="small"
                onClick={handleSettingsClick}
                className="w-full text-left"
                ariaLabel="Open settings"
              >
                Settings
              </Button>
              <LogoutButton 
                variant="outline" 
                size="small"
                className="w-full"
              />
            </>
          ) : (
            <LoginButton 
              variant="primary"
              className="w-full"
            />
          )}
        </div>
      </div>
    </header>
  );
});

// Display name for debugging
Header.displayName = 'Header';

export default Header;