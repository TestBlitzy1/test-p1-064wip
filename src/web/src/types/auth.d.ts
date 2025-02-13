// next-auth v4.x
import type { Session } from "next-auth";

/**
 * Hierarchical user roles for authorization with strict type safety
 * @enum {string}
 */
export enum UserRole {
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  ANALYST = "ANALYST",
  VIEWER = "VIEWER"
}

/**
 * Granular permissions for feature-level access control
 * @enum {string}
 */
export enum Permission {
  CREATE_CAMPAIGN = "CREATE_CAMPAIGN",
  EDIT_CAMPAIGN = "EDIT_CAMPAIGN",
  DELETE_CAMPAIGN = "DELETE_CAMPAIGN",
  VIEW_CAMPAIGN = "VIEW_CAMPAIGN",
  VIEW_ANALYTICS = "VIEW_ANALYTICS",
  EXPORT_ANALYTICS = "EXPORT_ANALYTICS",
  MANAGE_USERS = "MANAGE_USERS",
  MANAGE_SETTINGS = "MANAGE_SETTINGS",
  MANAGE_BILLING = "MANAGE_BILLING"
}

/**
 * Comprehensive user data structure with role and permissions
 * @interface User
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: Permission[];
  organizationId: string;
  lastLoginAt: Date;
  isActive: boolean;
}

/**
 * Login request payload structure with remember me option
 * @interface LoginCredentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
}

/**
 * Comprehensive authentication response with JWT tokens
 * @interface AuthResponse
 */
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * Authentication state for frontend state management
 * @interface AuthState
 */
export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
}

/**
 * Extend NextAuth Session type with custom properties
 */
declare module "next-auth" {
  interface Session {
    user: User;
    accessToken: string;
    error?: string;
  }

  interface JWT {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: User;
  }
}

/**
 * Type guard to check if a role has specific permissions
 * @param role - User role to check
 * @param permission - Permission to verify
 */
export function hasPermission(role: UserRole, permission: Permission): boolean;

/**
 * Type guard to check if a user is active
 * @param user - User object to check
 */
export function isActiveUser(user: User): boolean;

/**
 * Type guard for role-based authorization
 * @param role - Role to check
 * @param requiredRole - Minimum required role
 */
export function hasRequiredRole(role: UserRole, requiredRole: UserRole): boolean;

/**
 * Type guard for session validation
 * @param session - Session object to validate
 */
export function isValidSession(session: Session): session is Required<Session>;