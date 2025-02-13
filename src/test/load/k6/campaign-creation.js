import http from 'k6/http';
import { check, sleep } from 'k6';
import { generateTestData, validateCampaignResponse, generatePlatformSpecificPayload } from '../../integration/utils/test-helpers.ts';

// Base configuration
const BASE_URL = 'http://localhost:8000/api/v1';
const SUPPORTED_PLATFORMS = ['linkedin', 'google'];
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'X-API-Version': '1.0'
};

// Test scenarios with platform-specific configurations
const TEST_SCENARIOS = [
  {
    platform: 'linkedin',
    budget: 1000,
    adFormats: ['single-image', 'carousel', 'video']
  },
  {
    platform: 'google',
    budget: 500,
    adFormats: ['responsive-search', 'display']
  }
];

// Performance thresholds based on technical requirements
const PERFORMANCE_THRESHOLDS = {
  responseTime: 30000,  // 30 seconds max processing time
  errorRate: 0.01,      // 1% error rate allowed
  successRate: 0.99     // 99% success rate required
};

// K6 test configuration
export const options = {
  scenarios: {
    // Smoke test with minimal load
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m',
      tags: { test_type: 'smoke' }
    },
    // Load test simulating normal traffic
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 50 },
        { duration: '2m', target: 0 }
      ],
      tags: { test_type: 'load' }
    },
    // Stress test to validate system limits
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '3m', target: 200 },
        { duration: '2m', target: 0 }
      ],
      tags: { test_type: 'stress' }
    }
  },
  thresholds: {
    'http_req_duration': [`p(95) < ${PERFORMANCE_THRESHOLDS.responseTime}`],
    'http_req_failed': [`rate < ${PERFORMANCE_THRESHOLDS.errorRate}`],
    'checks': [`rate > ${PERFORMANCE_THRESHOLDS.successRate}`],
    'http_reqs': ['rate > 100'],
    'http_req_waiting': ['p(95) < 25000'],
    'iteration_duration': ['p(95) < 35000']
  }
};

// Test data setup
export function setup() {
  return {
    testScenarios: TEST_SCENARIOS,
    authToken: 'test-token', // Would be replaced with actual auth in real env
    testData: generateTestData()
  };
}

// Campaign creation handler with comprehensive validation
async function handleCampaignCreation(campaignData) {
  const payload = generatePlatformSpecificPayload(campaignData);
  const headers = {
    ...DEFAULT_HEADERS,
    'Authorization': `Bearer ${campaignData.authToken}`
  };

  const startTime = new Date();
  const response = await http.post(
    `${BASE_URL}/campaigns`,
    JSON.stringify(payload),
    { headers }
  );
  const duration = new Date() - startTime;

  // Comprehensive response validation
  const validations = {
    statusSuccess: check(response, {
      'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
      'has valid campaign ID': (r) => r.json('data.id') !== undefined,
      'processing time within limit': () => duration <= PERFORMANCE_THRESHOLDS.responseTime,
      'response structure valid': (r) => validateCampaignResponse(r.json())
    }),
    responseTime: check(duration, {
      'response time within SLA': (d) => d <= PERFORMANCE_THRESHOLDS.responseTime
    })
  };

  // Add detailed response metrics
  const tags = { 
    platform: campaignData.platform,
    scenario: campaignData.testType
  };
  
  return {
    success: Object.values(validations).every(v => v),
    duration,
    response,
    validations,
    tags
  };
}

// Main test execution
export default function(data) {
  // Select random test scenario
  const scenario = data.testScenarios[Math.floor(Math.random() * data.testScenarios.length)];
  
  // Generate campaign data for selected platform
  const campaignData = {
    ...scenario,
    authToken: data.authToken,
    testType: __ITER === 0 ? 'smoke' : 'load',
    testData: data.testData
  };

  // Execute campaign creation with full validation
  const result = handleCampaignCreation(campaignData);

  // Add think time between iterations
  if (result.success) {
    sleep(Math.random() * 2 + 1); // 1-3 seconds
  } else {
    sleep(Math.random() * 5 + 3); // 3-8 seconds for error recovery
  }
}