'use client';

import React, { Suspense, useCallback, useEffect, useState, useTransition } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useQueryClient } from '@tanstack/react-query';
import CampaignList from '../../components/campaigns/CampaignList';
import PerformanceCard from '../../components/analytics/PerformanceCard';
import AiRecommendations from '../../components/campaigns/AiRecommendations';
import { useCampaign } from '../../hooks/useCampaign';
import { useAnalytics } from '../../hooks/useAnalytics';
import type { Campaign } from '../../types/campaigns';
import type { DateRange } from '../../types/common';

// Constants for performance monitoring
const REFRESH_INTERVAL = 30000; // 30-second SLA requirement
const DEFAULT_DATE_RANGE: DateRange = {
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
  endDate: new Date().toISOString()
};

// Error boundary fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="p-4 bg-red-50 rounded-lg" role="alert">
    <h3 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h3>
    <p className="text-red-600 mb-4">{error.message}</p>
    <button
      onClick={resetErrorBoundary}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
    >
      Try again
    </button>
  </div>
);

// Loading skeleton component
const LoadingSkeleton = () => (
  <div className="animate-pulse space-y-6">
    <div className="h-48 bg-gray-200 rounded-lg" />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-32 bg-gray-200 rounded-lg" />
      ))}
    </div>
  </div>
);

const HomePage = () => {
  // State management
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();

  // Custom hooks
  const { fetchCampaigns } = useCampaign();
  const { useRealTimeMetrics } = useAnalytics({
    refreshInterval: REFRESH_INTERVAL,
    retryAttempts: 3
  });

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        await fetchCampaigns();
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
      }
    };

    fetchInitialData();
  }, [fetchCampaigns]);

  // Handle campaign selection
  const handleCampaignSelect = useCallback((campaignId: string) => {
    startTransition(() => {
      setSelectedCampaigns(prev => 
        prev.includes(campaignId) 
          ? prev.filter(id => id !== campaignId)
          : [...prev, campaignId]
      );
    });
  }, []);

  // Handle data refresh
  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries(['campaigns']);
    await queryClient.invalidateQueries(['analytics']);
  }, [queryClient]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Performance Overview Section */}
        <section aria-labelledby="performance-heading">
          <h2 id="performance-heading" className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Campaign Performance Overview
          </h2>
          <ErrorBoundary FallbackComponent={ErrorFallback} onReset={handleRefresh}>
            <Suspense fallback={<LoadingSkeleton />}>
              <PerformanceCard
                campaignId={selectedCampaigns[0]}
                period={DEFAULT_DATE_RANGE}
                refreshInterval={REFRESH_INTERVAL}
                className="mb-6"
              />
            </Suspense>
          </ErrorBoundary>
        </section>

        {/* Quick Actions Section */}
        <section aria-labelledby="actions-heading" className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <h2 id="actions-heading" className="sr-only">Quick Actions</h2>
          <button
            onClick={() => window.location.href = '/campaigns/new'}
            className="flex items-center justify-center p-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            aria-label="Create new campaign"
          >
            <span className="text-lg">+ New Campaign</span>
          </button>
          <button
            onClick={() => window.location.href = '/campaigns/import'}
            className="flex items-center justify-center p-4 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2"
            aria-label="Import campaign data"
          >
            <span className="text-lg">Import Data</span>
          </button>
          <button
            onClick={() => window.location.href = '/campaigns/budget'}
            className="flex items-center justify-center p-4 bg-tertiary-600 text-white rounded-lg hover:bg-tertiary-700 focus:outline-none focus:ring-2 focus:ring-tertiary-500 focus:ring-offset-2"
            aria-label="Review campaign budget"
          >
            <span className="text-lg">Budget Review</span>
          </button>
        </section>

        {/* Recent Campaigns Section */}
        <section aria-labelledby="campaigns-heading">
          <div className="flex justify-between items-center mb-4">
            <h2 id="campaigns-heading" className="text-2xl font-semibold text-gray-900 dark:text-white">
              Recent Campaigns
            </h2>
            <button
              onClick={handleRefresh}
              className="text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md"
              aria-label="Refresh campaign list"
              disabled={isPending}
            >
              Refresh
            </button>
          </div>
          <ErrorBoundary FallbackComponent={ErrorFallback} onReset={handleRefresh}>
            <Suspense fallback={<LoadingSkeleton />}>
              <CampaignList
                campaigns={[]}
                loading={isPending}
                selectedIds={selectedCampaigns}
                onSelect={handleCampaignSelect}
                onBulkSelect={setSelectedCampaigns}
                filterOptions={{
                  platforms: [],
                  statuses: [],
                  dateRange: DEFAULT_DATE_RANGE,
                  searchQuery: '',
                  budgetRange: { min: 0, max: Infinity }
                }}
                sortOptions={{
                  field: 'name',
                  direction: 'asc'
                }}
                viewMode="grid"
                className="mb-6"
              />
            </Suspense>
          </ErrorBoundary>
        </section>

        {/* AI Recommendations Section */}
        <section aria-labelledby="recommendations-heading">
          <h2 id="recommendations-heading" className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            AI-Powered Recommendations
          </h2>
          <ErrorBoundary FallbackComponent={ErrorFallback} onReset={handleRefresh}>
            <Suspense fallback={<LoadingSkeleton />}>
              <AiRecommendations
                campaignId={selectedCampaigns[0]}
                platformType="linkedin"
                onSelect={() => {}}
                timeoutDuration={REFRESH_INTERVAL}
              />
            </Suspense>
          </ErrorBoundary>
        </section>
      </main>
    </div>
  );
};

export default HomePage;