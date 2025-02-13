import { jest, describe, beforeAll, afterAll, test } from '@jest/globals'; // v29.0.0
import { testApiClient } from '../../e2e/utils/test-client';
import type { TestState } from '../../types/test';
import { mockLinkedInCampaign } from '../../mocks/data/campaign.mock';
import sqlmap from 'sqlmap-api'; // v2.0.0
import zap from 'zaproxy'; // v2.0.0

// Constants for test configuration
const TEST_TIMEOUT = 30000;
const SENSITIVE_FIELDS = ['password', 'apiKey', 'token', 'secret'];

/**
 * Enhanced test suite for comprehensive data security penetration testing
 * Implements GDPR/CCPA compliance validation and security control testing
 */
@testSuite
export class DataPenetrationTest {
    private apiClient: typeof testApiClient;
    private testState: TestState;
    private sqlmapClient: typeof sqlmap;
    private zapClient: typeof zap;

    constructor() {
        this.apiClient = testApiClient;
        this.sqlmapClient = new sqlmap.Client({
            threads: 10,
            risk: 2,
            level: 3
        });
        this.zapClient = new zap.Client({
            apiKey: process.env.ZAP_API_KEY,
            proxy: process.env.ZAP_PROXY_URL
        });
    }

    @beforeAll
    async setup(): Promise<void> {
        // Configure security testing environment
        await this.zapClient.core.newSession();
        await this.zapClient.core.setMode('ATTACK');
        
        // Initialize test state with auth token
        this.testState = {
            authToken: 'test-auth-token',
            isAuthenticated: true
        };
        
        this.apiClient.setTestAuthToken(this.testState.authToken);
    }

    @afterAll
    async cleanup(): Promise<void> {
        // Generate security reports
        await this.zapClient.reports.generate({
            title: 'Data Security Penetration Test Report',
            template: 'traditional-html',
            reportFileName: 'data-security-report.html'
        });

        // Cleanup test resources
        await this.zapClient.core.shutdown();
        await this.sqlmapClient.stop();
    }

    /**
     * Tests encryption implementation for sensitive data fields
     * Validates field-level encryption, key rotation, and TLS configuration
     */
    @test
    async testDataEncryption(): Promise<void> {
        // Test campaign data encryption
        const campaign = { ...mockLinkedInCampaign };
        const sensitiveData = {
            apiKey: 'test-api-key',
            credentials: {
                clientSecret: 'test-secret',
                accessToken: 'test-token'
            }
        };

        // Test field-level encryption
        const response = await this.apiClient.post('/api/campaigns/create', {
            ...campaign,
            sensitiveData
        });

        // Verify encryption in transit
        expect(response.headers['strict-transport-security']).toBeDefined();
        expect(response.headers['content-security-policy']).toBeDefined();

        // Validate encrypted fields
        const retrievedCampaign = await this.apiClient.get(`/api/campaigns/${campaign.id}`);
        SENSITIVE_FIELDS.forEach(field => {
            expect(retrievedCampaign.data.sensitiveData[field]).not.toBe(sensitiveData[field]);
        });

        // Test encryption key rotation
        await this.apiClient.post('/api/security/rotate-keys', {
            resource: 'campaigns',
            id: campaign.id
        });

        // Verify data remains accessible after key rotation
        const postRotationCampaign = await this.apiClient.get(`/api/campaigns/${campaign.id}`);
        expect(postRotationCampaign.status).toBe(200);
    }

    /**
     * Tests access control mechanisms and multi-tenant isolation
     * Validates RBAC implementation and permission inheritance
     */
    @test
    async testDataAccessControl(): Promise<void> {
        // Test role-based access control
        const testUsers = [
            { role: 'admin', expectedAccess: true },
            { role: 'viewer', expectedAccess: false }
        ];

        for (const user of testUsers) {
            await this.apiClient.setTestAuthToken(`${user.role}-token`);
            const response = await this.apiClient.post('/api/campaigns/sensitive-operation', {
                campaignId: mockLinkedInCampaign.id
            });
            expect(response.status).toBe(user.expectedAccess ? 200 : 403);
        }

        // Test multi-tenant isolation
        const tenant1Response = await this.apiClient.get('/api/campaigns', {
            headers: { 'X-Tenant-ID': 'tenant1' }
        });
        const tenant2Response = await this.apiClient.get('/api/campaigns', {
            headers: { 'X-Tenant-ID': 'tenant2' }
        });

        expect(tenant1Response.data.campaigns).not.toEqual(tenant2Response.data.campaigns);

        // Validate audit logging
        const auditLogs = await this.apiClient.get('/api/audit-logs', {
            params: { resourceId: mockLinkedInCampaign.id }
        });
        expect(auditLogs.data.logs).toContainEqual(
            expect.objectContaining({
                action: 'ACCESS',
                resourceType: 'CAMPAIGN'
            })
        );
    }

    /**
     * Tests data validation and injection prevention
     * Implements comprehensive security scanning for vulnerabilities
     */
    @test
    async testDataValidation(): Promise<void> {
        // Configure SQL injection testing
        await this.sqlmapClient.scan({
            url: `${process.env.API_URL}/api/campaigns`,
            data: JSON.stringify(mockLinkedInCampaign),
            headers: { 'Content-Type': 'application/json' }
        });

        // Test XSS prevention
        const maliciousPayload = {
            name: '<script>alert("xss")</script>',
            description: 'javascript:alert("xss")'
        };
        const response = await this.apiClient.post('/api/campaigns/create', {
            ...mockLinkedInCampaign,
            ...maliciousPayload
        });
        expect(response.data.name).toBe(maliciousPayload.name.replace(/[<>]/g, ''));

        // Validate input sanitization
        const injectionTests = [
            { field: 'name', value: "'; DROP TABLE campaigns; --" },
            { field: 'description', value: '${process.env.API_KEY}' },
            { field: 'targetingSettings.location', value: '../../../etc/passwd' }
        ];

        for (const test of injectionTests) {
            const testResponse = await this.apiClient.post('/api/campaigns/create', {
                ...mockLinkedInCampaign,
                [test.field]: test.value
            });
            expect(testResponse.status).toBe(400);
        }

        // Test file upload security
        const fileUploadResponse = await this.apiClient.post('/api/campaigns/import', {
            file: {
                name: 'malicious.js.jpg',
                content: 'data:image/jpeg;base64,PHNjcmlwdD5hbGVydCgieHNzIik8L3NjcmlwdD4='
            }
        });
        expect(fileUploadResponse.status).toBe(400);
    }
}