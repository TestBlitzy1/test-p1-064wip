import { faker } from '@faker-js/faker'; // ^8.0.0
import jwt from 'jsonwebtoken'; // ^9.0.0
import { User, UserRole, Permission } from '../../../web/src/types/auth';
import { testApiClient } from '../utils/test-client';

// Constants for token generation
const TEST_JWT_SECRET = 'test-jwt-secret-key-2024';
const TOKEN_EXPIRY = '1h';

/**
 * Creates a comprehensive mock user object for testing with realistic data
 * @param overrides - Optional partial User object to override generated values
 * @returns Complete mock user object with test data
 */
export function createTestUser(overrides?: Partial<User>): User {
  const user: User = {
    id: faker.string.uuid(),
    email: faker.internet.email({
      provider: 'business.example.com',
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName()
    }),
    name: faker.person.fullName(),
    role: UserRole.VIEWER,
    permissions: [
      Permission.VIEW_CAMPAIGN,
      Permission.VIEW_ANALYTICS
    ],
    organizationId: faker.string.uuid(),
    lastLoginAt: faker.date.recent({ days: 30 }),
    isActive: true,
    ...overrides
  };

  // Add role-specific permissions
  switch (user.role) {
    case UserRole.ADMIN:
      user.permissions = Object.values(Permission);
      break;
    case UserRole.MANAGER:
      user.permissions = [
        Permission.CREATE_CAMPAIGN,
        Permission.EDIT_CAMPAIGN,
        Permission.DELETE_CAMPAIGN,
        Permission.VIEW_CAMPAIGN,
        Permission.VIEW_ANALYTICS,
        Permission.EXPORT_ANALYTICS
      ];
      break;
    case UserRole.ANALYST:
      user.permissions = [
        Permission.VIEW_CAMPAIGN,
        Permission.VIEW_ANALYTICS,
        Permission.EXPORT_ANALYTICS
      ];
      break;
  }

  return user;
}

/**
 * Creates mock login credentials with configurable complexity
 * @param overrides - Optional credential overrides
 * @returns Mock credentials object
 */
export function createTestCredentials(overrides?: Partial<LoginCredentials>): LoginCredentials {
  return {
    email: faker.internet.email({
      provider: 'business.example.com'
    }),
    password: faker.internet.password({
      length: 12,
      prefix: 'Test@',
      pattern: /[A-Za-z0-9@#$%^&*]/
    }),
    rememberMe: faker.datatype.boolean(),
    ...overrides
  };
}

/**
 * Generates a complete test JWT token with role-based claims
 * @param user - User object to generate token for
 * @returns Signed JWT token with complete claims payload
 */
export function createTestAuthToken(user: User): string {
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: user.permissions,
    organizationId: user.organizationId,
    lastLoginAt: user.lastLoginAt.toISOString(),
    isActive: user.isActive,
    // Standard JWT claims
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
    iss: 'test-sales-intelligence-platform',
    aud: 'test-client'
  };

  return jwt.sign(payload, TEST_JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: TOKEN_EXPIRY
  });
}

/**
 * Sets up complete authentication state for tests with validation
 * @param user - User object to authenticate as
 * @returns Promise indicating successful setup
 */
export async function setupTestAuth(user: User): Promise<void> {
  // Validate user object
  if (!user.id || !user.email || !user.role) {
    throw new Error('Invalid user object for test auth setup');
  }

  // Generate and set auth token
  const token = createTestAuthToken(user);
  testApiClient.setTestAuthToken(token);
}

/**
 * Thoroughly cleans up authentication state after tests
 * @returns Promise indicating successful cleanup
 */
export async function cleanupTestAuth(): Promise<void> {
  testApiClient.clearTestAuthToken();
}

// Type for login credentials
interface LoginCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
}