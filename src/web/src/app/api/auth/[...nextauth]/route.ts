// next-auth v4.x
import NextAuth, { type AuthOptions } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import { RateLimiter } from 'rate-limiter-flexible'; // v2.4.1
import { authConfig } from '@/config/auth.config';
import { UserRole } from '@/types/auth';

// Validate required environment variables
if (!process.env.NEXTAUTH_URL || !process.env.NEXTAUTH_SECRET) {
  throw new Error('Required environment variables NEXTAUTH_URL and NEXTAUTH_SECRET must be set');
}

// Initialize rate limiter for authentication requests
const rateLimiter = new RateLimiter({
  points: +(process.env.RATE_LIMIT_MAX || 5), // Number of attempts
  duration: 60, // Per minute
  blockDuration: 300, // Block for 5 minutes
});

// Security headers for all authentication responses
const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/**
 * Enhanced NextAuth handler with rate limiting and security features
 * @param request - Incoming request object
 * @returns Authentication response with security measures
 */
async function handler(request: Request) {
  // Extract client IP for rate limiting
  const forwardedFor = request.headers.get('x-forwarded-for');
  const clientIp = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';

  try {
    // Apply rate limiting
    await rateLimiter.consume(clientIp);

    // Generate unique session fingerprint
    const sessionFingerprint = crypto.randomUUID();

    // Enhanced NextAuth configuration with session fingerprinting
    const authOptions: AuthOptions = {
      ...authConfig,
      callbacks: {
        ...authConfig.callbacks,
        async jwt({ token, user }) {
          if (user) {
            // Enhance JWT with fingerprint and additional security measures
            return {
              ...token,
              sessionFingerprint,
              iat: Date.now() / 1000,
              exp: Date.now() / 1000 + (+(process.env.SESSION_MAXAGE || 86400)),
              jti: crypto.randomUUID(),
            };
          }
          return token;
        },
        async session({ session, token }) {
          // Enhanced session security checks
          if (token) {
            // Validate session fingerprint
            if (token.sessionFingerprint !== sessionFingerprint) {
              throw new Error('Invalid session fingerprint');
            }

            // Add user role and permissions to session
            session.user.role = token.user?.role || UserRole.VIEWER;
            session.accessToken = token.accessToken as string;
            session.error = token.error as string | undefined;
          }
          return session;
        },
      },
      // Enhanced security options
      secret: process.env.NEXTAUTH_SECRET,
      session: {
        strategy: 'jwt',
        maxAge: +(process.env.SESSION_MAXAGE || 86400),
      },
    };

    // Initialize NextAuth handler with enhanced configuration
    const response = await NextAuth(authOptions)(request);

    // Apply security headers to response
    Object.entries(securityHeaders).forEach(([header, value]) => {
      response.headers.set(header, value);
    });

    // Add session fingerprint to response headers
    response.headers.set('X-Session-Fingerprint', sessionFingerprint);

    return response;
  } catch (error) {
    if (error.remainingPoints === 0) {
      // Rate limit exceeded
      return new Response(
        JSON.stringify({
          error: 'Too many requests',
          retryAfter: error.msBeforeNext / 1000,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': `${Math.ceil(error.msBeforeNext / 1000)}`,
            ...securityHeaders,
          },
        }
      );
    }

    // Handle other errors
    return new Response(
      JSON.stringify({ error: 'Authentication error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...securityHeaders,
        },
      }
    );
  }
}

// Export enhanced handlers for Next.js API routes
export const GET = handler;
export const POST = handler;