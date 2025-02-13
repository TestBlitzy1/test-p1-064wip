import http from 'k6/http'; // v0.40.0
import { check, sleep } from 'k6'; // v0.40.0
import { SharedArray } from '../utils/test-helpers.ts';

// Base URL for audience segmentation API
const BASE_URL = 'http://localhost:8000/api/v1/audience';

// Load test configuration with ramping stages
export const options = {
  // Load test stages for gradual ramp up and down
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '30s', target: 100 }, // Peak load of 100 users
    { duration: '1m', target: 50 },   // Scale down to 50 users
    { duration: '30s', target: 0 }    // Scale down to 0
  ],
  // Performance thresholds as per technical requirements
  thresholds: {
    'http_req_duration': ['p(95)<200'], // 95% of requests must complete within 200ms
    'http_req_failed': ['rate<0.01']    // Error rate must be below 1%
  }
};

// Load test data from mock file
const testData = new SharedArray('audience segments', function() {
  return JSON.parse(open('./data/audience.mock.ts'));
});

// Test setup function
export function setup() {
  // Initialize test configuration
  return {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
      'X-API-Version': 'v1'
    }
  };
}

// Test segment creation endpoint
export function createSegment(testData) {
  const payload = {
    name: `Test Segment ${Date.now()}`,
    description: 'Load test segment',
    platform: 'linkedin',
    targetingRules: [
      {
        ruleType: 'industry',
        operator: 'include',
        criteria: {
          industries: ['Software', 'Technology'],
          includeSubsidiaries: true
        }
      },
      {
        ruleType: 'company_size',
        operator: 'between',
        criteria: {
          minSize: 50,
          maxSize: 1000
        }
      }
    ]
  };

  const response = http.post(`${BASE_URL}/segments`, JSON.stringify(payload), {
    headers: testData.headers
  });

  check(response, {
    'segment creation successful': (r) => r.status === 201,
    'response time within limit': (r) => r.timings.duration < 200,
    'valid segment id returned': (r) => r.json('data.id') !== undefined
  });

  sleep(1);
}

// Test segment optimization endpoint
export function optimizeSegment(testData) {
  const segmentId = testData.segments[0].id;
  const payload = {
    targetMetric: 'reach',
    minConfidence: 0.8,
    weightingPreferences: {
      industry: 0.6,
      company_size: 0.4
    }
  };

  const response = http.post(
    `${BASE_URL}/segments/${segmentId}/optimize`,
    JSON.stringify(payload),
    { headers: testData.headers }
  );

  check(response, {
    'optimization successful': (r) => r.status === 200,
    'response time within limit': (r) => r.timings.duration < 200,
    'optimization suggestions returned': (r) => r.json('data.suggestedRules').length > 0
  });

  sleep(1);
}

// Test reach calculation endpoint
export function calculateReach(testData) {
  const payload = {
    targetingRules: [
      {
        ruleType: 'industry',
        operator: 'include',
        criteria: {
          industries: ['Software'],
          includeSubsidiaries: true
        }
      }
    ],
    platform: 'linkedin'
  };

  const response = http.post(
    `${BASE_URL}/reach`,
    JSON.stringify(payload),
    { headers: testData.headers }
  );

  check(response, {
    'reach calculation successful': (r) => r.status === 200,
    'response time within limit': (r) => r.timings.duration < 200,
    'reach estimate returned': (r) => r.json('data.reach') > 0,
    'confidence score provided': (r) => r.json('data.confidence') > 0
  });

  sleep(1);
}

// Default function for test execution
export default function(data) {
  // Execute segment creation test
  createSegment(data);
  sleep(1);

  // Execute segment optimization test
  optimizeSegment(data);
  sleep(1);

  // Execute reach calculation test
  calculateReach(data);
  sleep(1);
}