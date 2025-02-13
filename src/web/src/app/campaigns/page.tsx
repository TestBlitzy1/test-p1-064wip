'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import CampaignList from '../../components/campaigns/CampaignList';
import AiRecommendations from '../../components/campaigns/AiRecommendations';
import { useCampaign } from '../../hooks/useCampaign';
import { Campaign, CampaignStatus, PlatformType } from '../../types/campaigns';
import { LoadingState } from '../../types/common';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';

// Constants for performance monitoring
const REFRESH_INTERVAL = 30000; // 30 seconds
const GENERATION_TIMEOUT = 30000; // 30-second SLA requirement

interface FilterOptions {
  platforms: PlatformType[];
  statuses: CampaignStatus[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
  searchQuery: string;
  budgetRange: {
    min: number;
    max: number;
  };
}

interface SortOptions {
  field: 'name' | 'status' | 'budget' | 'metrics.ctr' | 'metrics.conversions';
  direction: 'asc' | 'desc';
}

/**
 * Main campaign management page component with enhanced performance optimizations
 * and accessibility features.
 */
const CampaignsPage: React.FC = () => {
  const router = useRouter();
  const {
    fetchCampaigns,
    generateCampaignStructure,
    loading,
    error,
    generationProgress
  } = useCampaign();

  // State management
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    platforms: [],
    statuses: [],
    dateRange: {
      startDate: '',
      endDate: ''
    },
    searchQuery: '',
    budgetRange: {
      min: 0,
      max: Infinity
    }
  });
  const [sortOptions, setSortOptions] = useState<SortOptions>({
    field: 'name',
    direction: 'asc'
  });

  // Performance metrics state
  const [performanceMetrics, setPerformanceMetrics] = useState({
    loadTime: 0,
    renderTime: 0
  });

  // Fetch campaigns with performance monitoring
  const loadCampaigns = useCallback(async () => {
    const startTime = performance.now();
    try {
      const response = await fetchCampaigns();
      setCampaigns(response.data);
      setPerformanceMetrics(prev => ({
        ...prev,
        loadTime: performance.now() - startTime
      }));
    } catch (error) {
      console.error('Error loading campaigns:', error);
    }
  }, [fetchCampaigns]);

  // Auto-refresh campaigns
  useEffect(() => {
    loadCampaigns();
    const interval = setInterval(loadCampaigns, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadCampaigns]);

  // Performance monitoring for renders
  useEffect(() => {
    const startTime = performance.now();
    return () => {
      setPerformanceMetrics(prev => ({
        ...prev,
        renderTime: performance.now() - startTime
      }));
    };
  }, [campaigns]);

  // Handle campaign selection
  const handleCampaignSelect = useCallback((id: string) => {
    setSelectedCampaigns(prev => 
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  }, []);

  // Handle bulk selection
  const handleBulkSelect = useCallback((ids: string[]) => {
    setSelectedCampaigns(ids);
  }, []);

  // Handle AI recommendations selection
  const handleRecommendationsSelect = useCallback(async (recommendations) => {
    if (!selectedCampaigns.length) return;

    try {
      await generateCampaignStructure({
        platformType: 'BOTH',
        targetingSettings: recommendations[0].targetingSettings,
        budget: recommendations[0].budget
      });
      loadCampaigns();
    } catch (error) {
      console.error('Error applying recommendations:', error);
    }
  }, [selectedCampaigns, generateCampaignStructure, loadCampaigns]);

  // Memoized campaign statistics
  const campaignStats = useMemo(() => ({
    total: campaigns.length,
    active: campaigns.filter(c => c.status === 'ACTIVE').length,
    totalBudget: campaigns.reduce((sum, c) => sum + c.totalBudget, 0)
  }), [campaigns]);

  return (
    <main 
      className="container mx-auto px-4 py-8"
      role="main"
      aria-label="Campaign Management Dashboard"
    >
      {/* Performance monitoring banner */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4 p-2 bg-gray-100 text-xs">
          Load Time: {performanceMetrics.loadTime.toFixed(2)}ms | 
          Render Time: {performanceMetrics.renderTime.toFixed(2)}ms
        </div>
      )}

      {/* Header section */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-gray-600">
            {campaignStats.active} active of {campaignStats.total} total campaigns
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => router.push('/campaigns/new')}
          ariaLabel="Create new campaign"
        >
          Create Campaign
        </Button>
      </div>

      {/* Campaign overview card */}
      <Card className="mb-8 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Active Campaigns</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {campaignStats.active}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Total Budget</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              ${campaignStats.totalBudget.toLocaleString()}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Processing Time</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {performanceMetrics.loadTime < GENERATION_TIMEOUT ? '✓' : '⚠'} 
              {performanceMetrics.loadTime.toFixed(0)}ms
            </p>
          </div>
        </div>
      </Card>

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <CampaignList
            campaigns={campaigns}
            loading={loading.status === 'loading'}
            selectedIds={selectedCampaigns}
            onSelect={handleCampaignSelect}
            onBulkSelect={handleBulkSelect}
            filterOptions={filterOptions}
            sortOptions={sortOptions}
            viewMode={viewMode}
            className="h-[calc(100vh-300px)]"
          />
        </div>

        <div>
          <AiRecommendations
            campaignId={selectedCampaigns[0]}
            platformType="linkedin"
            onSelect={handleRecommendationsSelect}
            timeoutDuration={GENERATION_TIMEOUT}
          />
        </div>
      </div>

      {/* Error handling */}
      {error && (
        <div 
          role="alert"
          className="fixed bottom-4 right-4 bg-red-50 text-red-800 p-4 rounded-lg shadow-lg"
        >
          <h3 className="font-semibold">Error</h3>
          <p>{error.message}</p>
        </div>
      )}
    </main>
  );
};

export default CampaignsPage;