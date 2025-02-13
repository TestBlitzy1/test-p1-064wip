import React from 'react'; // v18.x
import clsx from 'clsx'; // v2.x
import { ComponentProps } from '../types/common';
import { themeConfig } from '../config/theme.config';

export interface CardProps extends ComponentProps {
  /**
   * Visual style variant of the card
   * @default 'default'
   */
  variant?: 'default' | 'outlined' | 'elevated';
  
  /**
   * Whether the card is interactive (clickable)
   * @default false
   */
  interactive?: boolean;
  
  /**
   * Shadow elevation level
   * @default 'low'
   */
  elevation?: 'low' | 'medium' | 'high';
  
  /**
   * Removes default padding if true
   * @default false
   */
  noPadding?: boolean;
  
  /**
   * Optional header content
   */
  header?: React.ReactNode;
  
  /**
   * Optional footer content
   */
  footer?: React.ReactNode;
  
  /**
   * Click handler for interactive cards
   */
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
}

const Card: React.FC<CardProps> = ({
  children,
  className,
  variant = 'default',
  interactive = false,
  elevation = 'low',
  noPadding = false,
  header,
  footer,
  onClick,
  ...props
}) => {
  // Base styles using theme configuration
  const baseStyles = clsx(
    // Core card styles
    'rounded-lg',
    'bg-white dark:bg-gray-800',
    'transition-all duration-200',
    'will-change-transform',
    
    // Variant styles
    {
      'border border-gray-200 dark:border-gray-700': variant === 'default',
      'border-2 border-primary-200 dark:border-primary-700': variant === 'outlined',
      [themeConfig.shadows.md]: variant === 'elevated',
    },
    
    // Elevation styles
    {
      [themeConfig.shadows.sm]: elevation === 'low',
      [themeConfig.shadows.md]: elevation === 'medium',
      [themeConfig.shadows.lg]: elevation === 'high',
    },
    
    // Interactive styles
    interactive && [
      'cursor-pointer',
      'hover:transform hover:scale-[1.02]',
      'active:scale-[0.98]',
      'focus-visible:ring-2 focus-visible:ring-primary-500',
      'focus-visible:outline-none',
    ],
    
    // Custom className
    className
  );

  // Content padding styles
  const contentStyles = clsx(
    'flex flex-col h-full',
    !noPadding && 'p-4'
  );

  // Header styles
  const headerStyles = clsx(
    'border-b border-gray-200 dark:border-gray-700',
    'px-4 py-3'
  );

  // Footer styles
  const footerStyles = clsx(
    'border-t border-gray-200 dark:border-gray-700',
    'px-4 py-3',
    'mt-auto'
  );

  return (
    <div
      role={interactive ? 'button' : 'article'}
      tabIndex={interactive ? 0 : undefined}
      className={baseStyles}
      onClick={interactive ? onClick : undefined}
      onKeyDown={interactive ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(e as React.MouseEvent<HTMLDivElement>);
        }
      } : undefined}
      aria-label={interactive ? 'Interactive card' : undefined}
      {...props}
    >
      {header && (
        <div className={headerStyles}>
          {header}
        </div>
      )}
      
      <div className={contentStyles}>
        {children}
      </div>

      {footer && (
        <div className={footerStyles}>
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;