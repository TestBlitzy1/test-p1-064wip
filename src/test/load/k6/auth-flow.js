import http from 'k6/http';  // v0.45.0
import { check, sleep } from 'k6';  // v0.45.0

// Base API URL
const BASE_URL = 'http://localhost:3000/api';

// Test configuration
export const options = {
  // Load test stages
  stages: [
    { duration: '1m', target: 50 },  // Ramp up to 50 users
    { duration: '3m', target: 100 }, // Sustain 100 users
    { duration: '1m', target: 0 },   // Ramp down to 0
  ],
  // Performance thresholds
  thresholds: {
    'http_req_duration': ['p(95)<1000'], // 95% of requests should be below 1s
    'http_req_failed': ['rate<0.01'],    // Less than 1% failure rate
  },
};

// Test setup function
export function setup() {
  // Test user credentials pool
  const testUsers = [
    { email: 'test1@example.com', password: 'Password123!' },
    { email: 'test2@example.com', password: 'Password123!' },
    { email: 'test3@example.com', password: 'Password123!' },
  ];

  // Test configuration
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    timeouts: {
      request: 5000,  // 5s request timeout
      session: 3600,  // 1h session duration
    },
    validation: {
      tokenFormat: /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/,
      minTokenLength: 100,
    },
  };

  return {
    users: testUsers,
    config: config,
  };
}

// Main test function
export default function(data) {
  // Select random test user
  const user = data.users[Math.floor(Math.random() * data.users.length)];
  
  // Execute login flow
  const loginResponse = login(user, data.config);
  
  // Validate login success
  if (loginResponse.success) {
    // Add think time between operations (1-5 seconds)
    sleep(Math.random() * 4 + 1);
    
    // Refresh token
    const refreshResponse = refreshToken(loginResponse.refreshToken, data.config);
    
    // Validate refresh success
    if (refreshResponse.success) {
      // Add think time before logout
      sleep(Math.random() * 4 + 1);
      
      // Execute logout
      logout(refreshResponse.accessToken, data.config);
    }
  }
  
  // Add variable delay between iterations (2-8 seconds)
  sleep(Math.random() * 6 + 2);
}

// Login function
function login(credentials, config) {
  const loginUrl = `${BASE_URL}/auth/login`;
  
  const payload = JSON.stringify({
    email: credentials.email,
    password: credentials.password,
  });

  const response = http.post(loginUrl, payload, {
    headers: config.headers,
    timeout: config.timeouts.request,
  });

  // Validate login response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'has access token': (r) => r.json('accessToken') !== undefined,
    'has refresh token': (r) => r.json('refreshToken') !== undefined,
    'tokens are valid format': (r) => {
      const tokens = r.json();
      return config.validation.tokenFormat.test(tokens.accessToken) &&
             config.validation.tokenFormat.test(tokens.refreshToken);
    },
    'tokens meet length requirement': (r) => {
      const tokens = r.json();
      return tokens.accessToken.length >= config.validation.minTokenLength &&
             tokens.refreshToken.length >= config.validation.minTokenLength;
    },
  });

  return {
    success: success,
    accessToken: response.json('accessToken'),
    refreshToken: response.json('refreshToken'),
  };
}

// Token refresh function
function refreshToken(refreshToken, config) {
  const refreshUrl = `${BASE_URL}/auth/refresh`;
  
  const payload = JSON.stringify({
    refreshToken: refreshToken,
  });

  const response = http.post(refreshUrl, payload, {
    headers: config.headers,
    timeout: config.timeouts.request,
  });

  // Validate refresh response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'has new access token': (r) => r.json('accessToken') !== undefined,
    'has new refresh token': (r) => r.json('refreshToken') !== undefined,
    'new tokens are valid format': (r) => {
      const tokens = r.json();
      return config.validation.tokenFormat.test(tokens.accessToken) &&
             config.validation.tokenFormat.test(tokens.refreshToken);
    },
  });

  return {
    success: success,
    accessToken: response.json('accessToken'),
    refreshToken: response.json('refreshToken'),
  };
}

// Logout function
function logout(accessToken, config) {
  const logoutUrl = `${BASE_URL}/auth/logout`;
  
  const headers = {
    ...config.headers,
    'Authorization': `Bearer ${accessToken}`,
  };

  const response = http.post(logoutUrl, null, {
    headers: headers,
    timeout: config.timeouts.request,
  });

  // Validate logout response
  check(response, {
    'status is 200': (r) => r.status === 200,
    'session terminated': (r) => r.status === 200 && r.json('message') === 'Logged out successfully',
  });

  return {
    success: response.status === 200,
  };
}