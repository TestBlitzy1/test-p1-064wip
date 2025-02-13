import React from 'react'; // v18.x
import clsx from 'clsx'; // v2.0.0
import { ComponentProps } from '../../types/common';

interface LoadingSpinnerProps extends ComponentProps {
  /**
   * Controls the size variant of the spinner
   * @default "medium"
   */
  size?: 'small' | 'medium' | 'large';

  /**
   * Controls the color variant of the spinner
   * @default "primary"
   */
  color?: 'primary' | 'white';
}

/**
 * A customizable loading spinner component that provides visual feedback during loading states.
 * Implements accessible, size-customizable, and color-variant loading indicators.
 * 
 * @example
 * // Default medium primary spinner
 * <LoadingSpinner />
 * 
 * // Large white spinner
 * <LoadingSpinner size="large" color="white" />
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = React.memo(({
  size = 'medium',
  color = 'primary',
  className
}) => {
  // Size class mappings
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-6 h-6',
    large: 'w-8 h-8'
  };

  // Color class mappings
  const colorClasses = {
    primary: 'text-primary-500',
    white: 'text-white'
  };

  // Combine classes using clsx
  const spinnerClasses = clsx(
    'inline-block animate-spin',
    sizeClasses[size],
    colorClasses[color],
    className
  );

  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center justify-center"
    >
      <svg
        className={spinnerClasses}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-label="Loading"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="sr-only">Loading...</span>
    </div>
  );
});

// Display name for debugging purposes
LoadingSpinner.displayName = 'LoadingSpinner';

export default LoadingSpinner;