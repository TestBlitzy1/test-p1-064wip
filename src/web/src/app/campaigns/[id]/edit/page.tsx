'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { withAuth } from '../../../../components/auth/withAuth';
import CampaignForm from '../../../../components/campaigns/CampaignForm';
import { useCampaign } from '../../../../hooks/useCampaign';
import LoadingSpinner from '../../../../components/common/LoadingSpinner';
import { Campaign } from '../../../../types/campaigns';
import { ApiError } from '../../../../types/api';
import { Permission } from '../../../../types/auth';

/**
 * Campaign edit page component with AI-powered recommendations and SLA monitoring
 * Implements F-001 Campaign Structure Generator with 30-second SLA compliance
 * and F-001-RQ-002 Multiple Ad Format Support
 */
const EditCampaignPage: React.FC = () => {
  // Get campaign ID from route parameters
  const params = useParams();
  const campaignId = params.id as string;
  const router = useRouter();

  // Initialize campaign management hook with SLA monitoring
  const {
    campaign,
    loading,
    error,
    generationProgress,
    fetchCampaign,
    updateCampaign,
    resetError
  } = useCampaign();

  // Performance monitoring state
  const [startTime] = useState<number>(Date.now());
  const [slaViolated, setSlaViolated] = useState<boolean>(false);

  // Load campaign data on mount
  useEffect(() => {
    if (campaignId) {
      fetchCampaign(campaignId);
    }
  }, [campaignId, fetchCampaign]);

  // Monitor SLA compliance
  useEffect(() => {
    const processingTime = Date.now() - startTime;
    if (processingTime > 30000 && !slaViolated) { // 30-second SLA threshold
      setSlaViolated(true);
      console.warn(`SLA violation: Campaign processing exceeded 30 seconds (${processingTime}ms)`);
    }
  }, [startTime, slaViolated]);

  /**
   * Handles form submission with validation and error handling
   */
  const handleSubmit = useCallback(async (updatedCampaign: Campaign) => {
    try {
      const result = await updateCampaign(campaignId, updatedCampaign);
      
      // Track processing time for SLA monitoring
      const processingTime = Date.now() - startTime;
      if (processingTime > 30000) {
        console.warn(`SLA violation: Update operation exceeded 30 seconds (${processingTime}ms)`);
      }

      router.push(`/campaigns/${campaignId}`);
    } catch (error) {
      console.error('Campaign update failed:', error);
      const apiError = error as ApiError;
      if (apiError.code === 'VALIDATION_ERROR') {
        // Handle validation errors
        return;
      }
      throw error;
    }
  }, [campaignId, updateCampaign, router, startTime]);

  /**
   * Handles cancellation of campaign editing
   */
  const handleCancel = useCallback(() => {
    router.push(`/campaigns/${campaignId}`);
  }, [router, campaignId]);

  /**
   * Handles progress updates during campaign generation
   */
  const handleProgress = useCallback((progress: number) => {
    // Monitor progress for SLA compliance
    if (progress < 100 && Date.now() - startTime > 30000) {
      setSlaViolated(true);
    }
  }, [startTime]);

  // Show loading state
  if (loading.status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner 
          size="large" 
          color="primary"
        />
        <span className="ml-2 text-gray-600">
          Loading campaign...
        </span>
      </div>
    );
  }

  // Show error state
  if (error || loading.status === 'error') {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <h2 className="text-red-700 text-lg font-medium">Error Loading Campaign</h2>
        <p className="text-red-600 mt-1">{error?.message || 'An unexpected error occurred'}</p>
        <button
          onClick={resetError}
          className="mt-2 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Show form
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Edit Campaign
        </h1>
        {slaViolated && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-700">
            Warning: Operation is taking longer than expected
          </div>
        )}
      </div>

      {campaign && (
        <CampaignForm
          initialValues={campaign}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onProgressUpdate={handleProgress}
        />
      )}
    </div>
  );
};

// Wrap component with authentication and permission check
export default withAuth([Permission.EDIT_CAMPAIGN])(EditCampaignPage);