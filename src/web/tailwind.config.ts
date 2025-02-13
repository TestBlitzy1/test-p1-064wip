import type { Config } from 'tailwindcss';
import { themeConfig } from '../src/config/theme.config';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/app/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        primary: {
          main: themeConfig.colors.primary.main,
          light: themeConfig.colors.primary.light,
          dark: themeConfig.colors.primary.dark,
          contrastText: themeConfig.colors.primary.contrastText,
        },
        secondary: {
          main: themeConfig.colors.secondary.main,
          light: themeConfig.colors.secondary.light,
          dark: themeConfig.colors.secondary.dark,
          contrastText: themeConfig.colors.secondary.contrastText,
        },
        success: {
          main: themeConfig.colors.success.main,
          light: themeConfig.colors.success.light,
          dark: themeConfig.colors.success.dark,
          contrastText: themeConfig.colors.success.contrastText,
        },
        error: {
          main: themeConfig.colors.error.main,
          light: themeConfig.colors.error.light,
          dark: themeConfig.colors.error.dark,
          contrastText: themeConfig.colors.error.contrastText,
        },
        warning: {
          main: themeConfig.colors.warning.main,
          light: themeConfig.colors.warning.light,
          dark: themeConfig.colors.warning.dark,
          contrastText: themeConfig.colors.warning.contrastText,
        },
        info: {
          main: themeConfig.colors.info.main,
          light: themeConfig.colors.info.light,
          dark: themeConfig.colors.info.dark,
          contrastText: themeConfig.colors.info.contrastText,
        },
        grey: themeConfig.colors.grey,
        background: {
          default: '#FFFFFF',
          paper: '#F5F5F5',
          dark: '#121212',
        },
        text: {
          primary: '#333333', // WCAG AA compliant
          secondary: '#666666',
          disabled: '#9E9E9E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      spacing: {
        '0': '0',
        '1': '0.25rem',
        '2': '0.5rem',
        '3': '0.75rem',
        '4': '1rem',
        '5': '1.25rem',
        '6': '1.5rem',
        '8': '2rem',
        '10': '2.5rem',
        '12': '3rem',
        '16': '4rem',
        '20': '5rem',
        '24': '6rem',
        '32': '8rem',
        '40': '10rem',
        '48': '12rem',
        '56': '14rem',
        '64': '16rem',
      },
      borderRadius: {
        'none': '0',
        'sm': '0.125rem',
        'DEFAULT': '0.25rem',
        'md': '0.375rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
        'full': '9999px',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'DEFAULT': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        'none': 'none',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
  ],
};

export default config;