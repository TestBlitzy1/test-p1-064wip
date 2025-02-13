'use client';

import React from 'react'; // v18.x
import LoadingSpinner from '../../components/common/LoadingSpinner';

/**
 * Loading component displayed during campaigns page data fetching and transitions.
 * Provides visual feedback with a centered spinner and proper accessibility attributes.
 * 
 * @returns {JSX.Element} A centered loading spinner with accessibility support
 */
const Loading: React.FC = React.memo(() => {
  return (
    <div
      className="flex items-center justify-center min-h-[100vh] w-full bg-transparent"
      role="status"
      aria-live="polite"
      aria-label="Loading campaigns"
    >
      <LoadingSpinner 
        size="large"
        color="primary"
        className="animate-pulse"
      />
    </div>
  );
});

// Display name for debugging purposes
Loading.displayName = 'CampaignsLoading';

export default Loading;