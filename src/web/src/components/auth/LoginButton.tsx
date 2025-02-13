import React, { useCallback } from 'react';
import debounce from 'lodash/debounce'; // v4.0.8
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../common/Button';
import { useAnalytics } from '../../hooks/useAnalytics';

/**
 * Props interface for the LoginButton component
 */
interface LoginButtonProps {
  /**
   * Visual style variant of the button
   * @default "primary"
   */
  variant?: 'primary' | 'secondary' | 'outline' | 'text';

  /**
   * Additional CSS classes for styling
   */
  className?: string;

  /**
   * Maximum number of retry attempts for failed logins
   * @default 3
   */
  retryAttempts?: number;

  /**
   * Optional error callback for custom error handling
   */
  onError?: (error: Error) => void;
}

/**
 * A secure and accessible login button component that implements OAuth 2.0 authentication
 * with comprehensive error handling and analytics tracking.
 */
const LoginButton: React.FC<LoginButtonProps> = ({
  variant = 'primary',
  className,
  retryAttempts = 3,
  onError
}) => {
  const { login, loading, error } = useAuth();
  const { trackEvent } = useAnalytics();

  /**
   * Handles the login process with security measures and analytics tracking
   */
  const handleLogin = useCallback(
    debounce(
      async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();

        // Track login attempt start time
        const startTime = performance.now();

        try {
          // Track login attempt
          trackEvent({
            category: 'Authentication',
            action: 'Login Attempt',
            timestamp: Date.now()
          });

          // Attempt login with retry mechanism
          let attempts = 0;
          let lastError: Error | null = null;

          while (attempts < retryAttempts) {
            try {
              await login({
                email: '', // Handled by OAuth provider
                password: '', // Handled by OAuth provider
                rememberMe: true
              });

              // Track successful login
              trackEvent({
                category: 'Authentication',
                action: 'Login Success',
                value: performance.now() - startTime,
                timestamp: Date.now()
              });

              return;
            } catch (err) {
              lastError = err as Error;
              attempts++;

              // Track failed attempt
              trackEvent({
                category: 'Authentication',
                action: 'Login Failure',
                label: lastError.message,
                timestamp: Date.now()
              });

              // Wait before retry
              if (attempts < retryAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
              }
            }
          }

          // If all retries failed, throw the last error
          if (lastError) {
            throw lastError;
          }
        } catch (err) {
          const error = err as Error;
          
          // Track final failure
          trackEvent({
            category: 'Authentication',
            action: 'Login Final Failure',
            label: error.message,
            timestamp: Date.now()
          });

          // Handle error through callback if provided
          if (onError) {
            onError(error);
          }
        }
      },
      300,
      { leading: true, trailing: false }
    ),
    [login, trackEvent, retryAttempts, onError]
  );

  return (
    <Button
      variant={variant}
      className={className}
      onClick={handleLogin}
      isLoading={loading}
      isDisabled={loading}
      ariaLabel="Sign in with OAuth"
      type="button"
    >
      {loading ? 'Signing in...' : 'Sign in'}
    </Button>
  );
};

// Display name for debugging
LoginButton.displayName = 'LoginButton';

export default LoginButton;