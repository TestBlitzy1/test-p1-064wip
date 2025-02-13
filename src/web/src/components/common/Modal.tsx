import React, { useEffect, useRef, useCallback } from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.0
import FocusTrap from 'focus-trap-react'; // ^9.0.0
import Button from './Button';
import { ComponentProps } from '../../types/common';

interface ModalProps extends ComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'small' | 'medium' | 'large';
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  initialFocusRef?: React.RefObject<HTMLElement>;
}

const sizeClasses = {
  small: 'max-w-sm',
  medium: 'max-w-lg',
  large: 'max-w-2xl'
};

/**
 * A reusable modal component that provides a consistent overlay dialog interface
 * with accessibility features, responsive behavior, and proper focus management.
 */
const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  size = 'medium',
  closeOnOverlayClick = true,
  showCloseButton = true,
  ariaLabel,
  ariaDescribedBy,
  initialFocusRef,
  children,
  className
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Store the previously focused element when modal opens
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      return () => {
        // Restore focus when modal closes
        previousActiveElement.current?.focus();
      };
    }
  }, [isOpen]);

  // Handle overlay click
  const handleOverlayClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      onClose();
    }
  }, [closeOnOverlayClick, onClose]);

  // Handle escape key press
  const handleEscapeKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }, [onClose]);

  // Add/remove event listeners
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, handleEscapeKey]);

  if (!isOpen) return null;

  return (
    <FocusTrap
      active={isOpen}
      initialFocus={initialFocusRef}
      focusTrapOptions={{
        allowOutsideClick: true,
        fallbackFocus: '[data-modal-autofocus]'
      }}
    >
      <div
        className="fixed inset-0 z-50 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || title}
        aria-describedby={ariaDescribedBy}
      >
        {/* Overlay */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          aria-hidden="true"
          onClick={handleOverlayClick}
        />

        {/* Modal Content */}
        <div className="flex min-h-screen items-center justify-center p-4">
          <div
            ref={modalRef}
            className={classNames(
              'relative w-full rounded-lg bg-white shadow-xl',
              'transform transition-all',
              sizeClasses[size],
              className
            )}
            data-modal-autofocus
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                {title && (
                  <h2 className="text-lg font-semibold text-gray-900" id="modal-title">
                    {title}
                  </h2>
                )}
                {showCloseButton && (
                  <Button
                    variant="text"
                    size="small"
                    onClick={onClose}
                    ariaLabel="Close modal"
                    className="ml-auto -mr-2"
                  >
                    <span className="sr-only">Close</span>
                    <svg
                      className="h-5 w-5 text-gray-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </Button>
                )}
              </div>
            )}

            {/* Body */}
            <div className="px-6 py-4">
              {children}
            </div>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
};

// Display name for debugging purposes
Modal.displayName = 'Modal';

export default Modal;