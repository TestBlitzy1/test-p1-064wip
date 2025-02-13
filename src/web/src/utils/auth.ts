import { getSession } from 'next-auth/react'; // v4.24.0
import { decode } from 'jsonwebtoken'; // v9.0.0
import { UserRole, Permission, User } from '../types/auth';
import { jwtOptions } from '../config/auth.config';

// Permission cache for optimization
const permissionCache = new Map<string, Set<Permission>>();

/**
 * Enhanced authentication check with session persistence and security validations
 * @returns Promise<boolean> Authentication status
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const session = await getSession();
    
    if (!session?.user || !session?.accessToken) {
      return false;
    }

    // Validate token
    if (!isTokenValid(session.accessToken)) {
      return false;
    }

    // Update user's last active timestamp
    const user = session.user as User;
    user.lastLoginAt = new Date();

    return true;
  } catch (error) {
    console.error('Authentication check failed:', error);
    return false;
  }
}

/**
 * Advanced permission check with inheritance and caching support
 * @param permission - Permission to check
 * @param useCache - Whether to use permission cache (default: true)
 * @returns boolean Permission status
 */
export async function hasPermission(
  permission: Permission,
  useCache: boolean = true
): Promise<boolean> {
  try {
    const session = await getSession();
    if (!session?.user) {
      return false;
    }

    const user = session.user as User;
    const cacheKey = `${user.id}-${user.role}`;

    // Check cache if enabled
    if (useCache && permissionCache.has(cacheKey)) {
      const cachedPermissions = permissionCache.get(cacheKey);
      return cachedPermissions?.has(permission) || false;
    }

    // Direct permission check
    if (user.permissions.includes(permission)) {
      // Update cache
      if (useCache) {
        const permissions = new Set(user.permissions);
        permissionCache.set(cacheKey, permissions);
      }
      return true;
    }

    // Role-based permission inheritance
    const hasInheritedPermission = checkRolePermission(user.role, permission);
    
    // Update cache with inherited permissions
    if (useCache && hasInheritedPermission) {
      const permissions = permissionCache.get(cacheKey) || new Set();
      permissions.add(permission);
      permissionCache.set(cacheKey, permissions);
    }

    return hasInheritedPermission;
  } catch (error) {
    console.error('Permission check failed:', error);
    return false;
  }
}

/**
 * Role validation with hierarchy support
 * @param role - Required role
 * @returns boolean Role validation status
 */
export async function hasRole(role: UserRole): Promise<boolean> {
  try {
    const session = await getSession();
    if (!session?.user) {
      return false;
    }

    const user = session.user as User;
    const roleHierarchy = {
      [UserRole.ADMIN]: 4,
      [UserRole.MANAGER]: 3,
      [UserRole.ANALYST]: 2,
      [UserRole.VIEWER]: 1
    };

    const userRoleLevel = roleHierarchy[user.role] || 0;
    const requiredRoleLevel = roleHierarchy[role] || 0;

    return userRoleLevel >= requiredRoleLevel;
  } catch (error) {
    console.error('Role validation failed:', error);
    return false;
  }
}

/**
 * Enhanced token validation with rotation and security checks
 * @param token - JWT token to validate
 * @returns boolean Token validation status
 */
export function isTokenValid(token: string): boolean {
  try {
    if (!token) {
      return false;
    }

    const decoded = decode(token, { complete: true });
    if (!decoded) {
      return false;
    }

    // Check token expiration
    const expirationTime = (decoded.payload as any).exp * 1000;
    if (Date.now() >= expirationTime) {
      return false;
    }

    // Validate token rotation if enabled
    if (jwtOptions.rotationSettings?.enabled) {
      const issuedAt = (decoded.payload as any).iat * 1000;
      const rotationDue = issuedAt + (jwtOptions.rotationSettings.period * 1000);
      if (Date.now() >= rotationDue) {
        return false;
      }
    }

    // Validate token fingerprint if enabled
    if (jwtOptions.fingerprint) {
      const tokenFingerprint = (decoded.payload as any).fgp;
      if (!tokenFingerprint || tokenFingerprint !== generateFingerprint()) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Token validation failed:', error);
    return false;
  }
}

/**
 * Check role-based permissions
 * @param role - User role
 * @param permission - Permission to check
 * @returns boolean Permission status based on role
 */
function checkRolePermission(role: UserRole, permission: Permission): boolean {
  const rolePermissions = {
    [UserRole.ADMIN]: [
      Permission.CREATE_CAMPAIGN,
      Permission.EDIT_CAMPAIGN,
      Permission.VIEW_ANALYTICS,
      Permission.MANAGE_USERS,
      Permission.VIEW_REPORTS
    ],
    [UserRole.MANAGER]: [
      Permission.CREATE_CAMPAIGN,
      Permission.EDIT_CAMPAIGN,
      Permission.VIEW_ANALYTICS,
      Permission.VIEW_REPORTS
    ],
    [UserRole.ANALYST]: [
      Permission.VIEW_ANALYTICS,
      Permission.VIEW_REPORTS
    ],
    [UserRole.VIEWER]: [
      Permission.VIEW_REPORTS
    ]
  };

  return rolePermissions[role]?.includes(permission) || false;
}

/**
 * Generate browser fingerprint for token validation
 * @returns string Browser fingerprint
 */
function generateFingerprint(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const components = [
    window.navigator.userAgent,
    window.navigator.language,
    window.screen.colorDepth,
    window.screen.width,
    window.screen.height
  ];

  return components.join('|');
}