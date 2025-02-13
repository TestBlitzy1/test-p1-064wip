// Theme configuration file - v1.0.0
// Implements design system with WCAG AA compliance and responsive design support

// Theme enum for application-wide theme selection
export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system'
}

export const defaultTheme = Theme.SYSTEM;

// Color palette with WCAG AA compliant combinations
const colors = {
  primary: {
    main: '#0066CC', // Accessible on white with 4.5:1 contrast ratio
    light: '#4D94DB',
    dark: '#004C99',
    contrastText: '#FFFFFF'
  },
  secondary: {
    main: '#6B7280',
    light: '#9CA3AF',
    dark: '#4B5563',
    contrastText: '#FFFFFF'
  },
  error: {
    main: '#DC2626', // Accessible red for error states
    light: '#EF4444',
    dark: '#B91C1C',
    contrastText: '#FFFFFF'
  },
  warning: {
    main: '#D97706',
    light: '#F59E0B',
    dark: '#B45309',
    contrastText: '#FFFFFF'
  },
  success: {
    main: '#059669',
    light: '#10B981',
    dark: '#047857',
    contrastText: '#FFFFFF'
  },
  info: {
    main: '#2563EB',
    light: '#3B82F6',
    dark: '#1D4ED8',
    contrastText: '#FFFFFF'
  },
  grey: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827'
  }
};

// Typography system with responsive scaling
const typography = {
  fontFamily: {
    primary: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    code: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem'
  },
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },
  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2
  }
};

// Spacing system for consistent layout
export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem'
};

// Responsive breakpoints
export const breakpoints = {
  xs: '0px',
  sm: '600px',
  md: '900px',
  lg: '1200px',
  xl: '1536px'
};

// Shadow system for depth and elevation
export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
};

// Animation and transition system
export const transitions = {
  default: 'all 0.2s ease-in-out',
  fast: 'all 0.1s ease-in-out',
  slow: 'all 0.3s ease-in-out'
};

// Z-index system for layering
export const zIndex = {
  modal: 1000,
  popover: 900,
  tooltip: 800,
  header: 700
};

// Utility function to calculate contrast ratio for WCAG compliance
export function getContrastRatio(color1: string, color2: string): number {
  const getLuminance = (color: string): number => {
    const rgb = color.startsWith('#') 
      ? [
          parseInt(color.slice(1, 3), 16) / 255,
          parseInt(color.slice(3, 5), 16) / 255,
          parseInt(color.slice(5, 7), 16) / 255,
        ]
      : color.match(/\d+/g)!.map(n => parseInt(n) / 255);

    const [r, g, b] = rgb.map(val => 
      val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
    );

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);

  return (brightest + 0.05) / (darkest + 0.05);
}

// Light theme configuration
export const lightTheme = {
  colors: {
    ...colors,
    background: {
      default: colors.grey[50],
      paper: '#FFFFFF',
      contrast: colors.grey[900]
    },
    text: {
      primary: colors.grey[900],
      secondary: colors.grey[600],
      disabled: colors.grey[400]
    }
  },
  typography,
  spacing,
  components: {
    button: {
      borderRadius: '0.375rem',
      fontSize: typography.fontSize.base,
      padding: `${spacing.sm} ${spacing.lg}`,
      transition: transitions.default
    },
    input: {
      borderRadius: '0.375rem',
      borderColor: colors.grey[300],
      fontSize: typography.fontSize.base,
      padding: spacing.sm
    }
  }
};

// Dark theme configuration
export const darkTheme = {
  colors: {
    ...colors,
    background: {
      default: colors.grey[900],
      paper: colors.grey[800],
      contrast: colors.grey[50]
    },
    text: {
      primary: colors.grey[50],
      secondary: colors.grey[300],
      disabled: colors.grey[500]
    }
  },
  typography,
  spacing,
  components: {
    ...lightTheme.components,
    input: {
      ...lightTheme.components.input,
      borderColor: colors.grey[600]
    }
  }
};

// Main theme configuration object
export const themeConfig = {
  colors,
  typography,
  spacing,
  breakpoints,
  shadows,
  borderRadius: {
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    full: '9999px'
  },
  transitions,
  zIndex,
  components: {
    ...lightTheme.components,
    card: {
      borderRadius: '0.5rem',
      padding: spacing.lg,
      boxShadow: shadows.md
    },
    dialog: {
      borderRadius: '0.5rem',
      padding: spacing.xl,
      boxShadow: shadows.lg
    },
    tooltip: {
      borderRadius: '0.25rem',
      padding: `${spacing.xs} ${spacing.sm}`,
      fontSize: typography.fontSize.sm
    }
  }
};