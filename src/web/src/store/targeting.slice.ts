import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // v1.9.x
import { 
  AudienceSegment, 
  TargetingRule, 
  PlatformConstraints,
  Platform
} from '../../types/targeting';
import {
  getAudienceSegments,
  createAudienceSegment,
  updateAudienceSegment,
  deleteAudienceSegment,
  getPlatformConstraints
} from '../../lib/api/targeting';

// State interface with enhanced type safety
interface TargetingState {
  segments: AudienceSegment[];
  selectedSegment: AudienceSegment | null;
  platformConstraints: Record<Platform, PlatformConstraints>;
  operationLoading: Record<string, boolean>;
  operationErrors: Record<string, string | null>;
  performance: {
    lastFetch: number;
    processingTime: number;
  };
}

// Initial state with type safety
const initialState: TargetingState = {
  segments: [],
  selectedSegment: null,
  platformConstraints: {
    linkedin: {} as PlatformConstraints,
    google: {} as PlatformConstraints
  },
  operationLoading: {},
  operationErrors: {},
  performance: {
    lastFetch: 0,
    processingTime: 0
  }
};

// Async thunks with enhanced error handling and performance tracking
export const fetchSegments = createAsyncThunk(
  'targeting/fetchSegments',
  async (_, { rejectWithValue }) => {
    const startTime = performance.now();
    try {
      const segments = await getAudienceSegments();
      const processingTime = performance.now() - startTime;
      return { segments, processingTime };
    } catch (error) {
      return rejectWithValue({
        error: error instanceof Error ? error.message : 'Failed to fetch segments',
        timestamp: new Date().toISOString()
      });
    }
  }
);

export const fetchPlatformConstraints = createAsyncThunk(
  'targeting/fetchPlatformConstraints',
  async (platform: Platform, { rejectWithValue }) => {
    try {
      const constraints = await getPlatformConstraints(platform);
      return { platform, constraints };
    } catch (error) {
      return rejectWithValue({
        error: error instanceof Error ? error.message : 'Failed to fetch platform constraints',
        platform
      });
    }
  }
);

export const createSegment = createAsyncThunk(
  'targeting/createSegment',
  async (segment: Partial<AudienceSegment>, { rejectWithValue }) => {
    try {
      const newSegment = await createAudienceSegment(segment);
      return newSegment;
    } catch (error) {
      return rejectWithValue({
        error: error instanceof Error ? error.message : 'Failed to create segment',
        segment
      });
    }
  }
);

export const updateSegment = createAsyncThunk(
  'targeting/updateSegment',
  async ({ id, data }: { id: string; data: Partial<AudienceSegment> }, { rejectWithValue }) => {
    try {
      const updatedSegment = await updateAudienceSegment(id, data);
      return updatedSegment;
    } catch (error) {
      return rejectWithValue({
        error: error instanceof Error ? error.message : 'Failed to update segment',
        id
      });
    }
  }
);

export const deleteSegment = createAsyncThunk(
  'targeting/deleteSegment',
  async (id: string, { rejectWithValue }) => {
    try {
      await deleteAudienceSegment(id);
      return id;
    } catch (error) {
      return rejectWithValue({
        error: error instanceof Error ? error.message : 'Failed to delete segment',
        id
      });
    }
  }
);

// Targeting slice with comprehensive error handling and performance monitoring
const targetingSlice = createSlice({
  name: 'targeting',
  initialState,
  reducers: {
    setSelectedSegment: (state, action: PayloadAction<AudienceSegment | null>) => {
      state.selectedSegment = action.payload;
    },
    clearOperationError: (state, action: PayloadAction<string>) => {
      state.operationErrors[action.payload] = null;
    },
    resetPerformanceMetrics: (state) => {
      state.performance = initialState.performance;
    }
  },
  extraReducers: (builder) => {
    // Fetch segments handlers
    builder.addCase(fetchSegments.pending, (state) => {
      state.operationLoading['fetchSegments'] = true;
      state.operationErrors['fetchSegments'] = null;
    });
    builder.addCase(fetchSegments.fulfilled, (state, action) => {
      state.segments = action.payload.segments;
      state.performance = {
        lastFetch: Date.now(),
        processingTime: action.payload.processingTime
      };
      state.operationLoading['fetchSegments'] = false;
    });
    builder.addCase(fetchSegments.rejected, (state, action) => {
      state.operationLoading['fetchSegments'] = false;
      state.operationErrors['fetchSegments'] = action.payload as string;
    });

    // Platform constraints handlers
    builder.addCase(fetchPlatformConstraints.pending, (state, action) => {
      state.operationLoading[`fetchConstraints_${action.meta.arg}`] = true;
    });
    builder.addCase(fetchPlatformConstraints.fulfilled, (state, action) => {
      state.platformConstraints[action.payload.platform] = action.payload.constraints;
      state.operationLoading[`fetchConstraints_${action.payload.platform}`] = false;
    });
    builder.addCase(fetchPlatformConstraints.rejected, (state, action) => {
      state.operationLoading[`fetchConstraints_${action.meta.arg}`] = false;
      state.operationErrors[`fetchConstraints_${action.meta.arg}`] = action.payload as string;
    });

    // Create segment handlers
    builder.addCase(createSegment.pending, (state) => {
      state.operationLoading['createSegment'] = true;
    });
    builder.addCase(createSegment.fulfilled, (state, action) => {
      state.segments.push(action.payload);
      state.operationLoading['createSegment'] = false;
    });
    builder.addCase(createSegment.rejected, (state, action) => {
      state.operationLoading['createSegment'] = false;
      state.operationErrors['createSegment'] = action.payload as string;
    });

    // Update segment handlers
    builder.addCase(updateSegment.pending, (state) => {
      state.operationLoading['updateSegment'] = true;
    });
    builder.addCase(updateSegment.fulfilled, (state, action) => {
      const index = state.segments.findIndex(s => s.id === action.payload.id);
      if (index !== -1) {
        state.segments[index] = action.payload;
      }
      state.operationLoading['updateSegment'] = false;
    });
    builder.addCase(updateSegment.rejected, (state, action) => {
      state.operationLoading['updateSegment'] = false;
      state.operationErrors['updateSegment'] = action.payload as string;
    });

    // Delete segment handlers
    builder.addCase(deleteSegment.pending, (state) => {
      state.operationLoading['deleteSegment'] = true;
    });
    builder.addCase(deleteSegment.fulfilled, (state, action) => {
      state.segments = state.segments.filter(s => s.id !== action.payload);
      state.operationLoading['deleteSegment'] = false;
    });
    builder.addCase(deleteSegment.rejected, (state, action) => {
      state.operationLoading['deleteSegment'] = false;
      state.operationErrors['deleteSegment'] = action.payload as string;
    });
  }
});

// Export actions and reducer
export const { setSelectedSegment, clearOperationError, resetPerformanceMetrics } = targetingSlice.actions;
export default targetingSlice.reducer;

// Memoized selectors
export const selectSegments = (state: { targeting: TargetingState }) => state.targeting.segments;
export const selectSelectedSegment = (state: { targeting: TargetingState }) => state.targeting.selectedSegment;
export const selectPlatformConstraints = (state: { targeting: TargetingState }) => state.targeting.platformConstraints;
export const selectOperationLoading = (state: { targeting: TargetingState }, operation: string) => 
  state.targeting.operationLoading[operation] || false;
export const selectOperationError = (state: { targeting: TargetingState }, operation: string) => 
  state.targeting.operationErrors[operation] || null;
export const selectPerformanceMetrics = (state: { targeting: TargetingState }) => state.targeting.performance;