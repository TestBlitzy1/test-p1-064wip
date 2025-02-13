import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // ^2.0.0
import { Campaign, CampaignTemplate, CampaignStatus, TargetingSettings, ProcessingStatus } from '../types/campaigns';
import { generateCampaignStructure } from '../lib/api/campaigns';
import { UUID } from 'crypto';
import { ApiError } from '../types/api';

// Constants
const SLICE_NAME = 'campaigns';
const GENERATION_TIMEOUT = 30000; // 30-second SLA requirement
const TEMPLATE_CACHE_KEY = 'campaign_templates_v1';

// State interface
interface CampaignsState {
  campaigns: Record<UUID, Campaign>;
  templates: Record<UUID, CampaignTemplate>;
  generationStatus: Record<UUID, {
    status: ProcessingStatus;
    progress: number;
    startTime: number;
    error?: string;
  }>;
  loading: boolean;
  error: ApiError | null;
  templateCache: {
    lastUpdated: number;
    items: Record<UUID, CampaignTemplate>;
  };
}

// Initial state
const initialState: CampaignsState = {
  campaigns: {},
  templates: {},
  generationStatus: {},
  loading: false,
  error: null,
  templateCache: {
    lastUpdated: 0,
    items: {}
  }
};

// Async thunks
export const generateAICampaign = createAsyncThunk<
  Campaign,
  {
    platformType: Campaign['platformType'];
    targetingSettings: TargetingSettings;
    budget: number;
    templateId?: UUID;
  },
  { rejectValue: ApiError }
>(
  `${SLICE_NAME}/generateAICampaign`,
  async (params, { rejectWithValue }) => {
    const startTime = Date.now();
    const generationId = crypto.randomUUID();

    try {
      const response = await generateCampaignStructure({
        platformType: params.platformType,
        targetingSettings: params.targetingSettings,
        budget: params.budget,
        template: params.templateId
      });

      // Validate SLA compliance
      const processingTime = Date.now() - startTime;
      if (processingTime > GENERATION_TIMEOUT) {
        console.warn(`Campaign generation exceeded ${GENERATION_TIMEOUT}ms SLA`);
      }

      return response.data;
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue({
          code: 'GENERATION_FAILED',
          message: error.message,
          details: { generationId },
          timestamp: new Date().toISOString()
        });
      }
      throw error;
    }
  }
);

export const manageCampaignTemplate = createAsyncThunk<
  void,
  CampaignTemplate,
  { rejectValue: ApiError }
>(
  `${SLICE_NAME}/manageTemplate`,
  async (template, { rejectWithValue }) => {
    try {
      // Update template cache in localStorage
      const cacheData = localStorage.getItem(TEMPLATE_CACHE_KEY);
      const cache = cacheData ? JSON.parse(cacheData) : { items: {} };
      
      cache.items[template.id] = {
        ...template,
        lastUsed: new Date().toISOString()
      };
      cache.lastUpdated = Date.now();

      localStorage.setItem(TEMPLATE_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue({
          code: 'TEMPLATE_CACHE_ERROR',
          message: error.message,
          details: { templateId: template.id },
          timestamp: new Date().toISOString()
        });
      }
      throw error;
    }
  }
);

// Slice definition
const campaignsSlice = createSlice({
  name: SLICE_NAME,
  initialState,
  reducers: {
    updateGenerationProgress(state, action: PayloadAction<{
      id: UUID;
      progress: number;
      status: ProcessingStatus;
    }>) {
      const { id, progress, status } = action.payload;
      state.generationStatus[id] = {
        ...state.generationStatus[id],
        progress,
        status
      };
    },
    clearGenerationStatus(state, action: PayloadAction<UUID>) {
      delete state.generationStatus[action.payload];
    },
    updateCampaignStatus(state, action: PayloadAction<{
      id: UUID;
      status: CampaignStatus;
    }>) {
      const { id, status } = action.payload;
      if (state.campaigns[id]) {
        state.campaigns[id].status = status;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Generate AI Campaign
      .addCase(generateAICampaign.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(generateAICampaign.fulfilled, (state, action) => {
        state.loading = false;
        state.campaigns[action.payload.id] = action.payload;
      })
      .addCase(generateAICampaign.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || {
          code: 'UNKNOWN_ERROR',
          message: 'Campaign generation failed',
          details: {},
          timestamp: new Date().toISOString()
        };
      })
      // Manage Template
      .addCase(manageCampaignTemplate.fulfilled, (state, action) => {
        state.templateCache.lastUpdated = Date.now();
      })
      .addCase(manageCampaignTemplate.rejected, (state, action) => {
        state.error = action.payload || null;
      });
  }
});

// Selectors
export const selectCampaigns = (state: { campaigns: CampaignsState }) => 
  Object.values(state.campaigns.campaigns);

export const selectGenerationStatus = (state: { campaigns: CampaignsState }, id: UUID) =>
  state.campaigns.generationStatus[id];

export const selectTemplateCache = (state: { campaigns: CampaignsState }) =>
  state.campaigns.templateCache;

export const selectSLACompliance = (state: { campaigns: CampaignsState }, id: UUID) => {
  const status = state.campaigns.generationStatus[id];
  if (!status) return null;
  
  const processingTime = Date.now() - status.startTime;
  return {
    withinSLA: processingTime <= GENERATION_TIMEOUT,
    processingTime,
    slaThreshold: GENERATION_TIMEOUT
  };
};

// Actions
export const { 
  updateGenerationProgress, 
  clearGenerationStatus, 
  updateCampaignStatus 
} = campaignsSlice.actions;

// Reducer
export default campaignsSlice.reducer;