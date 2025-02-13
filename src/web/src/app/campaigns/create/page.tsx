'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CampaignForm from '../../../components/campaigns/CampaignForm';
import AiRecommendations from '../../../components/campaigns/AiRecommendations';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import { useCampaign } from '../../../hooks/useCampaign';
import { Campaign, PlatformType } from '../../../types/campaigns';
import { ApiError } from '../../../types/api';

// Constants for SLA requirements
const PROCESSING_TIMEOUT = 30000; // 30-second SLA requirement
const PROGRESS_INTERVAL = 1000; // Update progress every second

/**
 * Campaign creation page component with AI-powered recommendations
 * Implements strict 30-second processing time limits and comprehensive error handling
 */
const CreateCampaignPage: React.FC = () => {
  const router = useRouter();
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [error, setError] = useState<ApiError | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType | null>(null);

  const {
    createCampaign,
    generateCampaignStructure,
    loading,
    error: campaignError
  } = useCampaign();

  // Progress tracking effect
  useEffect(() => {
    let progressTimer: NodeJS.Timeout | null = null;
    
    if (loading.status === 'loading') {
      const startTime = Date.now();
      progressTimer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / PROCESSING_TIMEOUT) * 100, 99);
        setGenerationProgress(progress);

        if (elapsed >= PROCESSING_TIMEOUT) {
          clearInterval(progressTimer);
          setError({
            code: 'TIMEOUT_ERROR',
            message: 'Campaign generation exceeded 30-second time limit',
            details: { elapsed },
            timestamp: new Date().toISOString()
          });
        }
      }, PROGRESS_INTERVAL);
    }

    return () => {
      if (progressTimer) {
        clearInterval(progressTimer);
      }
    };
  }, [loading.status]);

  /**
   * Handles campaign form submission with progress tracking and timeout enforcement
   */
  const handleCampaignSubmit = useCallback(async (campaignData: Campaign) => {
    try {
      setError(null);
      setGenerationProgress(0);

      const startTime = Date.now();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Campaign generation timed out'));
        }, PROCESSING_TIMEOUT);
      });

      const campaignPromise = createCampaign(campaignData);
      const campaign = await Promise.race([campaignPromise, timeoutPromise]);

      const processingTime = Date.now() - startTime;
      if (processingTime > PROCESSING_TIMEOUT) {
        console.warn(`Campaign generation exceeded ${PROCESSING_TIMEOUT}ms SLA`);
      }

      setGenerationProgress(100);
      router.push('/campaigns');
    } catch (error) {
      setError(error as ApiError);
      setGenerationProgress(0);
    }
  }, [createCampaign, router]);

  /**
   * Handles AI recommendation selection and application
   */
  const handleRecommendationSelect = useCallback(async (recommendations: any[]) => {
    try {
      if (!selectedPlatform) return;

      const campaignStructure = await generateCampaignStructure({
        platformType: selectedPlatform,
        targetingSettings: {
          industries: [],
          jobFunctions: [],
          companySizes: [],
          locations: []
        },
        budget: 0
      });

      // Apply recommendations to campaign structure
      // Implementation would depend on recommendation structure
    } catch (error) {
      setError(error as ApiError);
    }
  }, [selectedPlatform, generateCampaignStructure]);

  /**
   * Handles platform selection change
   */
  const handlePlatformChange = useCallback((platform: PlatformType) => {
    setSelectedPlatform(platform);
  }, []);

  /**
   * Renders error message with retry option
   */
  const renderError = useCallback(() => {
    const errorMessage = error?.message || campaignError?.message;
    if (!errorMessage) return null;

    return (
      <div className="rounded-md bg-red-50 p-4 mb-4" role="alert">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Error Creating Campaign
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{errorMessage}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }, [error, campaignError]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Create New Campaign
          </h1>
        </div>
      </div>

      {renderError()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Campaign Form */}
        <div className="lg:col-span-2">
          <CampaignForm
            onSubmit={handleCampaignSubmit}
            onCancel={() => router.push('/campaigns')}
            onProgress={setGenerationProgress}
            onPlatformChange={handlePlatformChange}
          />
        </div>

        {/* AI Recommendations Panel */}
        <div className="lg:col-span-1">
          {selectedPlatform && (
            <AiRecommendations
              campaignId=""
              platformType={selectedPlatform.toLowerCase() as 'linkedin' | 'google'}
              onSelect={handleRecommendationSelect}
              timeoutDuration={PROCESSING_TIMEOUT}
            />
          )}
        </div>
      </div>

      {/* Progress Indicator */}
      {loading.status === 'loading' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center">
              <LoadingSpinner size="small" className="mr-3" />
              <span className="text-sm text-gray-600">
                Generating Campaign ({Math.round(generationProgress)}%)
              </span>
            </div>
            <div className="w-64 bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 rounded-full h-2 transition-all duration-200"
                style={{ width: `${generationProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateCampaignPage;