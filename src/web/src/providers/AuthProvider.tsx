import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react'; // v4.24.0
import { useDispatch, useSelector } from 'react-redux'; // v8.1.0
import { useAuth } from '../hooks/useAuth';
import { selectAuth } from '../store/auth.slice';
import { User, Permission, UserRole } from '../types/auth';

// Constants for session management
const SESSION_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Type definitions for enhanced context
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  sessionStatus: {
    isValid: boolean;
    expiresAt: number | null;
  };
  permissions: Permission[];
  roles: UserRole[];
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  validateAccess: (requiredPermissions: Permission[]) => boolean;
}

// Create context with undefined initial value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Enhanced Authentication Provider with comprehensive security features
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const dispatch = useDispatch();
  const { data: session, status: sessionStatus } = useSession();
  const authState = useSelector(selectAuth);
  const { 
    login: authLogin, 
    logout: authLogout, 
    refreshToken,
    validateSession 
  } = useAuth();

  // Enhanced session validation with security checks
  const validateSessionStatus = useCallback(async () => {
    if (!authState.isAuthenticated || !session) return;

    try {
      await validateSession();
    } catch (error) {
      console.error('Session validation failed:', error);
      await handleLogout();
    }
  }, [authState.isAuthenticated, session]);

  // Secure login handler with enhanced error handling
  const handleLogin = async (
    email: string, 
    password: string, 
    rememberMe: boolean = false
  ): Promise<void> => {
    try {
      await authLogin({ email, password, rememberMe });
    } catch (error) {
      console.error('Login failed:', error);
      throw new Error('Authentication failed. Please try again.');
    }
  };

  // Secure logout handler with comprehensive cleanup
  const handleLogout = async (): Promise<void> => {
    try {
      await authLogout();
      // Clear all sensitive data
      sessionStorage.clear();
      localStorage.removeItem('refreshToken');
      document.cookie.split(';').forEach(cookie => {
        document.cookie = cookie
          .replace(/^ +/, '')
          .replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if server request fails
      sessionStorage.clear();
      localStorage.clear();
    }
  };

  // Enhanced session refresh with token rotation
  const handleRefreshSession = async (): Promise<void> => {
    try {
      await refreshToken();
    } catch (error) {
      console.error('Session refresh failed:', error);
      await handleLogout();
    }
  };

  // Permission validation with role-based access control
  const validateAccess = useCallback((requiredPermissions: Permission[]): boolean => {
    if (!authState.user?.permissions) return false;
    
    return requiredPermissions.every(permission => 
      authState.user!.permissions.includes(permission)
    );
  }, [authState.user]);

  // Automatic session refresh and validation
  useEffect(() => {
    if (!authState.isAuthenticated) return;

    const sessionRefreshInterval = setInterval(
      handleRefreshSession, 
      SESSION_REFRESH_INTERVAL
    );

    const sessionValidationInterval = setInterval(
      validateSessionStatus,
      SESSION_REFRESH_INTERVAL / 2
    );

    return () => {
      clearInterval(sessionRefreshInterval);
      clearInterval(sessionValidationInterval);
    };
  }, [authState.isAuthenticated]);

  // Session expiration check
  useEffect(() => {
    if (!session?.user?.lastLoginAt) return;

    const sessionStart = new Date(session.user.lastLoginAt).getTime();
    const expirationCheck = setTimeout(() => {
      if (Date.now() - sessionStart >= MAX_SESSION_DURATION) {
        handleLogout();
      }
    }, MAX_SESSION_DURATION);

    return () => clearTimeout(expirationCheck);
  }, [session]);

  // Context value with comprehensive security features
  const contextValue: AuthContextType = {
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    loading: authState.loading,
    sessionStatus: {
      isValid: sessionStatus === 'authenticated',
      expiresAt: session?.expires ? new Date(session.expires).getTime() : null,
    },
    permissions: authState.user?.permissions || [],
    roles: authState.user?.role ? [authState.user.role] : [],
    login: handleLogin,
    logout: handleLogout,
    refreshSession: handleRefreshSession,
    validateAccess,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Enhanced hook for accessing auth context with security validations
 */
export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;