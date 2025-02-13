import React, { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx'; // v2.x
import { ComponentProps } from 'types/common';
import { themeConfig } from 'config/theme.config';

// Position type for tooltip placement
type Position = 'top' | 'bottom' | 'left' | 'right';

// Props interface extending ComponentProps
export interface TooltipProps extends ComponentProps {
  content: React.ReactNode;
  position?: Position;
  delay?: number;
  disabled?: boolean;
  offset?: number;
  interactive?: boolean;
}

// Custom hook for tooltip functionality
const useTooltip = (delay = 200, disabled = false) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; placement: Position }>({
    top: 0,
    left: 0,
    placement: 'top'
  });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY
    };

    const newPosition = getTooltipPosition(triggerRect, tooltipRect, viewport);
    setPosition(newPosition);
  }, []);

  const showTooltip = useCallback(() => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      calculatePosition();
    }, delay);
  }, [calculatePosition, delay, disabled]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (isVisible) {
        calculatePosition();
      }
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', calculatePosition);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', calculatePosition);
    };
  }, [calculatePosition, isVisible]);

  return {
    isVisible,
    position,
    triggerRef,
    tooltipRef,
    showTooltip,
    hideTooltip
  };
};

// Helper function to calculate tooltip position
const getTooltipPosition = (
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  viewport: { width: number; height: number; scrollX: number; scrollY: number }
) => {
  const gap = 8; // Gap between trigger and tooltip
  let top = 0;
  let left = 0;
  let placement: Position = 'top';

  // Calculate positions for different placements
  const positions = {
    top: {
      top: triggerRect.top - tooltipRect.height - gap,
      left: triggerRect.left + (triggerRect.width - tooltipRect.width) / 2,
      placement: 'top' as Position
    },
    bottom: {
      top: triggerRect.bottom + gap,
      left: triggerRect.left + (triggerRect.width - tooltipRect.width) / 2,
      placement: 'bottom' as Position
    },
    left: {
      top: triggerRect.top + (triggerRect.height - tooltipRect.height) / 2,
      left: triggerRect.left - tooltipRect.width - gap,
      placement: 'left' as Position
    },
    right: {
      top: triggerRect.top + (triggerRect.height - tooltipRect.height) / 2,
      left: triggerRect.right + gap,
      placement: 'right' as Position
    }
  };

  // Find best placement based on viewport constraints
  const preferredPlacements: Position[] = ['top', 'bottom', 'right', 'left'];
  for (const pos of preferredPlacements) {
    const { top: posTop, left: posLeft } = positions[pos];
    if (
      posTop >= 0 &&
      posLeft >= 0 &&
      posTop + tooltipRect.height <= viewport.height &&
      posLeft + tooltipRect.width <= viewport.width
    ) {
      ({ top, left, placement } = positions[pos]);
      break;
    }
  }

  // Adjust for scroll position
  top += viewport.scrollY;
  left += viewport.scrollX;

  return { top, left, placement };
};

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'top',
  delay = 200,
  disabled = false,
  offset = 8,
  interactive = false,
  className
}) => {
  const {
    isVisible,
    position: tooltipPosition,
    triggerRef,
    tooltipRef,
    showTooltip,
    hideTooltip
  } = useTooltip(delay, disabled);

  const tooltipClasses = clsx(
    'fixed py-1 px-2 text-sm rounded pointer-events-none transition-opacity duration-200',
    'bg-gray-800 text-white shadow-md',
    'dark:bg-gray-700',
    {
      'opacity-0 invisible': !isVisible,
      'opacity-100 visible': isVisible,
      'pointer-events-auto': interactive
    },
    className
  );

  const tooltipStyles: React.CSSProperties = {
    top: tooltipPosition.top,
    left: tooltipPosition.left,
    zIndex: themeConfig.zIndex.tooltip,
    maxWidth: '20rem',
    fontSize: themeConfig.typography.fontSize.sm,
    ...themeConfig.components.tooltip
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        aria-describedby={isVisible ? 'tooltip' : undefined}
        className="inline-block"
      >
        {children}
      </div>
      {isVisible && (
        <div
          id="tooltip"
          ref={tooltipRef}
          role="tooltip"
          className={tooltipClasses}
          style={tooltipStyles}
          onMouseEnter={interactive ? showTooltip : undefined}
          onMouseLeave={interactive ? hideTooltip : undefined}
        >
          {content}
          <div className="tooltip-arrow" />
        </div>
      )}
    </>
  );
};

export default Tooltip;