'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useMediaQuery } from '@mui/material';
import { useAnalytics } from '@analytics/react';
import { ErrorBoundary } from 'react-error-boundary';
import Sidebar from '../../components/layout/Sidebar';
import Navigation from '../../components/layout/Navigation';
import useAuth from '../../hooks/useAuth';

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Layout component for the campaigns section with enhanced features including
 * role-based access control, responsive design, and accessibility optimizations.
 */
const CampaignsLayout: React.FC<LayoutProps> = ({ children, className }) => {
  // Authentication and role-based access control
  const { user, isAuthenticated, validatePermissions } = useAuth();
  
  // Analytics tracking
  const analytics = useAnalytics();
  
  // Responsive sidebar state management with localStorage persistence
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sidebarCollapsed');
      return stored ? JSON.parse(stored) : false;
    }
    return false;
  });

  // Enhanced responsive design with breakpoint optimization
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)');

  // Handle sidebar toggle with smooth transitions
  const handleSidebarToggle = useCallback(() => {
    setIsCollapsed(prev => {
      const newState = !prev;
      localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
      return newState;
    });
  }, []);

  // Track layout interactions
  useEffect(() => {
    analytics.track('layout_interaction', {
      action: isCollapsed ? 'collapse_sidebar' : 'expand_sidebar',
      userRole: user?.role,
      viewport: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'
    });
  }, [isCollapsed, user?.role, isMobile, isTablet, analytics]);

  // Keyboard navigation handler
  const handleKeyboardNav = useCallback((e: KeyboardEvent) => {
    if (e.key === '[' && e.ctrlKey) {
      handleSidebarToggle();
    }
  }, [handleSidebarToggle]);

  // Setup keyboard listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyboardNav);
    return () => window.removeEventListener('keydown', handleKeyboardNav);
  }, [handleKeyboardNav]);

  // Verify user permissions
  if (!isAuthenticated || !validatePermissions(['VIEW_CAMPAIGN'])) {
    return null;
  }

  return (
    <ErrorBoundary
      FallbackComponent={({ error }) => (
        <div role="alert" className="p-4 text-red-600">
          <h2>Error in campaigns layout</h2>
          <pre>{error.message}</pre>
        </div>
      )}
    >
      {/* Skip link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-white focus:text-primary-600"
      >
        Skip to main content
      </a>

      <div className={`flex h-screen bg-gray-50 ${className}`}>
        {/* Enhanced sidebar with role-based access */}
        <Sidebar
          isCollapsed={isCollapsed}
          onToggle={handleSidebarToggle}
          role={user?.role}
        />

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Navigation with accessibility features */}
          <Navigation
            className="z-10 border-b border-gray-200"
            collapsed={isCollapsed}
            role={user?.role}
          />

          {/* Main content area with proper ARIA landmarks */}
          <main
            id="main-content"
            className={`flex-1 overflow-auto transition-all duration-300 ${
              isCollapsed ? 'ml-16' : 'ml-64'
            } ${isMobile ? 'ml-0' : ''}`}
            role="main"
            aria-label="Campaign management area"
          >
            {/* Content wrapper with proper spacing */}
            <div className="container mx-auto px-4 py-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default CampaignsLayout;