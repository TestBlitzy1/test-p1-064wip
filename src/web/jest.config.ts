// jest.config.ts
// Jest configuration for Next.js frontend application
// jest v29.0.0

import type { Config } from 'jest';

const config: Config = {
  // Use jsdom environment for browser-like testing
  testEnvironment: 'jsdom',

  // Root directory for tests
  roots: ['<rootDir>/src'],

  // Module name mapping for absolute imports
  moduleNameMapper: {
    // Map @ aliases to match tsconfig paths
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@store/(.*)$': '<rootDir>/src/store/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@styles/(.*)$': '<rootDir>/src/styles/$1',
    // Handle CSS imports
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },

  // Setup files to run before tests
  setupFilesAfterEnv: ['<rootDir>/src/test/setupTests.ts'],

  // Patterns to ignore during testing
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
  ],

  // Transform files with babel-jest
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: ['next/babel']
    }],
  },

  // Files to collect coverage from
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.{js,ts}',
    '!src/test/**/*',
    '!src/types/**/*',
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // File extensions to consider
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
  ],

  // Watch plugins for better testing experience
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],

  // Verbose output for detailed test results
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Enable code coverage collection
  collectCoverage: true,

  // Directory where coverage reports will be output
  coverageDirectory: 'coverage',

  // Coverage report formats
  coverageReporters: [
    'json',
    'lcov',
    'text',
    'clover',
  ],
};

export default config;