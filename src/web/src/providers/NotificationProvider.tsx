import React, { createContext, useCallback, useState, useEffect, useRef } from 'react';
import { useTheme } from '@mui/material';
import { Toast } from '../components/common/Toast';
import type { NotificationSeverity } from '../types/common';

// Default durations in milliseconds
const DEFAULT_DURATION = 3000;
const QUEUE_PROCESS_DELAY = 300;

// Type for notification severity/type
type NotificationType = NotificationSeverity;

// Interface for queued notification items
interface NotificationItem {
  message: string;
  type: NotificationType;
  duration: number;
}

// Interface for notification state
interface NotificationState {
  show: boolean;
  message: string;
  type: NotificationType;
  duration: number;
  queue: NotificationItem[];
}

// Interface for the notification context
interface NotificationContextType {
  show: (message: string, type: NotificationType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  clear: () => void;
}

// Props interface for the provider component
interface NotificationProviderProps {
  children: React.ReactNode;
}

// Create the context with a default value
export const NotificationContext = createContext<NotificationContextType>({
  show: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {},
  clear: () => {},
});

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  // Initialize state with queue support
  const [state, setState] = useState<NotificationState>({
    show: false,
    message: '',
    type: 'info',
    duration: DEFAULT_DURATION,
    queue: [],
  });

  // Refs for managing timeouts and processing state
  const timeoutRef = useRef<NodeJS.Timeout>();
  const processingQueueRef = useRef(false);
  
  // Get theme for proper styling integration
  const theme = useTheme();

  // Clear any existing timeout
  const clearTimeout = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, []);

  // Process the next notification in queue
  const processQueue = useCallback(() => {
    setState(prevState => {
      if (prevState.queue.length === 0) {
        processingQueueRef.current = false;
        return prevState;
      }

      const [nextNotification, ...remainingQueue] = prevState.queue;
      return {
        show: true,
        message: nextNotification.message,
        type: nextNotification.type,
        duration: nextNotification.duration,
        queue: remainingQueue,
      };
    });
  }, []);

  // Handle notification close
  const handleClose = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      show: false,
    }));

    // Process next notification after animation
    timeoutRef.current = setTimeout(() => {
      if (state.queue.length > 0) {
        processQueue();
      }
    }, QUEUE_PROCESS_DELAY);
  }, [processQueue, state.queue.length]);

  // Show notification with queue support
  const show = useCallback((
    message: string,
    type: NotificationType = 'info',
    duration: number = DEFAULT_DURATION
  ) => {
    clearTimeout();

    const newNotification = { message, type, duration };

    setState(prevState => {
      if (prevState.show) {
        // Add to queue if notification is currently showing
        return {
          ...prevState,
          queue: [...prevState.queue, newNotification],
        };
      }

      // Show immediately if no notification is active
      return {
        show: true,
        message,
        type,
        duration,
        queue: prevState.queue,
      };
    });
  }, [clearTimeout]);

  // Convenience methods for different notification types
  const success = useCallback((message: string, duration?: number) => {
    show(message, 'success', duration);
  }, [show]);

  const error = useCallback((message: string, duration?: number) => {
    show(message, 'error', duration);
  }, [show]);

  const warning = useCallback((message: string, duration?: number) => {
    show(message, 'warning', duration);
  }, [show]);

  const info = useCallback((message: string, duration?: number) => {
    show(message, 'info', duration);
  }, [show]);

  // Clear all notifications
  const clear = useCallback(() => {
    clearTimeout();
    setState({
      show: false,
      message: '',
      type: 'info',
      duration: DEFAULT_DURATION,
      queue: [],
    });
  }, [clearTimeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout();
    };
  }, [clearTimeout]);

  // Context value with memoized methods
  const contextValue = React.useMemo(
    () => ({
      show,
      success,
      error,
      warning,
      info,
      clear,
    }),
    [show, success, error, warning, info, clear]
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <Toast
        show={state.show}
        message={state.message}
        type={state.type}
        duration={state.duration}
        onClose={handleClose}
        role={state.type === 'error' ? 'alert' : 'status'}
        ariaLive={state.type === 'error' ? 'assertive' : 'polite'}
      />
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;