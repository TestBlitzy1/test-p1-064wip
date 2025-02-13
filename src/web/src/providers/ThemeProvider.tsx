import React from 'react'; // ^18.0.0
import { 
  themeConfig, 
  Theme, 
  lightTheme, 
  darkTheme, 
  defaultTheme,
  getContrastRatio 
} from '../config/theme.config';
import { getItem, setItem } from '../utils/storage';

// Storage key for theme preference
const THEME_STORAGE_KEY = 'theme_preference';

// Duration for theme transition animations
const TRANSITION_DURATION = 200;

// Interface for theme context value
interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  isSystemTheme: boolean;
  contrastRatio: number;
  isValidTheme: boolean;
  themeTransition: string;
}

// Create theme context with type safety
const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

// Props interface for ThemeProvider
interface ThemeProviderProps {
  children: React.ReactNode;
}

// Utility to check system dark mode preference
const getSystemTheme = (): Theme => {
  if (typeof window === 'undefined') return Theme.LIGHT;
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? Theme.DARK
    : Theme.LIGHT;
};

// Validate theme meets WCAG AA contrast requirements
const validateThemeContrast = (theme: Theme): boolean => {
  const currentTheme = theme === Theme.DARK ? darkTheme : lightTheme;
  const { background, text } = currentTheme.colors;
  
  // WCAG AA requires minimum contrast ratio of 4.5:1
  const textContrast = getContrastRatio(text.primary, background.default);
  const headingContrast = getContrastRatio(text.primary, background.paper);
  
  return textContrast >= 4.5 && headingContrast >= 4.5;
};

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Initialize theme from storage or default
  const [theme, setThemeState] = React.useState<Theme>(() => {
    const savedTheme = getItem<Theme>(THEME_STORAGE_KEY);
    return savedTheme || defaultTheme;
  });

  // Track system theme changes
  const [systemTheme, setSystemTheme] = React.useState<Theme>(getSystemTheme());

  // Calculate current theme based on system preference
  const currentTheme = theme === Theme.SYSTEM ? systemTheme : theme;
  const isDarkMode = currentTheme === Theme.DARK;

  // Calculate contrast ratio for current theme
  const contrastRatio = React.useMemo(() => {
    const { colors } = isDarkMode ? darkTheme : lightTheme;
    return getContrastRatio(colors.text.primary, colors.background.default);
  }, [isDarkMode]);

  // Validate theme meets accessibility requirements
  const isValidTheme = React.useMemo(() => 
    validateThemeContrast(currentTheme),
    [currentTheme]
  );

  // Theme transition CSS
  const themeTransition = `background-color ${TRANSITION_DURATION}ms ease-in-out, color ${TRANSITION_DURATION}ms ease-in-out`;

  // Update theme with storage persistence
  const setTheme = React.useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    setItem(THEME_STORAGE_KEY, newTheme);
  }, []);

  // Toggle between light and dark themes
  const toggleTheme = React.useCallback(() => {
    const newTheme = isDarkMode ? Theme.LIGHT : Theme.DARK;
    setTheme(newTheme);
  }, [isDarkMode, setTheme]);

  // Listen for system theme changes
  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? Theme.DARK : Theme.LIGHT);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Apply theme to document
  React.useEffect(() => {
    const root = document.documentElement;
    const theme = isDarkMode ? darkTheme : lightTheme;

    // Apply theme CSS variables
    Object.entries(theme.colors).forEach(([key, value]) => {
      if (typeof value === 'object') {
        Object.entries(value).forEach(([subKey, color]) => {
          root.style.setProperty(`--color-${key}-${subKey}`, color as string);
        });
      }
    });

    // Apply theme class
    root.classList.remove(isDarkMode ? 'light' : 'dark');
    root.classList.add(isDarkMode ? 'dark' : 'light');
    
    // Apply transition styles
    root.style.setProperty('--theme-transition', themeTransition);
  }, [isDarkMode, themeTransition]);

  const contextValue: ThemeContextValue = React.useMemo(() => ({
    theme,
    setTheme,
    isDarkMode,
    toggleTheme,
    isSystemTheme: theme === Theme.SYSTEM,
    contrastRatio,
    isValidTheme,
    themeTransition
  }), [theme, setTheme, isDarkMode, toggleTheme, contrastRatio, isValidTheme, themeTransition]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook for accessing theme context
export const useTheme = (): ThemeContextValue => {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};