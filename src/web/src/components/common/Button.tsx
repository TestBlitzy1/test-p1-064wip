import React from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.0
import LoadingSpinner from './LoadingSpinner';
import { ComponentProps } from '../../types/common';

interface ButtonProps extends ComponentProps {
  /**
   * Visual style variant of the button
   * @default "primary"
   */
  variant?: 'primary' | 'secondary' | 'outline' | 'text';

  /**
   * Size variant affecting dimensions and spacing
   * @default "medium"
   */
  size?: 'small' | 'medium' | 'large';

  /**
   * Loading state showing spinner and disabling interaction
   * @default false
   */
  isLoading?: boolean;

  /**
   * Disabled state preventing interaction
   * @default false
   */
  isDisabled?: boolean;

  /**
   * HTML button type attribute
   * @default "button"
   */
  type?: 'button' | 'submit' | 'reset';

  /**
   * Click event handler
   */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;

  /**
   * Accessibility label for screen readers
   */
  ariaLabel?: string;
}

/**
 * Generates combined class names for button styling based on props
 */
const getButtonClasses = ({
  variant = 'primary',
  size = 'medium',
  isDisabled,
  isLoading,
  className
}: ButtonProps): string => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

  const variantClasses = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 focus-visible:ring-primary-500',
    secondary: 'bg-secondary-600 text-white hover:bg-secondary-700 active:bg-secondary-800 focus-visible:ring-secondary-500',
    outline: 'border-2 border-primary-600 text-primary-600 hover:bg-primary-50 active:bg-primary-100 focus-visible:ring-primary-500',
    text: 'text-primary-600 hover:bg-primary-50 active:bg-primary-100 focus-visible:ring-primary-500'
  };

  const sizeClasses = {
    small: 'px-3 py-1.5 text-sm',
    medium: 'px-4 py-2 text-base',
    large: 'px-6 py-3 text-lg'
  };

  const stateClasses = {
    disabled: 'opacity-50 cursor-not-allowed',
    loading: 'cursor-wait'
  };

  return classNames(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    {
      [stateClasses.disabled]: isDisabled,
      [stateClasses.loading]: isLoading
    },
    className
  );
};

/**
 * A reusable button component that provides consistent styling and behavior
 * across the application. Supports various variants, sizes, loading states,
 * and meets WCAG AA accessibility requirements.
 */
const Button: React.FC<ButtonProps> = React.memo(({
  variant = 'primary',
  size = 'medium',
  isLoading = false,
  isDisabled = false,
  type = 'button',
  onClick,
  ariaLabel,
  children,
  className,
  ...rest
}) => {
  // Determine loading spinner color based on variant
  const spinnerColor = variant === 'primary' || variant === 'secondary' ? 'white' : 'primary';

  // Map button size to spinner size
  const spinnerSize = size === 'large' ? 'medium' : 'small';

  return (
    <button
      type={type}
      disabled={isDisabled || isLoading}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-disabled={isDisabled || isLoading}
      aria-busy={isLoading}
      className={getButtonClasses({
        variant,
        size,
        isDisabled,
        isLoading,
        className
      })}
      {...rest}
    >
      {isLoading ? (
        <>
          <LoadingSpinner
            size={spinnerSize}
            color={spinnerColor}
            className="mr-2"
          />
          <span className="opacity-90">{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
});

// Display name for debugging purposes
Button.displayName = 'Button';

export default Button;