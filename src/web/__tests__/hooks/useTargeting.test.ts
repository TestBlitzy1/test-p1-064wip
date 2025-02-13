import { renderHook, act } from '@testing-library/react-hooks'; // v8.0.1
import { Provider } from 'react-redux'; // v8.0.0
import { configureStore } from '@reduxjs/toolkit'; // v1.9.0
import { describe, it, expect, beforeEach, jest } from '@jest/globals'; // v29.0.0

import { useTargeting } from '../../src/hooks/useTargeting';
import { AudienceSegment, TargetingRule, Platform, AIInsight } from '../../src/types/targeting';
import targetingReducer, { 
  createSegment, 
  updateSegment, 
  fetchInsights 
} from '../../src/store/targeting.slice';

// Mock data
const mockSegment: AudienceSegment = {
  id: 'test-segment-1',
  name: 'Enterprise Tech Decision Makers',
  description: 'Senior tech decision makers in enterprise companies',
  platform: 'linkedin',
  targetingRules: [
    {
      id: 'rule-1',
      ruleType: 'industry',
      operator: 'include',
      criteria: {
        industries: ['Technology', 'SaaS'],
        includeSubsidiaries: true
      },
      weight: 0.8,
      isActive: true
    }
  ],
  estimatedReach: 1200000,
  confidence: 0.85,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const mockPlatformConstraints = {
  platform: 'linkedin' as Platform,
  maxRules: 20,
  supportedRuleTypes: ['industry', 'company_size', 'job_title', 'location'],
  minReach: 1000,
  maxReach: 2000000,
  ruleSpecificConstraints: {
    industry: {
      maxIndustries: 30,
      requiresSubsidiaryFlag: true
    },
    companySize: {
      minAllowed: 50,
      maxAllowed: 10000
    }
  }
};

const mockAIInsights = {
  estimatedReach: 1500000,
  confidence: 0.9,
  recommendations: [
    {
      segmentId: 'test-segment-1',
      suggestedRules: [
        {
          id: 'suggested-rule-1',
          ruleType: 'job_title',
          operator: 'include',
          criteria: {
            titles: ['CTO', 'VP of Engineering'],
            seniority: ['Senior', 'Executive'],
            exactMatch: true
          },
          weight: 0.7,
          isActive: true
        }
      ],
      expectedImpact: {
        reachIncrease: 250000,
        confidenceScore: 0.92,
        costImplication: 0.15
      },
      reasoning: ['High engagement from tech executives']
    }
  ]
};

// Test setup helper
const setupTest = () => {
  // Create mock store
  const store = configureStore({
    reducer: {
      targeting: targetingReducer
    },
    preloadedState: {
      targeting: {
        segments: [],
        selectedSegment: null,
        platformConstraints: {},
        operationLoading: {},
        operationErrors: {},
        performance: {
          lastFetch: 0,
          processingTime: 0
        }
      }
    }
  });

  // Mock API calls
  jest.spyOn(global, 'fetch').mockImplementation();
  
  // Create wrapper with store provider
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  return {
    store,
    wrapper
  };
};

describe('useTargeting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with empty segments and default state', async () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useTargeting('linkedin', { enableCache: false }), { wrapper });

    expect(result.current.segments).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.platformConstraints).toBeNull();
  });

  it('should create new segment with AI optimization', async () => {
    const { wrapper, store } = setupTest();
    
    // Mock store dispatch
    store.dispatch = jest.fn().mockImplementation(() => ({
      unwrap: () => Promise.resolve(mockSegment)
    }));

    const { result } = renderHook(() => useTargeting('linkedin', {
      validateOnChange: true,
      optimizationEnabled: true
    }), { wrapper });

    await act(async () => {
      await result.current.createSegment({
        name: mockSegment.name,
        description: mockSegment.description,
        targetingRules: mockSegment.targetingRules
      });
    });

    expect(result.current.segments).toHaveLength(1);
    expect(result.current.segments[0]).toEqual(mockSegment);
    expect(result.current.performanceMetrics.validationTime).toBeDefined();
  });

  it('should validate targeting rules against platform constraints', async () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useTargeting('linkedin', {
      validateOnChange: true
    }), { wrapper });

    // Mock platform constraints
    (result.current as any).platformConstraints = mockPlatformConstraints;

    const validRules: TargetingRule[] = [
      {
        id: 'rule-1',
        ruleType: 'industry',
        operator: 'include',
        criteria: {
          industries: ['Technology'],
          includeSubsidiaries: true
        },
        weight: 0.8,
        isActive: true
      }
    ];

    await act(async () => {
      const isValid = await result.current.validateRules(validRules);
      expect(isValid).toBe(true);
    });
  });

  it('should handle platform-specific rule violations', async () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useTargeting('linkedin', {
      validateOnChange: true
    }), { wrapper });

    // Invalid rules exceeding platform constraints
    const invalidRules: TargetingRule[] = [
      {
        id: 'rule-1',
        ruleType: 'industry',
        operator: 'include',
        criteria: {
          industries: Array(35).fill('Industry'), // Exceeds maxIndustries
          includeSubsidiaries: false // Required by platform
        },
        weight: 0.8,
        isActive: true
      }
    ];

    await act(async () => {
      const isValid = await result.current.validateRules(invalidRules);
      expect(isValid).toBe(false);
      expect(result.current.error).toBeTruthy();
    });
  });

  it('should meet performance requirements for targeting operations', async () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useTargeting('linkedin', {
      optimizationEnabled: true
    }), { wrapper });

    const startTime = performance.now();

    await act(async () => {
      await result.current.createSegment(mockSegment);
    });

    const endTime = performance.now();
    const processingTime = endTime - startTime;

    // Verify processing time is under 30 seconds as per requirements
    expect(processingTime).toBeLessThan(30000);
    expect(result.current.performanceMetrics.processingTime).toBeDefined();
  });

  it('should handle AI insights and recommendations', async () => {
    const { wrapper, store } = setupTest();
    
    // Mock store dispatch for insights
    store.dispatch = jest.fn().mockImplementation(() => ({
      unwrap: () => Promise.resolve(mockAIInsights)
    }));

    const { result } = renderHook(() => useTargeting('linkedin', {
      optimizationEnabled: true
    }), { wrapper });

    await act(async () => {
      await result.current.createSegment(mockSegment);
      expect(result.current.aiInsights).toBeDefined();
      expect(result.current.aiInsights.recommendations).toHaveLength(1);
      expect(result.current.aiInsights.confidence).toBeGreaterThan(0);
    });
  });

  it('should handle errors gracefully with retry mechanism', async () => {
    const { wrapper, store } = setupTest();
    
    // Mock store dispatch to fail initially then succeed
    let attempts = 0;
    store.dispatch = jest.fn().mockImplementation(() => ({
      unwrap: () => {
        if (attempts++ === 0) {
          throw new Error('API Error');
        }
        return Promise.resolve(mockSegment);
      }
    }));

    const { result } = renderHook(() => useTargeting('linkedin', {
      retryOnError: true
    }), { wrapper });

    await act(async () => {
      await result.current.createSegment(mockSegment);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.segments).toHaveLength(1);
    expect(attempts).toBe(2);
  });
});