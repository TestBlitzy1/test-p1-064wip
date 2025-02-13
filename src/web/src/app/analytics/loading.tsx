'use client';

import React from 'react';
import LoadingSpinner from '../../components/common/LoadingSpinner';

/**
 * Loading component for the analytics page that displays skeleton placeholders
 * while data is being fetched. Implements optimized animations and accessibility
 * features for an enhanced user experience.
 */
const AnalyticsLoading: React.FC = () => {
  // Performance optimization: Use transform instead of margin/padding for animations
  const pulseAnimation = 'animate-pulse will-change-transform contain-strict';
  
  return (
    <div 
      className="w-full max-w-7xl mx-auto p-4 space-y-6"
      role="status"
      aria-label="Loading analytics data"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Centered loading spinner */}
      <div className="flex justify-center items-center mb-8">
        <LoadingSpinner size="large" color="primary" />
      </div>

      {/* Performance metrics skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CTR Metric Skeleton */}
        <div 
          className={`h-32 bg-gray-100 rounded-lg ${pulseAnimation}`}
          aria-hidden="true"
        />
        
        {/* Conversions Metric Skeleton */}
        <div 
          className={`h-32 bg-gray-100 rounded-lg ${pulseAnimation}`}
          aria-hidden="true"
        />
        
        {/* CPC Metric Skeleton */}
        <div 
          className={`h-32 bg-gray-100 rounded-lg ${pulseAnimation}`}
          aria-hidden="true"
        />
        
        {/* ROAS Metric Skeleton */}
        <div 
          className={`h-32 bg-gray-100 rounded-lg ${pulseAnimation}`}
          aria-hidden="true"
        />
      </div>

      {/* Chart skeletons */}
      <div className="space-y-6">
        {/* Conversion Trend Chart Skeleton */}
        <div 
          className={`h-96 bg-gray-100 rounded-lg ${pulseAnimation}`}
          aria-hidden="true"
        />
        
        {/* ROAS Analysis Chart Skeleton */}
        <div 
          className={`h-96 bg-gray-100 rounded-lg ${pulseAnimation}`}
          aria-hidden="true"
        />
      </div>

      {/* Hidden loading announcement for screen readers */}
      <div className="sr-only" aria-live="polite">
        Loading analytics dashboard data, please wait...
      </div>
    </div>
  );
};

export default AnalyticsLoading;