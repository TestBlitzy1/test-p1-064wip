import { useRouter } from 'next/navigation'; // ^14.0.0
import { useEffect, useMemo } from 'react'; // ^18.0.0
import { ErrorBoundary } from '@sentry/react'; // ^7.0.0
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../common/LoadingSpinner';

// Route configuration interface
interface RouteConfig {
  redirectTo?: string;
  fallback?: React.ReactNode;
  validateSession?: boolean;
  checkInactivity?: boolean;
}

// Default configuration
const DEFAULT_CONFIG: RouteConfig = {
  redirectTo: '/login',
  validateSession: true,
  checkInactivity: true,
};

/**
 * Higher-order component that enforces authentication and authorization requirements
 * with comprehensive security checks and performance optimizations.
 */
export const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  requiredPermissions?: string[];
  config?: Partial<RouteConfig>;
}> = ({ children, requiredPermissions = [], config = {} }) => {
  const router = useRouter();
  const { 
    isAuthenticated, 
    loading, 
    user, 
    validatePermissions, 
    refreshSession 
  } = useAuth();

  // Merge provided config with defaults
  const routeConfig = useMemo(() => ({
    ...DEFAULT_CONFIG,
    ...config
  }), [config]);

  // Store original URL for post-login redirect
  useEffect(() => {
    if (!isAuthenticated && typeof window !== 'undefined') {
      sessionStorage.setItem('redirectUrl', window.location.pathname);
    }
  }, [isAuthenticated]);

  // Session validation effect
  useEffect(() => {
    let sessionCheckInterval: NodeJS.Timeout;

    const validateSessionStatus = async () => {
      try {
        await refreshSession();
      } catch (error) {
        router.push(`${routeConfig.redirectTo}?error=session_expired`);
      }
    };

    if (isAuthenticated && routeConfig.validateSession) {
      // Initial session check
      validateSessionStatus();

      // Set up periodic session validation
      sessionCheckInterval = setInterval(validateSessionStatus, 60000); // Check every minute
    }

    return () => {
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
      }
    };
  }, [isAuthenticated, routeConfig.validateSession, refreshSession, router]);

  // Permission validation with memoization
  const hasRequiredPermissions = useMemo(() => {
    if (!requiredPermissions.length) return true;
    if (!user) return false;
    return validatePermissions(requiredPermissions);
  }, [user, requiredPermissions, validatePermissions]);

  // Loading state handler
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // Authentication check
  if (!isAuthenticated) {
    if (typeof window !== 'undefined') {
      router.push(`${routeConfig.redirectTo}?redirect=${encodeURIComponent(window.location.pathname)}`);
    }
    return null;
  }

  // Authorization check
  if (!hasRequiredPermissions) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-xl font-semibold text-red-600">
          Access Denied
        </h1>
        <p className="mt-2 text-gray-600">
          You don't have the required permissions to access this page.
        </p>
      </div>
    );
  }

  // Wrap content in error boundary for graceful error handling
  return (
    <ErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <h1 className="text-xl font-semibold text-red-600">
            Something went wrong
          </h1>
          <p className="mt-2 text-gray-600">{error.message}</p>
          <button
            onClick={resetError}
            className="mt-4 px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600"
          >
            Try again
          </button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
};

/**
 * HOC utility for protecting routes with authentication and authorization
 */
export const withProtectedRoute = (
  WrappedComponent: React.ComponentType<any>,
  requiredPermissions?: string[],
  config?: RouteConfig
) => {
  const WithProtectedRoute: React.FC<any> = (props) => (
    <ProtectedRoute requiredPermissions={requiredPermissions} config={config}>
      <WrappedComponent {...props} />
    </ProtectedRoute>
  );

  // Preserve display name for debugging
  WithProtectedRoute.displayName = `WithProtectedRoute(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`;

  return WithProtectedRoute;
};

export default ProtectedRoute;