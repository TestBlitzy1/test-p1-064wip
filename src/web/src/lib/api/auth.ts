import { signIn, signOut } from 'next-auth/react'; // v4.24.0
import CryptoJS from 'crypto-js'; // v4.1.1
import jwtDecode from 'jwt-decode'; // v3.1.2

import { apiClient } from '../../utils/api-client';
import { LoginCredentials, AuthResponse, User } from '../../types/auth';
import { API_ENDPOINTS } from '../../config/constants';

// Security constants
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes in ms
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in ms
const REQUEST_TIMEOUT = 30000; // 30 seconds

// In-memory storage for security measures
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();

/**
 * Generates a secure request signature for authentication
 * @param payload - Data to sign
 * @returns Encrypted signature
 */
const generateRequestSignature = (payload: any): string => {
  const timestamp = Date.now().toString();
  const dataToSign = JSON.stringify(payload) + timestamp;
  return CryptoJS.HmacSHA256(dataToSign, process.env.NEXT_PUBLIC_API_SECRET || '').toString();
};

/**
 * Validates JWT token structure and expiration
 * @param token - JWT token to validate
 * @returns Boolean indicating token validity
 */
const isValidToken = (token: string): boolean => {
  try {
    const decoded = jwtDecode<{ exp: number }>(token);
    return decoded.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

/**
 * Checks and manages login attempt limits
 * @param email - User email
 * @returns Boolean indicating if login is allowed
 */
const checkLoginAttempts = (email: string): boolean => {
  const attempts = loginAttempts.get(email);
  const now = Date.now();

  if (!attempts) {
    loginAttempts.set(email, { count: 1, lastAttempt: now });
    return true;
  }

  if (now - attempts.lastAttempt > LOCKOUT_DURATION) {
    loginAttempts.set(email, { count: 1, lastAttempt: now });
    return true;
  }

  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    return false;
  }

  attempts.count += 1;
  attempts.lastAttempt = now;
  loginAttempts.set(email, attempts);
  return true;
};

/**
 * Enhanced authentication function with comprehensive security measures
 * @param credentials - User login credentials
 * @returns Authentication response with user data and tokens
 */
export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  if (!checkLoginAttempts(credentials.email)) {
    throw new Error('Account temporarily locked. Please try again later.');
  }

  try {
    const signature = generateRequestSignature(credentials);
    
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      credentials,
      {
        headers: {
          'X-Request-Signature': signature,
          'X-Client-Timestamp': Date.now().toString()
        },
        timeout: REQUEST_TIMEOUT
      }
    );

    if (response.data.accessToken && !isValidToken(response.data.accessToken)) {
      throw new Error('Invalid token received from server');
    }

    // Clear login attempts on successful login
    loginAttempts.delete(credentials.email);

    // Initialize NextAuth session
    await signIn('credentials', {
      ...credentials,
      redirect: false
    });

    return response.data;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Authentication failed');
  }
};

/**
 * Secure logout function with comprehensive session cleanup
 */
export const logout = async (): Promise<void> => {
  try {
    // Invalidate server-side session
    await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT, {});

    // Clear client-side session
    await signOut({ redirect: false });

    // Clear any stored tokens or session data
    localStorage.removeItem('user');
    sessionStorage.clear();

    // Clear all cookies
    document.cookie.split(';').forEach(cookie => {
      document.cookie = cookie
        .replace(/^ +/, '')
        .replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Continue with client-side cleanup even if server request fails
    await signOut({ redirect: false });
  }
};

/**
 * Enhanced token refresh with security validations
 * @param refreshToken - Current refresh token
 * @returns New authentication response with fresh tokens
 */
export const refreshToken = async (refreshToken: string): Promise<AuthResponse> => {
  if (!isValidToken(refreshToken)) {
    throw new Error('Invalid refresh token');
  }

  const signature = generateRequestSignature({ refreshToken });

  try {
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.REFRESH,
      { refreshToken },
      {
        headers: {
          'X-Request-Signature': signature,
          'X-Client-Timestamp': Date.now().toString()
        },
        timeout: REQUEST_TIMEOUT
      }
    );

    if (!isValidToken(response.data.accessToken)) {
      throw new Error('Invalid token received from server');
    }

    return response.data;
  } catch (error) {
    throw new Error('Token refresh failed');
  }
};

/**
 * Secure current user information retrieval
 * @returns Current user data with security context
 */
export const getCurrentUser = async (): Promise<User> => {
  try {
    const response = await apiClient.get<{ user: User }>(
      API_ENDPOINTS.AUTH.VERIFY,
      {
        headers: {
          'X-Client-Timestamp': Date.now().toString()
        },
        timeout: REQUEST_TIMEOUT
      }
    );

    return response.data.user;
  } catch (error) {
    throw new Error('Failed to retrieve user information');
  }
};