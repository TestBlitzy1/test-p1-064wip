import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // v10.x
import { ComponentProps } from '../../types/common';
import { themeConfig } from '../../config/theme.config';

// Animation variants for smooth transitions
const ANIMATION_VARIANTS = {
  initial: {
    opacity: 0,
    y: -20,
    scale: 0.95
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.2,
      ease: 'easeOut'
    }
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.95,
    transition: {
      duration: 0.15,
      ease: 'easeIn'
    }
  }
};

// Default duration for toast messages
const DEFAULT_DURATION = 3000;

// Fixed positioning for toast container
const TOAST_POSITIONS = {
  top: '20px',
  right: '20px',
  zIndex: 9999
};

// Props interface with accessibility and customization options
interface ToastProps extends ComponentProps {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose: () => void;
  role?: 'alert' | 'status';
  ariaLive?: 'polite' | 'assertive';
}

// Function to generate theme-compliant styles based on toast type
const getToastStyles = (type: ToastProps['type']) => {
  const { colors } = themeConfig;
  const baseStyles = {
    padding: '12px 24px',
    borderRadius: '6px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    alignItems: 'center',
    minWidth: '300px',
    maxWidth: '500px',
    border: '1px solid'
  };

  const typeStyles = {
    success: {
      backgroundColor: `${colors.success.main}15`,
      color: colors.success.main,
      borderColor: colors.success.main
    },
    error: {
      backgroundColor: `${colors.error.main}15`,
      color: colors.error.main,
      borderColor: colors.error.main
    },
    warning: {
      backgroundColor: `${colors.warning.main}15`,
      color: colors.warning.main,
      borderColor: colors.warning.main
    },
    info: {
      backgroundColor: `${colors.info.main}15`,
      color: colors.info.main,
      borderColor: colors.info.main
    }
  };

  return {
    ...baseStyles,
    ...typeStyles[type]
  };
};

export const Toast: React.FC<ToastProps> = ({
  show,
  message,
  type = 'info',
  duration = DEFAULT_DURATION,
  onClose,
  role = 'status',
  ariaLive = 'polite',
  className
}) => {
  // Handle auto-close after duration
  useEffect(() => {
    if (show && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        ...TOAST_POSITIONS,
        pointerEvents: 'none'
      }}
    >
      <AnimatePresence>
        {show && (
          <motion.div
            role={role}
            aria-live={ariaLive}
            style={{
              ...getToastStyles(type),
              pointerEvents: 'auto'
            }}
            className={className}
            variants={ANIMATION_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <span
              style={{
                fontFamily: themeConfig.typography.fontFamily.primary,
                fontSize: themeConfig.typography.fontSize.base,
                fontWeight: themeConfig.typography.fontWeight.medium,
                lineHeight: themeConfig.typography.lineHeight.normal
              }}
            >
              {message}
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                marginLeft: '12px',
                cursor: 'pointer',
                color: 'inherit',
                opacity: 0.7
              }}
              aria-label="Close notification"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Toast;