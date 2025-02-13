import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'; // v29.0.0
import { testApiClient } from '../utils/test-client';
import { 
  createTestUser, 
  createTestCredentials, 
  setupTestAuth, 
  cleanupTestAuth 
} from './auth.fixtures';
import { User, UserRole } from '../../../web/src/types/auth';

describe('Authentication E2E Tests', () => {
  // Clean up auth state before and after each test
  beforeEach(async () => {
    await cleanupTestAuth();
  });

  afterEach(async () => {
    await cleanupTestAuth();
  });

  describe('Login Flow', () => {
    it('should successfully login with valid credentials', async () => {
      // Create test credentials
      const credentials = createTestCredentials();
      
      // Attempt login
      const response = await testApiClient.post('/api/auth/login', credentials);
      
      // Verify successful response
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: expect.any(Number),
        tokenType: 'Bearer',
        user: expect.objectContaining({
          id: expect.any(String),
          email: credentials.email,
          role: expect.any(String),
          permissions: expect.any(Array)
        })
      });

      // Verify token expiration
      expect(response.data.expiresIn).toBeGreaterThan(0);
    });

    it('should return appropriate error for invalid credentials', async () => {
      // Create invalid credentials
      const invalidCredentials = createTestCredentials({
        password: 'wrong_password'
      });

      // Attempt login
      const response = await testApiClient.post('/api/auth/login', invalidCredentials);

      // Verify error response
      expect(response.status).toBe(401);
      expect(response.data).toMatchObject({
        error: 'Invalid credentials',
        message: expect.any(String)
      });
    });

    it('should handle rate limiting on failed login attempts', async () => {
      const invalidCredentials = createTestCredentials();
      const attempts = 5;

      // Make multiple failed login attempts
      for (let i = 0; i < attempts; i++) {
        const response = await testApiClient.post('/api/auth/login', invalidCredentials);
        
        if (i >= 3) { // Rate limit should kick in after 3 attempts
          expect(response.status).toBe(429);
          expect(response.data).toMatchObject({
            error: 'Too many requests',
            retryAfter: expect.any(Number)
          });
        }
      }
    });
  });

  describe('Protected Endpoints', () => {
    it('should access protected endpoints with valid token', async () => {
      // Create and setup test user
      const testUser = createTestUser({ role: UserRole.MANAGER });
      await setupTestAuth(testUser);

      // Test protected endpoint access
      const response = await testApiClient.get('/api/campaigns');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('campaigns');
    });

    it('should refresh token when approaching expiration', async () => {
      const testUser = createTestUser();
      await setupTestAuth(testUser);

      // Get current token
      const initialResponse = await testApiClient.get('/api/auth/session');
      const initialToken = initialResponse.data.accessToken;

      // Simulate token expiration approach
      await new Promise(resolve => setTimeout(resolve, 100));

      // Make request that should trigger refresh
      const refreshResponse = await testApiClient.post('/api/auth/refresh');
      
      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.data.accessToken).not.toBe(initialToken);
    });

    it('should revoke token access when logged out', async () => {
      const testUser = createTestUser();
      await setupTestAuth(testUser);

      // Logout
      const logoutResponse = await testApiClient.post('/api/auth/logout');
      expect(logoutResponse.status).toBe(200);

      // Attempt to access protected endpoint
      const protectedResponse = await testApiClient.get('/api/campaigns');
      expect(protectedResponse.status).toBe(401);
    });
  });

  describe('Role-Based Access Control', () => {
    it('should enforce role-based access control', async () => {
      // Test different role permissions
      const roles: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER];
      
      for (const role of roles) {
        const testUser = createTestUser({ role });
        await setupTestAuth(testUser);

        // Test admin-only endpoint
        const adminEndpointResponse = await testApiClient.get('/api/admin/settings');
        
        if (role === UserRole.ADMIN) {
          expect(adminEndpointResponse.status).toBe(200);
        } else {
          expect(adminEndpointResponse.status).toBe(403);
        }

        await cleanupTestAuth();
      }
    });

    it('should validate token claims and permissions', async () => {
      const testUser = createTestUser({ role: UserRole.MANAGER });
      await setupTestAuth(testUser);

      // Verify token claims through protected endpoint
      const response = await testApiClient.get('/api/auth/verify');
      
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        user: {
          id: testUser.id,
          role: UserRole.MANAGER,
          permissions: expect.arrayContaining([
            'CREATE_CAMPAIGN',
            'EDIT_CAMPAIGN',
            'VIEW_ANALYTICS'
          ])
        }
      });
    });

    it('should audit authentication events', async () => {
      const testUser = createTestUser();
      
      // Login
      const loginResponse = await testApiClient.post('/api/auth/login', 
        createTestCredentials({ email: testUser.email }));
      expect(loginResponse.status).toBe(200);

      // Check audit log
      const auditResponse = await testApiClient.get('/api/auth/audit-log');
      
      expect(auditResponse.status).toBe(200);
      expect(auditResponse.data.events).toContainEqual(
        expect.objectContaining({
          type: 'LOGIN',
          userId: testUser.id,
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed tokens', async () => {
      testApiClient.setTestAuthToken('invalid-token');
      
      const response = await testApiClient.get('/api/campaigns');
      
      expect(response.status).toBe(401);
      expect(response.data).toMatchObject({
        error: 'Invalid token',
        message: expect.any(String)
      });
    });

    it('should handle expired tokens', async () => {
      const testUser = createTestUser();
      await setupTestAuth(testUser);

      // Simulate token expiration
      await new Promise(resolve => setTimeout(resolve, 3600 * 1000));

      const response = await testApiClient.get('/api/campaigns');
      
      expect(response.status).toBe(401);
      expect(response.data).toMatchObject({
        error: 'Token expired',
        message: expect.any(String)
      });
    });
  });
});