/**
 * Authentication configuration for the Sales & Intelligence Platform
 * Implements OAuth 2.0, JWT handling, and role-based access control with enhanced security
 * @version 1.0.0
 */

import { NextAuthOptions } from 'next-auth'; // v4.x
import { JWT } from 'next-auth/jwt'; // v4.x
import { API_ENDPOINTS } from './constants';
import { UserRole } from '../types/auth';

// Environment variables validation
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('NEXTAUTH_SECRET environment variable is not set');
}

if (!process.env.NEXTAUTH_URL) {
  throw new Error('NEXTAUTH_URL environment variable is not set');
}

// Security constants
const SECURITY_CONSTANTS = {
  MAX_LOGIN_ATTEMPTS: +(process.env.MAX_LOGIN_ATTEMPTS || 5),
  LOGIN_ATTEMPT_WINDOW: +(process.env.LOGIN_ATTEMPT_WINDOW || 900), // 15 minutes in seconds
  JWT_EXPIRY: process.env.JWT_EXPIRY || '1d',
  REFRESH_TOKEN_EXPIRY: '7d',
  PASSWORD_HASH_ROUNDS: 12,
  TOKEN_ROTATION_PERIOD: 3600, // 1 hour in seconds
} as const;

/**
 * Enhanced JWT configuration with advanced security features
 */
export const jwtOptions = {
  secret: process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET,
  maxAge: 24 * 60 * 60, // 24 hours
  encryption: true,
  rotationSettings: {
    enabled: true,
    period: SECURITY_CONSTANTS.TOKEN_ROTATION_PERIOD,
  },
  securityHeaders: {
    typ: 'JWT',
    alg: 'HS256',
  },
} as const;

/**
 * NextAuth configuration with comprehensive security measures
 */
export const authConfig: NextAuthOptions = {
  providers: [
    {
      id: 'credentials',
      name: 'Credentials',
      type: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${API_ENDPOINTS.AUTH.LOGIN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials),
          });

          if (!response.ok) {
            throw new Error('Authentication failed');
          }

          const user = await response.json();
          return user;
        } catch (error) {
          return null;
        }
      },
    },
  ],

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // 1 hour
  },

  pages: {
    signIn: '/login',
    signOut: '/logout',
    error: '/auth/error',
    verifyRequest: '/auth/verify',
  },

  callbacks: {
    /**
     * Enhanced JWT callback with security measures
     */
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        return {
          ...token,
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            permissions: user.permissions,
            organizationId: user.organizationId,
            lastLoginAt: new Date().toISOString(),
            isActive: user.isActive,
          },
          iat: Date.now() / 1000,
          exp: Date.now() / 1000 + 24 * 60 * 60,
          jti: crypto.randomUUID(),
        };
      }

      // Token rotation check
      if (Date.now() < (token.exp as number) * 1000) {
        return token;
      }

      // Token refresh logic
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${API_ENDPOINTS.AUTH.REFRESH}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token.refreshToken}`,
            'Content-Type': 'application/json',
          },
        });

        const refreshedTokens = await response.json();

        if (!response.ok) {
          throw new Error('Failed to refresh token');
        }

        return {
          ...token,
          accessToken: refreshedTokens.accessToken,
          refreshToken: refreshedTokens.refreshToken,
          iat: Date.now() / 1000,
          exp: Date.now() / 1000 + 24 * 60 * 60,
        };
      } catch (error) {
        return { ...token, error: 'RefreshAccessTokenError' };
      }
    },

    /**
     * Enhanced session callback with user information and RBAC
     */
    async session({ session, token }) {
      if (token) {
        session.user = token.user;
        session.accessToken = token.accessToken;
        session.error = token.error;
      }

      return session;
    },
  },

  events: {
    async signIn({ user }) {
      // Reset login attempts on successful sign in
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}${API_ENDPOINTS.AUTH.VERIFY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
    },
    async signOut({ token }) {
      // Invalidate tokens on sign out
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}${API_ENDPOINTS.AUTH.LOGOUT}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    },
  },

  debug: process.env.NODE_ENV === 'development',

  logger: {
    error(code, metadata) {
      console.error({ type: 'Auth Error', code, metadata });
    },
    warn(code) {
      console.warn({ type: 'Auth Warning', code });
    },
  },

  secret: process.env.NEXTAUTH_SECRET,

  // Enhanced security options
  security: {
    csrf: true,
    frameOptions: {
      sameOrigin: true,
    },
    headers: {
      contentSecurityPolicy: "default-src 'self'; script-src 'self'",
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: 'camera=(), microphone=(), geolocation=()',
      xXssProtection: '1; mode=block',
      xFrameOptions: 'SAMEORIGIN',
      xContentTypeOptions: 'nosniff',
    },
  },
};

/**
 * Role-based access control configuration
 */
export const roleConfig = {
  [UserRole.ADMIN]: ['*'], // All permissions
  [UserRole.MANAGER]: [
    'CREATE_CAMPAIGN',
    'EDIT_CAMPAIGN',
    'DELETE_CAMPAIGN',
    'VIEW_CAMPAIGN',
    'VIEW_ANALYTICS',
    'EXPORT_ANALYTICS',
  ],
  [UserRole.ANALYST]: [
    'VIEW_CAMPAIGN',
    'VIEW_ANALYTICS',
    'EXPORT_ANALYTICS',
  ],
  [UserRole.VIEWER]: [
    'VIEW_CAMPAIGN',
    'VIEW_ANALYTICS',
  ],
} as const;