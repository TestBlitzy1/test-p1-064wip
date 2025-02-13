import http from 'k6/http';
import { check, sleep } from 'k6';
import { generateTestCampaignIds } from '../utils/test-helpers';

// Base URL for analytics service
export const BASE_URL = 'http://localhost:8000/analytics';

// K6 test configuration with ramping VUs and performance thresholds
export const OPTIONS = {
  scenarios: {
    campaign_metrics: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },  // Ramp up to 50 VUs over 30s
        { duration: '1m', target: 50 },   // Stay at 50 VUs for 1 minute
        { duration: '30s', target: 0 }    // Ramp down to 0 VUs over 30s
      ]
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<500']  // 95% of requests must complete within 500ms
  }
};

// Test data setup
export function setup() {
  return {
    campaignIds: generateTestCampaignIds(1000),
    timeframes: ['1d', '7d', '30d', '90d'],
    metrics: ['impressions', 'clicks', 'conversions', 'spend', 'ctr', 'cpc', 'roas'],
    validationSchemas: {
      metrics: {
        impressions: 'number',
        clicks: 'number',
        conversions: 'number',
        spend: 'number',
        ctr: 'number',
        cpc: 'number',
        roas: 'number'
      }
    }
  };
}

// Campaign metrics endpoint test
export function getCampaignMetrics(data) {
  const campaignId = data.campaignIds[Math.floor(Math.random() * data.campaignIds.length)];
  const timeframe = data.timeframes[Math.floor(Math.random() * data.timeframes.length)];

  const response = http.get(`${BASE_URL}/metrics/${campaignId}?timeframe=${timeframe}`, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    tags: { name: 'campaign_metrics' }
  });

  // Comprehensive response validation
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response has valid structure': (r) => {
      const body = JSON.parse(r.body);
      return body.data && 
             body.status === 200 && 
             typeof body.message === 'string' &&
             typeof body.timestamp === 'string';
    },
    'metrics have correct types': (r) => {
      const metrics = JSON.parse(r.body).data;
      return data.metrics.every(metric => 
        typeof metrics[metric] === data.validationSchemas.metrics[metric]
      );
    },
    'metrics are within valid ranges': (r) => {
      const metrics = JSON.parse(r.body).data;
      return metrics.ctr >= 0 && metrics.ctr <= 100 &&
             metrics.cpc >= 0 && 
             metrics.impressions >= 0 &&
             metrics.clicks >= 0;
    }
  });

  sleep(1); // Rate limiting - 1 request per second per VU
}

// Performance trends endpoint test
export function getPerformanceTrends(data) {
  const campaignId = data.campaignIds[Math.floor(Math.random() * data.campaignIds.length)];
  const endDate = new Date().toISOString();
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const response = http.get(
    `${BASE_URL}/trends/${campaignId}?startDate=${startDate}&endDate=${endDate}`, 
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      tags: { name: 'performance_trends' }
    }
  );

  check(response, {
    'status is 200': (r) => r.status === 200,
    'trends data is valid': (r) => {
      const body = JSON.parse(r.body);
      return Array.isArray(body.data) &&
             body.data.every(point => 
               point.timestamp && 
               data.metrics.every(metric => typeof point[metric] === 'number')
             );
    },
    'trend points are chronological': (r) => {
      const points = JSON.parse(r.body).data;
      return points.every((point, i) => 
        i === 0 || new Date(point.timestamp) > new Date(points[i-1].timestamp)
      );
    }
  });

  sleep(1.5); // Rate limiting - 1 request per 1.5 seconds per VU
}

// Report generation endpoint test
export function generateReport(data) {
  const campaignId = data.campaignIds[Math.floor(Math.random() * data.campaignIds.length)];
  
  const payload = {
    campaignId,
    reportConfig: {
      metrics: data.metrics,
      dimensions: ['date', 'platform', 'campaign'],
      timeframe: data.timeframes[2], // 30d
      format: 'json'
    }
  };

  const response = http.post(
    `${BASE_URL}/reports`, 
    JSON.stringify(payload),
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      tags: { name: 'report_generation' }
    }
  );

  check(response, {
    'status is 202': (r) => r.status === 202,
    'report job created': (r) => {
      const body = JSON.parse(r.body);
      return body.data && 
             typeof body.data.jobId === 'string' &&
             body.data.status === 'QUEUED';
    }
  });

  // Poll report status if job was created successfully
  if (response.status === 202) {
    const jobId = JSON.parse(response.body).data.jobId;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const statusResponse = http.get(`${BASE_URL}/reports/${jobId}/status`);
      const status = JSON.parse(statusResponse.body).data.status;

      if (status === 'COMPLETED') {
        const reportResponse = http.get(`${BASE_URL}/reports/${jobId}/download`);
        check(reportResponse, {
          'report download successful': (r) => r.status === 200,
          'report data is valid': (r) => {
            const report = JSON.parse(r.body);
            return Array.isArray(report.data) &&
                   report.data.length > 0 &&
                   report.data.every(row => 
                     data.metrics.every(metric => typeof row[metric] === 'number')
                   );
          }
        });
        break;
      }

      attempts++;
      sleep(2); // Wait 2 seconds between status checks
    }
  }

  sleep(2); // Rate limiting - 1 request per 2 seconds per VU for report generation
}

// Default function that combines all test scenarios
export default function() {
  const testData = setup();
  
  getCampaignMetrics(testData);
  getPerformanceTrends(testData);
  generateReport(testData);
}