import React, { useState, useCallback } from 'react'; // ^18.0.0
import { toast } from 'react-toastify'; // ^9.0.0
import { useAuth } from '../../hooks/useAuth';
import Button from '../common/Button';

/**
 * Props interface for the LogoutButton component
 */
interface LogoutButtonProps {
  /**
   * Visual style variant of the logout button
   * @default "secondary"
   */
  variant?: 'primary' | 'secondary' | 'outline' | 'text';

  /**
   * Size variant of the logout button
   * @default "medium"
   */
  size?: 'small' | 'medium' | 'large';

  /**
   * Additional CSS classes for custom styling
   */
  className?: string;

  /**
   * Callback function called after successful logout
   */
  onLogoutSuccess?: () => void;

  /**
   * Callback function called when logout fails
   */
  onLogoutError?: (error: Error) => void;
}

/**
 * A secure and accessible logout button component that handles user logout
 * with comprehensive error handling and loading states.
 */
const LogoutButton: React.FC<LogoutButtonProps> = ({
  variant = 'secondary',
  size = 'medium',
  className,
  onLogoutSuccess,
  onLogoutError
}) => {
  // State for tracking loading state
  const [isLoading, setIsLoading] = useState(false);

  // Get logout function and authentication state from auth hook
  const { logout, isAuthenticated } = useAuth();

  /**
   * Handles the logout process with comprehensive error handling
   */
  const handleLogout = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    setIsLoading(true);

    try {
      await logout();

      // Show success notification
      toast.success('Successfully logged out', {
        position: 'top-right',
        autoClose: 3000,
        hideProgressBar: false,
      });

      // Call success callback if provided
      onLogoutSuccess?.();
    } catch (error) {
      // Create error object with proper type
      const logoutError = error instanceof Error 
        ? error 
        : new Error('Logout failed. Please try again.');

      // Show error notification
      toast.error(logoutError.message, {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
      });

      // Call error callback if provided
      onLogoutError?.(logoutError);

      console.error('Logout error:', logoutError);
    } finally {
      setIsLoading(false);
    }
  }, [logout, isAuthenticated, onLogoutSuccess, onLogoutError]);

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleLogout}
      isLoading={isLoading}
      isDisabled={!isAuthenticated || isLoading}
      ariaLabel="Logout from application"
      type="button"
    >
      {isLoading ? 'Logging out...' : 'Logout'}
    </Button>
  );
};

// Display name for debugging purposes
LogoutButton.displayName = 'LogoutButton';

export default LogoutButton;