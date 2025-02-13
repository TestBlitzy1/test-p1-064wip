'use client';

import React from 'react'; // v18.x
import LoadingSpinner from '../components/common/LoadingSpinner';

/**
 * Global loading component for Next.js page transitions and data fetching operations.
 * Provides a consistent loading state UI with enhanced accessibility features.
 * 
 * Features:
 * - Full viewport coverage with semi-transparent overlay
 * - Centered large loading spinner
 * - Enhanced accessibility with ARIA attributes
 * - Smooth transitions with CSS animations
 */
const Loading: React.FC = () => {
  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center bg-gray-50/80 transition-opacity duration-300"
      role="progressbar"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading page content, please wait"
    >
      <div className="flex flex-col items-center space-y-4">
        <LoadingSpinner 
          size="large"
          color="primary"
          className="animate-pulse"
        />
        {/* Visually hidden text for screen readers */}
        <span className="sr-only">
          Loading page content, please wait...
        </span>
      </div>
    </div>
  );
};

// Display name for debugging purposes
Loading.displayName = 'Loading';

export default Loading;