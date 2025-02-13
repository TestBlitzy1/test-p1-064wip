import { useEffect, useState } from 'react'; // v18.0.0
import { breakpoints } from '../config/theme.config';

/**
 * Default matches value for SSR environments where window is not available
 * Set to false to ensure consistent behavior between server and client
 */
const DEFAULT_MATCHES = false;

/**
 * A custom React hook that provides media query matching functionality for responsive design.
 * Handles SSR scenarios and properly manages event listener lifecycle.
 * 
 * @param query - The media query string to evaluate (e.g. "(min-width: 768px)")
 * @returns boolean - Whether the media query matches the current viewport
 * 
 * @example
 * // Using with theme breakpoints
 * const isDesktop = useMediaQuery(`(min-width: ${breakpoints.lg})`);
 * 
 * // Using with custom query
 * const isRetina = useMediaQuery('(min-resolution: 2dppx)');
 */
const useMediaQuery = (query: string): boolean => {
  // Handle SSR case where window is not available
  const isClient = typeof window !== 'undefined';

  // Initialize state with proper initial value based on environment
  const [matches, setMatches] = useState<boolean>(() => {
    if (!isClient) {
      return DEFAULT_MATCHES;
    }
    
    // Get initial match state if in browser environment
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (!isClient) {
      return undefined;
    }

    // Create media query list
    const mediaQueryList = window.matchMedia(query);

    // Define handler function
    const updateMatches = (event: MediaQueryListEvent): void => {
      setMatches(event.matches);
    };

    // Set initial value
    setMatches(mediaQueryList.matches);

    // Add listener using modern API
    // Note: addListener/removeListener are deprecated
    mediaQueryList.addEventListener('change', updateMatches);

    // Cleanup function to remove listener
    return () => {
      mediaQueryList.removeEventListener('change', updateMatches);
    };
  }, [query, isClient]); // Re-run effect if query changes or client status changes

  return matches;
};

export default useMediaQuery;