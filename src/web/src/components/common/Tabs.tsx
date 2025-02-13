import React, { useState, useRef, useEffect } from 'react'; // v18.0.0
import clsx from 'clsx'; // v2.0.0
import useMediaQuery from '../../hooks/useMediaQuery';
import type { ComponentProps } from '../../types/common';

interface TabsProps extends ComponentProps {
  tabs: Array<{
    label: string;
    content: React.ReactNode;
    disabled?: boolean;
  }>;
  defaultIndex?: number;
  onChange?: (index: number) => void;
  orientation?: 'horizontal' | 'vertical';
  animate?: boolean;
  ariaLabel?: string;
}

const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultIndex = 0,
  onChange,
  orientation: defaultOrientation = 'horizontal',
  animate = true,
  ariaLabel = 'Content Tabs',
  className,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(defaultIndex);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  
  // Responsive orientation handling
  const isTablet = useMediaQuery(`(max-width: 1199px)`);
  const isMobile = useMediaQuery(`(max-width: 767px)`);
  const orientation = isMobile ? 'horizontal' : (isTablet ? 'vertical' : defaultOrientation);

  // Update refs array when tabs change
  useEffect(() => {
    tabRefs.current = tabRefs.current.slice(0, tabs.length);
  }, [tabs.length]);

  const handleTabClick = (index: number) => {
    if (tabs[index].disabled) return;
    setSelectedIndex(index);
    setFocusedIndex(index);
    onChange?.(index);
    tabRefs.current[index]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const isHorizontal = orientation === 'horizontal';
    const maxIndex = tabs.length - 1;
    let newIndex = selectedIndex;

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        newIndex = selectedIndex - 1;
        if (newIndex < 0) newIndex = maxIndex;
        while (newIndex !== selectedIndex && tabs[newIndex].disabled) {
          newIndex = newIndex - 1;
          if (newIndex < 0) newIndex = maxIndex;
        }
        break;

      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        newIndex = selectedIndex + 1;
        if (newIndex > maxIndex) newIndex = 0;
        while (newIndex !== selectedIndex && tabs[newIndex].disabled) {
          newIndex = newIndex + 1;
          if (newIndex > maxIndex) newIndex = 0;
        }
        break;

      case 'Home':
        event.preventDefault();
        newIndex = 0;
        while (newIndex !== selectedIndex && tabs[newIndex].disabled) {
          newIndex = newIndex + 1;
        }
        break;

      case 'End':
        event.preventDefault();
        newIndex = maxIndex;
        while (newIndex !== selectedIndex && tabs[newIndex].disabled) {
          newIndex = newIndex - 1;
        }
        break;

      default:
        return;
    }

    if (newIndex !== selectedIndex && !tabs[newIndex].disabled) {
      setSelectedIndex(newIndex);
      setFocusedIndex(newIndex);
      onChange?.(newIndex);
      tabRefs.current[newIndex]?.focus();
    }
  };

  return (
    <div
      className={clsx(
        'tabs-container',
        orientation === 'vertical' ? 'flex flex-row' : 'flex flex-col',
        className
      )}
    >
      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation={orientation}
        className={clsx(
          'tabs-list',
          orientation === 'vertical' 
            ? 'flex flex-col min-w-[200px]' 
            : 'flex flex-row flex-wrap'
        )}
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab, index) => (
          <button
            key={`tab-${index}`}
            ref={el => tabRefs.current[index] = el}
            role="tab"
            aria-selected={selectedIndex === index}
            aria-controls={`tabpanel-${index}`}
            aria-disabled={tab.disabled}
            tabIndex={selectedIndex === index ? 0 : -1}
            className={clsx(
              'tab-button',
              'px-4 py-2 text-base font-medium transition-all',
              'focus:outline-none focus:ring-2 focus:ring-primary-500',
              selectedIndex === index 
                ? 'bg-primary-50 text-primary-700 border-primary-500' 
                : 'text-gray-600 hover:text-gray-900',
              tab.disabled && 'opacity-50 cursor-not-allowed',
              orientation === 'vertical'
                ? 'border-l-2 text-left w-full'
                : 'border-b-2'
            )}
            onClick={() => handleTabClick(index)}
            disabled={tab.disabled}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabs.map((tab, index) => (
        <div
          key={`tabpanel-${index}`}
          role="tabpanel"
          id={`tabpanel-${index}`}
          aria-labelledby={`tab-${index}`}
          hidden={selectedIndex !== index}
          className={clsx(
            'tab-panel',
            'p-4',
            orientation === 'vertical' ? 'flex-1' : 'w-full',
            animate && 'transition-opacity duration-200',
            selectedIndex === index ? 'opacity-100' : 'opacity-0'
          )}
          tabIndex={0}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
};

export default Tabs;