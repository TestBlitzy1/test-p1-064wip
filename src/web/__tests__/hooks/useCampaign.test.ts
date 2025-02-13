import { renderHook, act } from '@testing-library/react-hooks'; // ^8.0.0
import { Provider } from 'react-redux'; // ^8.0.0
import configureMockStore from 'redux-mock-store'; // ^1.5.4
import thunk from 'redux-thunk'; // ^2.4.0
import fetchMock from 'jest-fetch-mock'; // ^3.0.0
import { useCampaign } from '../../src/hooks/useCampaign';
import { mockLinkedInCampaign, mockGoogleCampaign } from '../../../test/mocks/data/campaign.mock';
import { PlatformType, ProcessingStatus } from '../../src/types/campaigns';

// Constants
const GENERATION_TIMEOUT = 30000; // 30-second SLA requirement
const PROGRESS_INTERVAL = 1000;

// Configure mock store
const mockStore = configureMockStore([thunk]);

describe('useCampaign', () => {
  let store: any;
  let wrapper: any;

  beforeEach(() => {
    fetchMock.resetMocks();
    jest.useFakeTimers();
    store = mockStore({
      campaigns: {
        campaigns: {},
        loading: false,
        error: null,
        generationStatus: {}
      }
    });
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('AI Campaign Generation', () => {
    it('should generate optimized campaign structure within 30 seconds', async () => {
      const { result } = renderHook(() => useCampaign(), { wrapper });
      const startTime = Date.now();

      const targetingSettings = {
        industries: [{ id: '1', name: 'Technology' }],
        locations: [{ country: 'US' }],
        jobFunctions: [{ id: '1', title: 'IT', seniority: ['Senior'] }],
        companySizes: [{ min: 50, max: 1000, label: 'Mid-size' }]
      };

      const generatePromise = act(async () => {
        await result.current.generateCampaignStructure({
          platformType: 'LINKEDIN',
          targetingSettings,
          budget: 10000
        });
      });

      // Simulate progress updates
      for (let i = 0; i < 29; i++) {
        jest.advanceTimersByTime(PROGRESS_INTERVAL);
        expect(result.current.generationProgress).toBeLessThan(100);
      }

      await generatePromise;
      const processingTime = Date.now() - startTime;
      
      expect(processingTime).toBeLessThanOrEqual(GENERATION_TIMEOUT);
      expect(result.current.generationProgress).toBe(100);
      expect(result.current.error).toBeNull();
    });

    it('should handle generation timeout gracefully', async () => {
      const { result } = renderHook(() => useCampaign(), { wrapper });

      const generatePromise = act(async () => {
        try {
          await result.current.generateCampaignStructure({
            platformType: 'LINKEDIN',
            targetingSettings: mockLinkedInCampaign.targetingSettings,
            budget: 10000
          });
        } catch (error) {
          expect(error).toBeDefined();
          expect(error.code).toBe('GENERATION_TIMEOUT');
        }
      });

      // Simulate timeout
      jest.advanceTimersByTime(GENERATION_TIMEOUT + 1000);
      await generatePromise;

      expect(result.current.error).toBeDefined();
      expect(result.current.loading.status).toBe('error');
    });

    it('should track generation progress accurately', async () => {
      const { result } = renderHook(() => useCampaign(), { wrapper });
      const progressValues: number[] = [];

      const generatePromise = act(async () => {
        await result.current.generateCampaignStructure({
          platformType: 'LINKEDIN',
          targetingSettings: mockLinkedInCampaign.targetingSettings,
          budget: 10000
        });
      });

      // Capture progress updates
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(PROGRESS_INTERVAL);
        progressValues.push(result.current.generationProgress);
      }

      await generatePromise;

      expect(progressValues).toHaveLength(10);
      expect(progressValues[0]).toBeGreaterThan(0);
      expect(progressValues[progressValues.length - 1]).toBeLessThanOrEqual(100);
      expect(progressValues).toEqual(expect.arrayContaining([
        expect.any(Number)
      ]));
    });
  });

  describe('Platform Support', () => {
    it('should support LinkedIn ad formats', async () => {
      const { result } = renderHook(() => useCampaign(), { wrapper });

      await act(async () => {
        const campaign = await result.current.createCampaign({
          ...mockLinkedInCampaign,
          platformType: 'LINKEDIN' as PlatformType
        });

        expect(campaign.platformSettings.linkedin).toBeDefined();
        expect(campaign.platformSettings.linkedin?.format).toMatch(
          /SINGLE_IMAGE|CAROUSEL|VIDEO|MESSAGE/
        );
      });
    });

    it('should support Google Ads formats', async () => {
      const { result } = renderHook(() => useCampaign(), { wrapper });

      await act(async () => {
        const campaign = await result.current.createCampaign({
          ...mockGoogleCampaign,
          platformType: 'GOOGLE' as PlatformType
        });

        expect(campaign.platformSettings.google).toBeDefined();
        expect(campaign.platformSettings.google?.campaignType).toMatch(
          /SEARCH|DISPLAY|VIDEO|SHOPPING/
        );
      });
    });

    it('should validate platform-specific constraints', async () => {
      const { result } = renderHook(() => useCampaign(), { wrapper });

      await act(async () => {
        try {
          await result.current.generateCampaignStructure({
            platformType: 'LINKEDIN',
            targetingSettings: {
              ...mockLinkedInCampaign.targetingSettings,
              industries: [] // Invalid: empty industries
            },
            budget: 10000
          });
        } catch (error) {
          expect(error).toBeDefined();
          expect(error.code).toBe('VALIDATION_ERROR');
        }
      });
    });
  });

  describe('Performance Requirements', () => {
    it('should meet 30-second SLA for generation', async () => {
      const { result } = renderHook(() => useCampaign(), { wrapper });
      const startTime = performance.now();

      await act(async () => {
        await result.current.generateCampaignStructure({
          platformType: 'BOTH',
          targetingSettings: mockLinkedInCampaign.targetingSettings,
          budget: 20000
        });
      });

      const processingTime = performance.now() - startTime;
      expect(processingTime).toBeLessThanOrEqual(GENERATION_TIMEOUT);
    });

    it('should optimize subsequent generations', async () => {
      const { result } = renderHook(() => useCampaign(), { wrapper });
      const timings: number[] = [];

      // Multiple generations with similar settings
      for (let i = 0; i < 3; i++) {
        const startTime = performance.now();
        await act(async () => {
          await result.current.generateCampaignStructure({
            platformType: 'LINKEDIN',
            targetingSettings: mockLinkedInCampaign.targetingSettings,
            budget: 10000
          });
        });
        timings.push(performance.now() - startTime);
      }

      // Subsequent generations should be faster due to caching
      expect(timings[1]).toBeLessThanOrEqual(timings[0]);
      expect(timings[2]).toBeLessThanOrEqual(timings[1]);
    });

    it('should handle concurrent generation requests', async () => {
      const { result } = renderHook(() => useCampaign(), { wrapper });
      const requests = [
        result.current.generateCampaignStructure({
          platformType: 'LINKEDIN',
          targetingSettings: mockLinkedInCampaign.targetingSettings,
          budget: 10000
        }),
        result.current.generateCampaignStructure({
          platformType: 'GOOGLE',
          targetingSettings: mockGoogleCampaign.targetingSettings,
          budget: 15000
        })
      ];

      await act(async () => {
        const responses = await Promise.all(requests);
        expect(responses).toHaveLength(2);
        responses.forEach(campaign => {
          expect(campaign.processingStatus).toBe('COMPLETED' as ProcessingStatus);
        });
      });
    });
  });
});