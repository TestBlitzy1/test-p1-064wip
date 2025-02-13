import withBundleAnalyzer from '@next/bundle-analyzer'; // v14.0.x
import { apiConfig } from './src/config/api.config';

/**
 * Security headers configuration function
 * Implements comprehensive security policies based on technical requirements
 */
const getHeaders = () => [
  {
    source: '/:path*',
    headers: [
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://analytics.google.com",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https://storage.googleapis.com",
          "font-src 'self' data:",
          "connect-src 'self' https://api.linkedin.com https://ads.google.com",
          "frame-ancestors 'none'",
          "form-action 'self'",
          "base-uri 'self'",
          "object-src 'none'"
        ].join('; ')
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload'
      },
      {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN'
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff'
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin'
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
      },
      {
        key: 'X-XSS-Protection',
        value: '1; mode=block'
      }
    ]
  }
];

/**
 * Next.js configuration object with comprehensive settings for
 * performance, security, and API integration
 */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
    NEXT_PUBLIC_RATE_LIMIT: process.env.NEXT_PUBLIC_RATE_LIMIT
  },

  // Image optimization configuration
  images: {
    domains: ['storage.googleapis.com'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Security headers
  headers: getHeaders,

  // API rewrites with rate limiting
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiConfig.baseUrl}/api/:path*`,
        has: [
          {
            type: 'header',
            key: 'x-rate-limit',
            value: '(?<limit>.*)'
          }
        ]
      }
    ];
  },

  // Webpack configuration for optimizations
  webpack: (config, { dev, isServer }) => {
    // Enable bundle analyzer in production
    if (!dev && !isServer) {
      withBundleAnalyzer({
        enabled: process.env.ANALYZE === 'true'
      })(config);
    }

    // Optimization settings
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
        minChunks: 1,
        maxAsyncRequests: 30,
        maxInitialRequests: 30,
        cacheGroups: {
          defaultVendors: {
            test: /[\\/]node_modules[\\/]/,
            priority: -10,
            reuseExistingChunk: true,
            name: 'vendors'
          },
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true
          }
        }
      }
    };

    // Module rules for optimized builds
    config.module.rules.push({
      test: /\.(js|jsx|ts|tsx)$/,
      exclude: /node_modules/,
      use: [
        {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true,
            presets: ['next/babel']
          }
        }
      ]
    });

    return config;
  },

  // Performance optimizations
  experimental: {
    optimizeCss: true,
    scrollRestoration: true,
    legacyBrowsers: false,
    browsersListForSwc: true
  },

  // Compiler options
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
    styledComponents: true
  },

  // Build configuration
  swcMinify: true,
  compress: true,
  productionBrowserSourceMaps: false,
  optimizeFonts: true,

  // i18n configuration
  i18n: {
    locales: ['en'],
    defaultLocale: 'en'
  }
};

export default nextConfig;