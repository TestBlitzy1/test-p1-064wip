import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // v2.0.0
import { getCampaignPerformance, getTimeSeriesData } from '../../lib/api/analytics';
import type { 
  AnalyticsMetric, 
  CampaignPerformance, 
  MetricType,
  MetricTimeframe,
  AnalyticsTimeSeriesData
} from '../../types/analytics';
import type { DateRange } from '../../types/common';

// Constants
const CACHE_TTL = 60 * 1000; // 1 minute cache TTL
const MAX_RETRIES = 3;
const BATCH_SIZE = 50;

// State interface
interface AnalyticsState {
  loading: boolean;
  error: string | null;
  campaignPerformance: CampaignPerformance[];
  timeSeriesData: AnalyticsTimeSeriesData | null;
  currentMetrics: AnalyticsMetric[];
  selectedTimeframe: MetricTimeframe;
  selectedCampaigns: string[];
  selectedMetrics: MetricType[];
  cache: {
    [key: string]: {
      data: any;
      timestamp: number;
    }
  };
  batchQueue: {
    [key: string]: Promise<any>;
  };
  retryCount: number;
}

// Initial state
const initialState: AnalyticsState = {
  loading: false,
  error: null,
  campaignPerformance: [],
  timeSeriesData: null,
  currentMetrics: [],
  selectedTimeframe: 'DAILY',
  selectedCampaigns: [],
  selectedMetrics: ['IMPRESSIONS', 'CLICKS', 'CONVERSIONS', 'CTR', 'CPC', 'ROAS'],
  cache: {},
  batchQueue: {},
  retryCount: 0
};

// Cache key generator
const generateCacheKey = (action: string, params: any): string => {
  return `${action}_${JSON.stringify(params)}`;
};

// Async thunks
export const fetchCampaignPerformance = createAsyncThunk(
  'analytics/fetchCampaignPerformance',
  async ({ 
    campaignIds, 
    period, 
    useCache = true,
    retryAttempts = MAX_RETRIES 
  }: {
    campaignIds: string[];
    period: DateRange;
    useCache?: boolean;
    retryAttempts?: number;
  }, { rejectWithValue, getState }) => {
    try {
      const cacheKey = generateCacheKey('performance', { campaignIds, period });
      const state = getState() as { analytics: AnalyticsState };
      
      // Check cache if enabled
      if (useCache && state.analytics.cache[cacheKey]) {
        const cached = state.analytics.cache[cacheKey];
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          return cached.data;
        }
      }

      const response = await getCampaignPerformance(campaignIds, period);
      return response.data;
    } catch (error) {
      if (retryAttempts > 0) {
        return fetchCampaignPerformance({ 
          campaignIds, 
          period, 
          useCache, 
          retryAttempts: retryAttempts - 1 
        });
      }
      return rejectWithValue((error as Error).message);
    }
  }
);

export const fetchTimeSeriesData = createAsyncThunk(
  'analytics/fetchTimeSeriesData',
  async ({ 
    campaignIds, 
    metrics, 
    timeframe, 
    period,
    batchSize = BATCH_SIZE 
  }: {
    campaignIds: string[];
    metrics: MetricType[];
    timeframe: MetricTimeframe;
    period: DateRange;
    batchSize?: number;
  }, { rejectWithValue, getState }) => {
    try {
      // Process in batches for large datasets
      const batches = Array.from({ 
        length: Math.ceil(campaignIds.length / batchSize) 
      }, (_, i) => campaignIds.slice(i * batchSize, (i + 1) * batchSize));

      const batchResults = await Promise.all(
        batches.map(async (batchIds) => {
          const response = await getTimeSeriesData({
            campaignIds: batchIds,
            metrics,
            timeframe,
            period
          });
          return response.data;
        })
      );

      // Combine batch results
      return batchResults.reduce((acc, curr) => ({
        ...curr,
        metrics: [...(acc.metrics || []), ...curr.metrics]
      }));
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

// Analytics slice
export const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    setSelectedTimeframe: (state, action: PayloadAction<MetricTimeframe>) => {
      state.selectedTimeframe = action.payload;
    },
    setSelectedCampaigns: (state, action: PayloadAction<string[]>) => {
      state.selectedCampaigns = action.payload;
    },
    setSelectedMetrics: (state, action: PayloadAction<MetricType[]>) => {
      state.selectedMetrics = action.payload;
    },
    clearCache: (state) => {
      state.cache = {};
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Campaign Performance
      .addCase(fetchCampaignPerformance.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCampaignPerformance.fulfilled, (state, action) => {
        state.loading = false;
        state.campaignPerformance = action.payload;
        state.retryCount = 0;
        
        // Update cache
        const cacheKey = generateCacheKey('performance', action.meta.arg);
        state.cache[cacheKey] = {
          data: action.payload,
          timestamp: Date.now()
        };
      })
      .addCase(fetchCampaignPerformance.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.retryCount++;
      })
      // Time Series Data
      .addCase(fetchTimeSeriesData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTimeSeriesData.fulfilled, (state, action) => {
        state.loading = false;
        state.timeSeriesData = action.payload;
        state.retryCount = 0;
      })
      .addCase(fetchTimeSeriesData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.retryCount++;
      });
  }
});

// Actions
export const {
  setSelectedTimeframe,
  setSelectedCampaigns,
  setSelectedMetrics,
  clearCache,
  clearError
} = analyticsSlice.actions;

// Selectors
export const selectAnalyticsState = (state: { analytics: AnalyticsState }) => state.analytics;
export const selectTimeSeriesData = (state: { analytics: AnalyticsState }) => state.analytics.timeSeriesData;
export const selectCampaignPerformance = (state: { analytics: AnalyticsState }) => state.analytics.campaignPerformance;
export const selectSelectedMetrics = (state: { analytics: AnalyticsState }) => state.analytics.selectedMetrics;
export const selectSelectedTimeframe = (state: { analytics: AnalyticsState }) => state.analytics.selectedTimeframe;
export const selectSelectedCampaigns = (state: { analytics: AnalyticsState }) => state.analytics.selectedCampaigns;
export const selectAnalyticsLoading = (state: { analytics: AnalyticsState }) => state.analytics.loading;
export const selectAnalyticsError = (state: { analytics: AnalyticsState }) => state.analytics.error;

export default analyticsSlice.reducer;