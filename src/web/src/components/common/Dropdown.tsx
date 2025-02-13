import React, { useState, useRef, useEffect, useCallback } from 'react'; // v18.0.0
import classNames from 'classnames'; // v2.3.2
import useMediaQuery from '../../hooks/useMediaQuery';
import { ComponentProps } from '../../types/common';
import { breakpoints, transitions, shadows, colors } from '../../config/theme.config';

interface DropdownProps extends ComponentProps {
  options: Array<{ value: string; label: string }>;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  multiSelect?: boolean;
  searchable?: boolean;
  maxHeight?: string;
}

const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  error,
  multiSelect = false,
  searchable = false,
  maxHeight = '300px',
  className,
}) => {
  // State management
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [filteredOptions, setFilteredOptions] = useState(options);

  // Refs for DOM elements
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Media query for responsive design
  const isMobile = useMediaQuery(`(max-width: ${breakpoints.sm})`);

  // Filter options based on search query
  useEffect(() => {
    if (searchable && searchQuery) {
      const filtered = options.filter(option =>
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredOptions(filtered);
      setHighlightedIndex(-1);
    } else {
      setFilteredOptions(options);
    }
  }, [searchQuery, options, searchable]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle dropdown trigger click
  const handleTriggerClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    if (!disabled) {
      setIsOpen(prev => !prev);
      setSearchQuery('');
      setHighlightedIndex(-1);
    }
  }, [disabled]);

  // Handle option selection
  const handleOptionSelect = useCallback((optionValue: string) => {
    if (multiSelect) {
      const currentValues = Array.isArray(value) ? value : [];
      const newValue = currentValues.includes(optionValue)
        ? currentValues.filter(v => v !== optionValue)
        : [...currentValues, optionValue];
      onChange(newValue);
    } else {
      onChange(optionValue);
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  }, [value, onChange, multiSelect]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        if (!isOpen) {
          event.preventDefault();
          setIsOpen(true);
        } else if (highlightedIndex >= 0) {
          event.preventDefault();
          handleOptionSelect(filteredOptions[highlightedIndex].value);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case 'ArrowDown':
        event.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Tab':
        if (isOpen) {
          event.preventDefault();
          setIsOpen(false);
        }
        break;
    }
  }, [disabled, isOpen, highlightedIndex, filteredOptions, handleOptionSelect]);

  // Handle search input changes
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);

  // Get display value for trigger button
  const getDisplayValue = () => {
    if (Array.isArray(value)) {
      if (value.length === 0) return placeholder;
      const selectedLabels = value
        .map(v => options.find(opt => opt.value === v)?.label)
        .filter(Boolean);
      return selectedLabels.join(', ');
    }
    return options.find(opt => opt.value === value)?.label || placeholder;
  };

  return (
    <div
      ref={dropdownRef}
      className={classNames(
        'relative inline-block w-full',
        className,
        { 'opacity-50 cursor-not-allowed': disabled }
      )}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="dropdown-options"
        aria-disabled={disabled}
        aria-invalid={!!error}
        className={classNames(
          'w-full px-4 py-2 text-left bg-white border rounded-md',
          'focus:outline-none focus:ring-2 focus:ring-primary-light',
          'transition-all duration-200',
          {
            'border-error-main': error,
            'border-grey-300': !error,
            'hover:border-primary-main': !disabled && !error,
          }
        )}
        onClick={handleTriggerClick}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      >
        <span className="block truncate">{getDisplayValue()}</span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg
            className={classNames(
              'w-5 h-5 text-grey-400 transition-transform duration-200',
              { 'transform rotate-180': isOpen }
            )}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>

      {error && (
        <p className="mt-1 text-sm text-error-main" role="alert">
          {error}
        </p>
      )}

      {isOpen && (
        <div
          ref={optionsRef}
          className={classNames(
            'absolute z-50 w-full mt-1 bg-white rounded-md shadow-lg',
            'border border-grey-200',
            { 'bottom-full mb-1': isMobile }
          )}
          style={{ maxHeight }}
        >
          {searchable && (
            <div className="sticky top-0 p-2 bg-white border-b border-grey-200">
              <input
                ref={searchInputRef}
                type="text"
                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-light"
                placeholder="Search options..."
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
              />
            </div>
          )}

          <div
            role="listbox"
            aria-multiselectable={multiSelect}
            className="overflow-auto"
            style={{ maxHeight: searchable ? `calc(${maxHeight} - 57px)` : maxHeight }}
          >
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-2 text-sm text-grey-500">
                No options found
              </div>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = Array.isArray(value)
                  ? value.includes(option.value)
                  : value === option.value;

                return (
                  <div
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    className={classNames(
                      'px-4 py-2 cursor-pointer text-sm',
                      'transition-colors duration-150',
                      {
                        'bg-primary-light text-white': highlightedIndex === index,
                        'bg-grey-100': isSelected && highlightedIndex !== index,
                        'hover:bg-grey-50': highlightedIndex !== index && !isSelected,
                      }
                    )}
                    onClick={() => handleOptionSelect(option.value)}
                  >
                    {multiSelect && (
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={isSelected}
                        onChange={() => {}}
                      />
                    )}
                    {option.label}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dropdown;