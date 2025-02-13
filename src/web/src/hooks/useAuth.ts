import { useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { login, logout, refreshToken, validateSession } from '../lib/api/auth';
import { LoginCredentials, User } from '../types/auth';
import { selectAuth } from '../store/auth.slice';

// Constants for security and session management
const TOKEN_REFRESH_INTERVAL = 4 * 60 * 1000; // 4 minutes
const SESSION_CHECK_INTERVAL = 60 * 1000; // 1 minute
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'];

/**
 * Custom hook for managing authentication state, session security, and role-based access control
 * @returns Authentication state and methods
 */
export const useAuth = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const authState = useSelector(selectAuth);
  
  // Refs for interval cleanup
  const refreshTokenInterval = useRef<NodeJS.Timeout>();
  const sessionCheckInterval = useRef<NodeJS.Timeout>();
  const lastActivityTime = useRef<number>(Date.now());

  /**
   * Handles user activity tracking for session management
   */
  const handleUserActivity = useCallback(() => {
    lastActivityTime.current = Date.now();
  }, []);

  /**
   * Validates user session and handles timeouts
   */
  const checkSession = useCallback(async () => {
    const inactiveTime = Date.now() - lastActivityTime.current;
    
    if (inactiveTime >= INACTIVITY_TIMEOUT) {
      await handleLogout();
      router.push('/login?reason=inactivity');
      return;
    }

    try {
      await validateSession();
    } catch (error) {
      await handleLogout();
      router.push('/login?reason=invalid_session');
    }
  }, [router]);

  /**
   * Handles secure user login with enhanced error handling
   * @param credentials User login credentials
   */
  const handleLogin = async (credentials: LoginCredentials): Promise<void> => {
    try {
      const response = await login(credentials);
      
      // Initialize security measures
      lastActivityTime.current = Date.now();
      
      // Set up token refresh interval
      refreshTokenInterval.current = setInterval(async () => {
        try {
          await refreshToken(response.refreshToken);
        } catch (error) {
          await handleLogout();
          router.push('/login?reason=token_refresh_failed');
        }
      }, TOKEN_REFRESH_INTERVAL);

      // Set up session monitoring
      sessionCheckInterval.current = setInterval(checkSession, SESSION_CHECK_INTERVAL);

      // Redirect based on user role
      const redirectPath = getRedirectPath(response.user);
      router.push(redirectPath);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Login failed');
    }
  };

  /**
   * Handles secure logout with comprehensive cleanup
   */
  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
      
      // Clear all intervals
      if (refreshTokenInterval.current) {
        clearInterval(refreshTokenInterval.current);
      }
      if (sessionCheckInterval.current) {
        clearInterval(sessionCheckInterval.current);
      }

      // Clear session storage
      sessionStorage.clear();
      
      // Remove activity listeners
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });

      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout on client side even if server request fails
      router.push('/login');
    }
  };

  /**
   * Validates user permissions against required permissions
   * @param requiredPermissions Array of required permissions
   * @returns Boolean indicating if user has required permissions
   */
  const validatePermissions = (requiredPermissions: string[]): boolean => {
    if (!authState.user?.permissions) return false;
    return requiredPermissions.every(permission => 
      authState.user!.permissions.includes(permission)
    );
  };

  /**
   * Determines redirect path based on user role
   * @param user Authenticated user
   * @returns Redirect path
   */
  const getRedirectPath = (user: User): string => {
    switch (user.role) {
      case 'ADMIN':
        return '/admin/dashboard';
      case 'MANAGER':
        return '/dashboard';
      case 'ANALYST':
        return '/analytics';
      default:
        return '/campaigns';
    }
  };

  /**
   * Initialize authentication state and security measures
   */
  useEffect(() => {
    // Set up activity tracking
    ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, handleUserActivity);
    });

    // Initialize session check if authenticated
    if (authState.isAuthenticated) {
      sessionCheckInterval.current = setInterval(checkSession, SESSION_CHECK_INTERVAL);
    }

    // Cleanup function
    return () => {
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
      if (refreshTokenInterval.current) {
        clearInterval(refreshTokenInterval.current);
      }
      if (sessionCheckInterval.current) {
        clearInterval(sessionCheckInterval.current);
      }
    };
  }, [authState.isAuthenticated, handleUserActivity, checkSession]);

  return {
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    loading: authState.loading,
    error: authState.error,
    login: handleLogin,
    logout: handleLogout,
    validatePermissions,
    refreshSession: checkSession,
    sessionStatus: {
      lastActivity: lastActivityTime.current,
      isActive: (Date.now() - lastActivityTime.current) < INACTIVITY_TIMEOUT
    }
  };
};

export default useAuth;