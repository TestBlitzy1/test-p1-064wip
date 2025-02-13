'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation'; // ^14.0.0
import { ErrorBoundary } from '@sentry/react'; // ^7.0.0
import CampaignPreview from '../../../components/campaigns/CampaignPreview';
import { useCampaign } from '../../../hooks/useCampaign';
import { Campaign } from '../../../types/campaigns';
import { ApiError } from '../../../types/api';
import { Permission } from '../../../types/auth';

// Constants for SLA monitoring
const SLA_THRESHOLD = 30000; // 30-second SLA requirement
const LOADING_STATES = {
  INITIAL: 'Loading campaign details...',
  PROCESSING: 'Processing campaign data...',
  ERROR: 'Error loading campaign',
  NOT_FOUND: 'Campaign not found'
};

/**
 * Error fallback component with retry functionality
 */
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <div 
    role="alert" 
    className="p-4 bg-red-50 border border-red-200 rounded-lg"
    aria-live="polite"
  >
    <h2 className="text-lg font-semibold text-red-700">Error Loading Campaign</h2>
    <p className="mt-2 text-red-600">{error.message}</p>
    <button
      onClick={resetErrorBoundary}
      className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 
                focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
      aria-label="Retry loading campaign"
    >
      Retry
    </button>
  </div>
);

/**
 * Campaign details page component with enhanced error handling and accessibility
 */
const CampaignPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const {
    campaign,
    loading,
    error,
    fetchCampaign,
    generationProgress
  } = useCampaign({ validatePlatformRules: true });

  // Initial data fetch with SLA monitoring
  useEffect(() => {
    const startTime = Date.now();
    
    const loadCampaign = async () => {
      try {
        await fetchCampaign(campaignId);
        
        const loadTime = Date.now() - startTime;
        if (loadTime > SLA_THRESHOLD) {
          console.warn(`Campaign load time exceeded ${SLA_THRESHOLD}ms SLA: ${loadTime}ms`);
        }
      } catch (error) {
        console.error('Campaign load error:', error);
      }
    };

    loadCampaign();
  }, [campaignId, fetchCampaign]);

  /**
   * Handles campaign editing with permission validation
   */
  const handleEdit = async () => {
    if (!campaign) return;

    try {
      // Navigate to edit page with campaign state
      router.push(`/campaigns/${campaignId}/edit`, {
        state: { campaign }
      });
    } catch (error) {
      console.error('Edit navigation error:', error);
    }
  };

  /**
   * Handles campaign deployment with platform-specific validation
   */
  const handleDeploy = async () => {
    if (!campaign) return;

    try {
      // Navigate to deployment flow
      router.push(`/campaigns/${campaignId}/deploy`, {
        state: { campaign }
      });
    } catch (error) {
      console.error('Deploy navigation error:', error);
    }
  };

  // Loading state with progress indication
  if (loading.status === 'loading') {
    return (
      <div 
        role="status" 
        aria-live="polite" 
        className="p-4 animate-pulse"
      >
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        {generationProgress > 0 && (
          <div className="mt-4">
            <div className="h-2 bg-blue-100 rounded-full">
              <div 
                className="h-2 bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${generationProgress}%` }}
                role="progressbar"
                aria-valuenow={generationProgress}
                aria-valuemin={0}
                aria-valuemax={100}
              ></div>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Processing: {generationProgress.toFixed(0)}%
            </p>
          </div>
        )}
      </div>
    );
  }

  // Error state with type-specific messaging
  if (error) {
    const errorMessage = (error as ApiError).message || LOADING_STATES.ERROR;
    return (
      <div 
        role="alert" 
        aria-live="assertive" 
        className="p-4 bg-red-50 border border-red-200 rounded-lg"
      >
        <p className="text-red-700">{errorMessage}</p>
      </div>
    );
  }

  // Not found state
  if (!campaign) {
    return (
      <div 
        role="alert" 
        className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
      >
        <p className="text-yellow-700">{LOADING_STATES.NOT_FOUND}</p>
      </div>
    );
  }

  // Main campaign preview
  return (
    <ErrorBoundary
      fallback={ErrorFallback}
      onError={(error) => {
        console.error('Campaign render error:', error);
      }}
    >
      <main 
        className="container mx-auto px-4 py-8"
        aria-labelledby="campaign-title"
      >
        <h1 
          id="campaign-title" 
          className="sr-only"
        >
          Campaign Details: {campaign.name}
        </h1>

        <CampaignPreview
          campaignId={campaignId}
          onEdit={handleEdit}
          onDeploy={handleDeploy}
          previewMode="detailed"
        />
      </main>
    </ErrorBoundary>
  );
};

export default CampaignPage;

// Metadata for improved SEO and accessibility
export const metadata = {
  title: 'Campaign Details',
  description: 'View and manage campaign details with real-time performance metrics',
};

// Dynamic route configuration
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 30; // Revalidate every 30 seconds