'use client';

import { Inter } from '@fontsource/inter';
import { SessionProvider } from 'next-auth/react';
import { Provider as ReduxProvider } from 'react-redux';
import { Analytics } from '@vercel/analytics';
import { ErrorBoundary } from 'react-error-boundary';
import { ThemeProvider } from '../providers/ThemeProvider';
import { NotificationProvider } from '../providers/NotificationProvider';
import { AuthProvider } from '../providers/AuthProvider';
import '../styles/globals.css';

// Metadata configuration for SEO and security
export const metadata = {
  title: 'Sales Intelligence Platform',
  description: 'AI-powered digital advertising campaign creation and management platform for B2B marketers',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
  charset: 'utf-8',
  robots: 'index, follow',
  themeColor: '#0066CC',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png'
  },
  // Security headers
  headers: {
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  }
};

// Error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <div role="alert" className="error-boundary">
    <h2>Something went wrong</h2>
    <pre>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </div>
);

// Root layout props interface
interface RootLayoutProps {
  children: React.ReactNode;
  lang?: string;
}

/**
 * Root layout component that provides global context and configuration
 * Implements comprehensive error handling, authentication, and accessibility
 */
const RootLayout = ({ children, lang = 'en' }: RootLayoutProps) => {
  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0066CC" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body>
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onReset={() => window.location.reload()}
        >
          <ReduxProvider store={store}>
            <SessionProvider>
              <AuthProvider>
                <ThemeProvider>
                  <NotificationProvider>
                    <main 
                      id="main-content"
                      role="main"
                      className="app-container"
                    >
                      {children}
                    </main>
                    <Analytics />
                  </NotificationProvider>
                </ThemeProvider>
              </AuthProvider>
            </SessionProvider>
          </ReduxProvider>
        </ErrorBoundary>
        <div id="portal-root" /> {/* For modals and overlays */}
      </body>
    </html>
  );
};

export default RootLayout;