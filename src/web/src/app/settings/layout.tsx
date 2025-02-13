'use client';

import React, { useState, useCallback, useEffect, memo } from 'react';
import { useMediaQuery } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';
import Header from '../../components/layout/Header';
import Sidebar from '../../components/layout/Sidebar';
import ProtectedRoute from '../../components/auth/ProtectedRoute';
import { useAuth } from '../../hooks/useAuth';
import { useAnalytics } from '../../hooks/useAnalytics';

interface SettingsLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Layout component for the settings section that provides a consistent structure
 * with protected route access, responsive design, and accessibility features.
 */
const SettingsLayout: React.FC<SettingsLayoutProps> = memo(({ children, className }) => {
  // State for sidebar collapse
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Media query for responsive design
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Auth and analytics hooks
  const { isAuthenticated, user } = useAuth();
  const { trackEvent } = useAnalytics();

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    setIsSidebarCollapsed(isMobile);
  }, [isMobile]);

  // Handle sidebar toggle with analytics
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const newState = !prev;
      
      // Track sidebar state change
      trackEvent({
        category: 'Settings',
        action: 'Toggle Sidebar',
        label: newState ? 'Collapsed' : 'Expanded',
        timestamp: Date.now()
      });

      return newState;
    });
  }, [trackEvent]);

  // Handle auth state changes
  const handleAuthStateChange = useCallback((isAuthenticated: boolean) => {
    trackEvent({
      category: 'Authentication',
      action: isAuthenticated ? 'Session Restored' : 'Session Ended',
      label: 'Settings Layout',
      timestamp: Date.now()
    });
  }, [trackEvent]);

  // Error fallback component
  const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
    <div role="alert" className="flex flex-col items-center justify-center min-h-screen p-4">
      <h2 className="text-xl font-semibold text-red-600 mb-4">Something went wrong</h2>
      <pre className="text-sm text-gray-500 mb-4">{error.message}</pre>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
      >
        Try again
      </button>
    </div>
  );

  return (
    <ProtectedRoute>
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={() => window.location.reload()}
      >
        <div className="flex h-screen bg-gray-50">
          {/* Sidebar */}
          <Sidebar
            isCollapsed={isSidebarCollapsed}
            onToggle={handleSidebarToggle}
            ariaLabel="Settings navigation"
          />

          {/* Main Content Area */}
          <div className={`flex-1 flex flex-col min-h-screen ${isSidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
            {/* Header */}
            <Header
              className="border-b border-gray-200"
              onAuthStateChange={handleAuthStateChange}
            />

            {/* Main Content */}
            <main
              className={`flex-1 overflow-y-auto p-6 transition-all ${className}`}
              role="main"
              aria-label="Settings content"
            >
              {/* User context banner */}
              {user && (
                <div className="mb-6 p-4 bg-white rounded-lg shadow-sm">
                  <h1 className="text-xl font-semibold text-gray-900">
                    Settings
                  </h1>
                  <p className="mt-1 text-sm text-gray-500">
                    Manage your account and platform preferences
                  </p>
                </div>
              )}

              {/* Page content */}
              <div className="bg-white rounded-lg shadow">
                {children}
              </div>
            </main>
          </div>
        </div>
      </ErrorBoundary>
    </ProtectedRoute>
  );
});

// Display name for debugging
SettingsLayout.displayName = 'SettingsLayout';

export default SettingsLayout;