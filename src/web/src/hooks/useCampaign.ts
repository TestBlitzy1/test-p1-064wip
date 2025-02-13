import { useState, useCallback, useEffect } from 'react'; // ^18.0.0
import { useDispatch } from 'react-redux'; // ^8.0.0
import { 
  Campaign,
  PlatformType,
  TargetingSettings,
  ProcessingStatus,
  CampaignStatus
} from '../../types/campaigns';
import { campaignsActions } from '../../store/campaigns.slice';
import { ApiError } from '../../types/api';
import { LoadingState } from '../../types/common';

// Constants
const GENERATION_TIMEOUT = 30000; // 30-second SLA requirement
const PROGRESS_INTERVAL = 1000; // Update progress every second

interface UseCampaignOptions {
  initialCampaign?: Campaign;
  validatePlatformRules?: boolean;
}

interface UseCampaignReturn {
  campaign: Campaign | null;
  loading: LoadingState;
  error: ApiError | null;
  generationProgress: number;
  fetchCampaign: (id: string) => Promise<void>;
  createCampaign: (data: Partial<Campaign>) => Promise<Campaign>;
  updateCampaign: (id: string, data: Partial<Campaign>) => Promise<Campaign>;
  deleteCampaign: (id: string) => Promise<void>;
  generateCampaignStructure: (params: {
    platformType: PlatformType;
    targetingSettings: TargetingSettings;
    budget: number;
    templateId?: string;
  }) => Promise<Campaign>;
  resetError: () => void;
}

/**
 * Custom hook for managing campaign operations including AI-powered structure generation
 * @param options Configuration options for the hook
 * @returns Campaign management methods and state
 */
export function useCampaign(options: UseCampaignOptions = {}): UseCampaignReturn {
  // State management
  const [campaign, setCampaign] = useState<Campaign | null>(options.initialCampaign || null);
  const [loading, setLoading] = useState<LoadingState>({ status: 'idle', error: null });
  const [error, setError] = useState<ApiError | null>(null);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [generationTimer, setGenerationTimer] = useState<NodeJS.Timeout | null>(null);

  const dispatch = useDispatch();

  // Cleanup function for generation timer
  const cleanupGenerationTimer = useCallback(() => {
    if (generationTimer) {
      clearInterval(generationTimer);
      setGenerationTimer(null);
    }
  }, [generationTimer]);

  useEffect(() => {
    return () => {
      cleanupGenerationTimer();
    };
  }, [cleanupGenerationTimer]);

  /**
   * Handles API errors with proper error state management
   */
  const handleError = useCallback((error: any) => {
    const apiError: ApiError = {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unexpected error occurred',
      details: error.details || {},
      timestamp: new Date().toISOString()
    };
    setError(apiError);
    setLoading({ status: 'error', error: apiError });
    return apiError;
  }, []);

  /**
   * Fetches a campaign by ID
   */
  const fetchCampaign = useCallback(async (id: string) => {
    try {
      setLoading({ status: 'loading', error: null });
      const response = await dispatch(campaignsActions.fetchCampaignById(id));
      setCampaign(response.payload);
      setLoading({ status: 'success', error: null });
    } catch (error: any) {
      handleError(error);
    }
  }, [dispatch, handleError]);

  /**
   * Creates a new campaign
   */
  const createCampaign = useCallback(async (data: Partial<Campaign>): Promise<Campaign> => {
    try {
      setLoading({ status: 'loading', error: null });
      const response = await dispatch(campaignsActions.createCampaign(data));
      const newCampaign = response.payload;
      setCampaign(newCampaign);
      setLoading({ status: 'success', error: null });
      return newCampaign;
    } catch (error: any) {
      throw handleError(error);
    }
  }, [dispatch, handleError]);

  /**
   * Updates an existing campaign
   */
  const updateCampaign = useCallback(async (id: string, data: Partial<Campaign>): Promise<Campaign> => {
    try {
      setLoading({ status: 'loading', error: null });
      const response = await dispatch(campaignsActions.updateCampaign({ id, updates: data }));
      const updatedCampaign = response.payload;
      setCampaign(updatedCampaign);
      setLoading({ status: 'success', error: null });
      return updatedCampaign;
    } catch (error: any) {
      throw handleError(error);
    }
  }, [dispatch, handleError]);

  /**
   * Deletes a campaign
   */
  const deleteCampaign = useCallback(async (id: string): Promise<void> => {
    try {
      setLoading({ status: 'loading', error: null });
      await dispatch(campaignsActions.deleteCampaign(id));
      setCampaign(null);
      setLoading({ status: 'success', error: null });
    } catch (error: any) {
      throw handleError(error);
    }
  }, [dispatch, handleError]);

  /**
   * Generates AI-powered campaign structure with progress tracking
   */
  const generateCampaignStructure = useCallback(async (params: {
    platformType: PlatformType;
    targetingSettings: TargetingSettings;
    budget: number;
    templateId?: string;
  }): Promise<Campaign> => {
    try {
      setLoading({ status: 'loading', error: null });
      setGenerationProgress(0);

      // Start progress tracking
      const startTime = Date.now();
      const timer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / GENERATION_TIMEOUT) * 100, 99);
        setGenerationProgress(progress);

        if (elapsed >= GENERATION_TIMEOUT) {
          cleanupGenerationTimer();
          handleError({
            code: 'GENERATION_TIMEOUT',
            message: 'Campaign generation exceeded 30-second SLA',
            details: { elapsed }
          });
        }
      }, PROGRESS_INTERVAL);

      setGenerationTimer(timer);

      // Generate campaign structure
      const response = await dispatch(campaignsActions.generateAICampaign({
        platformType: params.platformType,
        targetingSettings: params.targetingSettings,
        budget: params.budget,
        templateId: params.templateId
      }));

      // Cleanup and finalize
      cleanupGenerationTimer();
      setGenerationProgress(100);
      const generatedCampaign = response.payload;
      setCampaign(generatedCampaign);
      setLoading({ status: 'success', error: null });

      return generatedCampaign;
    } catch (error: any) {
      cleanupGenerationTimer();
      throw handleError(error);
    }
  }, [dispatch, handleError, cleanupGenerationTimer]);

  /**
   * Resets error state
   */
  const resetError = useCallback(() => {
    setError(null);
    setLoading({ status: 'idle', error: null });
  }, []);

  return {
    campaign,
    loading,
    error,
    generationProgress,
    fetchCampaign,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    generateCampaignStructure,
    resetError
  };
}