import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { colors, typography } from '../../config/theme.config';

// Alert severity types
type AlertSeverity = 'info' | 'success' | 'warning' | 'error';

// Props interface with comprehensive options
interface AlertProps {
  /** The content of the alert */
  children: React.ReactNode;
  /** Defines the severity and color scheme of the alert */
  severity?: AlertSeverity;
  /** Additional CSS classes to apply */
  className?: string;
  /** Whether the alert can be dismissed */
  dismissible?: boolean;
  /** Callback fired when alert is dismissed */
  onDismiss?: () => void;
  /** Optional title for the alert */
  title?: string;
  /** Optional icon to display */
  icon?: React.ReactNode;
  /** Duration in milliseconds to auto-hide the alert (0 means no auto-hide) */
  autoHideDuration?: number;
  /** Accessible label for screen readers */
  ariaLabel?: string;
  /** ID of the element that describes the alert */
  ariaDescribedby?: string;
}

// Severity-based style configurations
const severityStyles: Record<AlertSeverity, {
  background: string;
  border: string;
  text: string;
  icon: string;
}> = {
  info: {
    background: colors.info.light,
    border: colors.info.main,
    text: colors.info.contrastText,
    icon: 'ⓘ',
  },
  success: {
    background: colors.success.light,
    border: colors.success.main,
    text: colors.success.contrastText,
    icon: '✓',
  },
  warning: {
    background: colors.warning.light,
    border: colors.warning.main,
    text: colors.warning.contrastText,
    icon: '⚠',
  },
  error: {
    background: colors.error.light,
    border: colors.error.main,
    text: colors.error.contrastText,
    icon: '✕',
  },
};

const Alert: React.FC<AlertProps> = ({
  children,
  severity = 'info',
  className,
  dismissible = false,
  onDismiss,
  title,
  icon,
  autoHideDuration = 0,
  ariaLabel,
  ariaDescribedby,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const timerRef = useRef<number>();
  const alertRef = useRef<HTMLDivElement>(null);

  // Handle auto-hide functionality
  useEffect(() => {
    if (autoHideDuration > 0) {
      timerRef.current = window.setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, autoHideDuration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [autoHideDuration, onDismiss]);

  // Handle keyboard interactions
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (dismissible && (event.key === 'Escape' || event.key === 'Delete')) {
      setIsVisible(false);
      onDismiss?.();
    }
  };

  // Handle dismiss click
  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) {
    return null;
  }

  const styles = severityStyles[severity];

  return (
    <div
      ref={alertRef}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedby}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={clsx(
        'alert',
        `alert-${severity}`,
        className,
        'relative flex items-center p-4 mb-4 rounded-md transition-all duration-200',
        'border-l-4'
      )}
      style={{
        backgroundColor: styles.background,
        borderLeftColor: styles.border,
        color: styles.text,
        fontFamily: typography.fontFamily.primary,
        fontSize: typography.fontSize.base,
        lineHeight: typography.lineHeight.normal,
      }}
    >
      {/* Icon section */}
      <div className="flex-shrink-0 mr-3">
        {icon || <span role="img" aria-hidden="true">{styles.icon}</span>}
      </div>

      {/* Content section */}
      <div className="flex-grow">
        {title && (
          <div
            className="font-semibold mb-1"
            style={{
              fontSize: typography.fontSize.lg,
              fontWeight: typography.fontWeight.semibold,
            }}
          >
            {title}
          </div>
        )}
        <div>{children}</div>
      </div>

      {/* Dismiss button */}
      {dismissible && (
        <button
          type="button"
          aria-label="Dismiss alert"
          onClick={handleDismiss}
          className={clsx(
            'absolute top-4 right-4',
            'p-1 rounded-full transition-opacity duration-200',
            'hover:opacity-80 focus:opacity-80 focus:outline-none focus:ring-2',
            'focus:ring-offset-2'
          )}
          style={{
            backgroundColor: 'transparent',
            color: styles.text,
          }}
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
};

export default Alert;