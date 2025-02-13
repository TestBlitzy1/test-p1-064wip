import { useContext } from 'react'; // v18.2.0
import { NotificationContext } from '../providers/NotificationProvider';
import type { NotificationSeverity } from '../types/common';

/**
 * Custom hook that provides a simplified interface for displaying notifications.
 * Must be used within a NotificationProvider component.
 * 
 * @returns An object containing notification methods with proper type definitions
 * @throws Error if used outside of NotificationProvider
 * 
 * @example
 * const { success, error } = useNotification();
 * success('Operation completed successfully');
 */
export const useNotification = () => {
  const context = useContext(NotificationContext);

  // Validate context exists
  if (!context) {
    throw new Error(
      'useNotification must be used within a NotificationProvider'
    );
  }

  // Type alias for notification type
  type NotificationType = NotificationSeverity;

  // Interface for the hook's return type
  interface NotificationMethods {
    /**
     * Shows a notification with custom type
     * @param message - The notification message
     * @param type - The notification type
     * @param duration - Optional duration in milliseconds
     */
    show: (message: string, type: NotificationType, duration?: number) => void;

    /**
     * Shows a success notification
     * @param message - The success message
     * @param duration - Optional duration in milliseconds
     */
    success: (message: string, duration?: number) => void;

    /**
     * Shows an error notification
     * @param message - The error message
     * @param duration - Optional duration in milliseconds
     */
    error: (message: string, duration?: number) => void;

    /**
     * Shows a warning notification
     * @param message - The warning message
     * @param duration - Optional duration in milliseconds
     */
    warning: (message: string, duration?: number) => void;

    /**
     * Shows an info notification
     * @param message - The info message
     * @param duration - Optional duration in milliseconds
     */
    info: (message: string, duration?: number) => void;
  }

  // Return type-safe notification methods
  const notificationMethods: NotificationMethods = {
    show: (message: string, type: NotificationType, duration?: number) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[Notification]', { message, type, duration });
      }
      context.show(message, type, duration);
    },

    success: (message: string, duration?: number) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[Notification:Success]', { message, duration });
      }
      context.success(message, duration);
    },

    error: (message: string, duration?: number) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[Notification:Error]', { message, duration });
      }
      context.error(message, duration);
    },

    warning: (message: string, duration?: number) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[Notification:Warning]', { message, duration });
      }
      context.warning(message, duration);
    },

    info: (message: string, duration?: number) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[Notification:Info]', { message, duration });
      }
      context.info(message, duration);
    },
  };

  return notificationMethods;
};

export default useNotification;