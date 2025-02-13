import SwaggerParser from '@apidevtools/swagger-parser';
import supertest from 'supertest';
import { TestState } from '../../types/test';
import { TEST_DATABASE_CONFIG } from '../../config/test-database.config';

// API specification path from environment or default
const API_SPEC_PATH = process.env.API_SPEC_PATH || './openapi.json';

// Platform-specific rate limits from technical specification
const PLATFORM_RATE_LIMITS = {
  linkedin: {
    campaignCreation: { requests: 100, window: 60 }, // 100/min
    reporting: { requests: 500, window: 60 } // 500/min
  },
  google: {
    campaignManagement: { requests: 150, window: 60 }, // 150/min
    reporting: { requests: 1000, window: 60 } // 1000/min
  },
  crm: {
    dataSync: { requests: 50, window: 60 } // 50/min
  }
};

/**
 * Validates the OpenAPI/Swagger specification document for correctness and completeness
 * including security schemes, required fields, schemas, and response codes
 */
describe('Swagger Specification Validation', () => {
  let swaggerDoc: any;

  beforeAll(async () => {
    // Parse and validate the OpenAPI document
    swaggerDoc = await SwaggerParser.validate(API_SPEC_PATH);
  });

  test('validates basic OpenAPI structure', async () => {
    expect(swaggerDoc.openapi).toMatch(/^3\./); // Ensure OpenAPI 3.x
    expect(swaggerDoc.info).toBeDefined();
    expect(swaggerDoc.paths).toBeDefined();
    expect(swaggerDoc.components).toBeDefined();
  });

  test('validates required security schemes', () => {
    const { securitySchemes } = swaggerDoc.components;
    
    // OAuth 2.0 validation
    expect(securitySchemes.OAuth2).toBeDefined();
    expect(securitySchemes.OAuth2.type).toBe('oauth2');
    expect(securitySchemes.OAuth2.flows.authorizationCode).toBeDefined();
    
    // API Key validation
    expect(securitySchemes.ApiKey).toBeDefined();
    expect(securitySchemes.ApiKey.type).toBe('apiKey');
    expect(securitySchemes.ApiKey.in).toBe('header');
  });

  test('validates common response schemas', () => {
    const { schemas } = swaggerDoc.components;
    
    // Error response schema
    expect(schemas.Error).toBeDefined();
    expect(schemas.Error.properties.code).toBeDefined();
    expect(schemas.Error.properties.message).toBeDefined();
    
    // Success response schema
    expect(schemas.ApiResponse).toBeDefined();
    expect(schemas.ApiResponse.properties.data).toBeDefined();
    expect(schemas.ApiResponse.properties.status).toBeDefined();
  });
});

/**
 * Tests each API endpoint against its Swagger documentation including parameters,
 * schemas, security, and rate limits
 */
describe('API Endpoint Documentation', () => {
  const endpointTests = [
    { path: '/campaigns', method: 'post' },
    { path: '/campaigns/{id}', method: 'get' },
    { path: '/analytics/reports', method: 'get' }
  ];

  test.each(endpointTests)('validates endpoint documentation for $method $path', async ({ path, method }) => {
    const endpoint = swaggerDoc.paths[path][method];
    
    // Validate required documentation elements
    expect(endpoint.summary).toBeDefined();
    expect(endpoint.description).toBeDefined();
    expect(endpoint.responses).toBeDefined();
    
    // Validate parameters if they exist
    if (endpoint.parameters) {
      endpoint.parameters.forEach((param: any) => {
        expect(param.name).toBeDefined();
        expect(param.in).toBeDefined();
        expect(param.required).toBeDefined();
        expect(param.schema).toBeDefined();
      });
    }

    // Validate response schemas
    Object.entries(endpoint.responses).forEach(([code, response]: [string, any]) => {
      expect(response.description).toBeDefined();
      if (code !== '204') {
        expect(response.content).toBeDefined();
      }
    });

    // Validate security requirements
    expect(endpoint.security).toBeDefined();
  });
});

/**
 * Verifies rate limit documentation for each endpoint based on platform-specific requirements
 */
describe('Rate Limit Documentation', () => {
  const platformEndpoints = [
    { endpoint: '/linkedin/campaigns', platform: 'linkedin', type: 'campaignCreation' },
    { endpoint: '/google/campaigns', platform: 'google', type: 'campaignManagement' },
    { endpoint: '/crm/sync', platform: 'crm', type: 'dataSync' }
  ];

  test.each(platformEndpoints)('validates rate limit documentation for $platform $endpoint', async ({ endpoint, platform, type }) => {
    const path = swaggerDoc.paths[endpoint];
    expect(path).toBeDefined();

    // Get expected rate limit for this platform/type
    const expectedLimit = PLATFORM_RATE_LIMITS[platform as keyof typeof PLATFORM_RATE_LIMITS][
      type as keyof typeof PLATFORM_RATE_LIMITS[keyof typeof PLATFORM_RATE_LIMITS]
    ];

    // Validate rate limit headers in response
    const successResponse = path.post ? path.post.responses['200'] : path.get.responses['200'];
    expect(successResponse.headers).toBeDefined();
    expect(successResponse.headers['X-RateLimit-Limit']).toBeDefined();
    expect(successResponse.headers['X-RateLimit-Remaining']).toBeDefined();
    expect(successResponse.headers['X-RateLimit-Reset']).toBeDefined();

    // Validate rate limit error response
    const tooManyRequestsResponse = path.post ? path.post.responses['429'] : path.get.responses['429'];
    expect(tooManyRequestsResponse).toBeDefined();
    expect(tooManyRequestsResponse.headers['Retry-After']).toBeDefined();

    // Validate rate limit documentation matches technical specification
    const rateLimitExtension = path.post ? path.post['x-rateLimit'] : path.get['x-rateLimit'];
    expect(rateLimitExtension).toBeDefined();
    expect(rateLimitExtension.requests).toBe(expectedLimit.requests);
    expect(rateLimitExtension.window).toBe(expectedLimit.window);
  });
});

// Export main validation function for use in other test suites
export { validateSwaggerSpec };

async function validateSwaggerSpec(): Promise<void> {
  const swaggerDoc = await SwaggerParser.validate(API_SPEC_PATH);
  return Promise.resolve();
}