'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useMediaQuery } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';
import Header from '../../components/layout/Header';
import Sidebar from '../../components/layout/Sidebar';
import { ThemeProvider, useTheme } from '../../providers/ThemeProvider';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useAuth } from '../../hooks/useAuth';

interface AnalyticsLayoutProps {
  children: React.ReactNode;
  className?: string;
}

const AnalyticsLayout: React.FC<AnalyticsLayoutProps> = React.memo(({ children, className }) => {
  // Authentication and permissions check
  const { user, isAuthenticated, validatePermissions } = useAuth();
  const { trackEvent } = useAnalytics();
  const { theme, isDarkMode } = useTheme();

  // Responsive sidebar state
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('analytics_sidebar_collapsed') === 'true';
    }
    return false;
  });

  // Media query for responsive design
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)');

  // Handle sidebar toggle with persistence
  const handleSidebarToggle = useCallback(() => {
    setSidebarCollapsed(prev => {
      const newState = !prev;
      localStorage.setItem('analytics_sidebar_collapsed', String(newState));
      return newState;
    });
  }, []);

  // Track page view and interactions
  useEffect(() => {
    trackEvent({
      category: 'Analytics',
      action: 'Page View',
      label: 'Analytics Dashboard',
      timestamp: Date.now()
    });
  }, [trackEvent]);

  // Keyboard shortcuts for accessibility
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Toggle sidebar with Ctrl + B
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        handleSidebarToggle();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleSidebarToggle]);

  // Error fallback component
  const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
    <div role="alert" className="p-4 bg-error-50 text-error-700 rounded-md">
      <h2 className="text-lg font-semibold mb-2">Something went wrong:</h2>
      <pre className="text-sm">{error.message}</pre>
      <button
        onClick={resetErrorBoundary}
        className="mt-4 px-4 py-2 bg-error-600 text-white rounded-md hover:bg-error-700"
      >
        Try again
      </button>
    </div>
  );

  // Main layout classes
  const layoutClasses = `
    min-h-screen
    ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}
    transition-colors duration-200
    ${className || ''}
  `;

  // Content area classes based on sidebar state and screen size
  const contentClasses = `
    flex-1
    transition-all duration-300 ease-in-out
    ${isSidebarCollapsed ? 'ml-16' : 'ml-64'}
    ${isMobile ? 'ml-0' : ''}
    pt-16
    px-4 sm:px-6 lg:px-8
  `;

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <ThemeProvider>
        <div className={layoutClasses}>
          <Header
            className="fixed top-0 w-full z-50"
            ariaLabel="Analytics dashboard header"
          />
          
          <Sidebar
            isCollapsed={isSidebarCollapsed || isMobile}
            onToggle={handleSidebarToggle}
            ariaExpanded={!isSidebarCollapsed}
          />

          <main 
            className={contentClasses}
            role="main"
            aria-label="Analytics content"
          >
            <div className="max-w-7xl mx-auto py-6">
              {/* Accessibility skip link */}
              <a 
                href="#main-content" 
                className="sr-only focus:not-sr-only focus:absolute focus:p-4"
              >
                Skip to main content
              </a>

              {/* Main content area */}
              <div
                id="main-content"
                className="relative"
                tabIndex={-1}
              >
                {children}
              </div>
            </div>
          </main>
        </div>
      </ThemeProvider>
    </ErrorBoundary>
  );
});

// Display name for debugging
AnalyticsLayout.displayName = 'AnalyticsLayout';

export default AnalyticsLayout;