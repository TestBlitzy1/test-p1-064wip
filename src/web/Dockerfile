# Stage 1: Dependencies
FROM node:18-alpine AS dependencies
LABEL maintainer="Sales & Intelligence Platform Team"
LABEL version="1.0.0"
LABEL description="Next.js frontend for Sales & Intelligence Platform"

# Security: Add non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Set working directory with proper permissions
WORKDIR /app
RUN chown nextjs:nodejs /app

# Install dependencies with security measures
COPY --chown=nextjs:nodejs package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Development
FROM node:18-alpine AS development
WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs . .

# Development-specific environment setup
ENV NODE_ENV=development
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Development server configuration
EXPOSE 3000

# Set up development user and permissions
USER nextjs

# Development startup command with hot reloading
CMD ["npm", "run", "dev"]

# Stage 3: Builder
FROM node:18-alpine AS builder
WORKDIR /app

# Copy dependencies and source code
COPY --from=dependencies --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs . .

# Build-time environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Production build with optimizations
RUN npm run build && \
    npm prune --production

# Stage 4: Production
FROM node:18-alpine AS production
LABEL stage=production

# Install security updates and required packages
RUN apk --no-cache add curl=8.4.0-r0 && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

WORKDIR /app

# Copy production build and dependencies
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js ./
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Production environment configuration
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Security headers and configurations
ENV NEXT_PUBLIC_CSRF_TOKEN=true
ENV NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=16384"

# Set resource constraints
ENV NODE_MEMORY_LIMIT="2048"
ENV NODE_CPU_LIMIT="1"

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Expose application port
EXPOSE 3000

# Set proper permissions
RUN chown -R nextjs:nodejs /app && \
    chmod -R 550 /app && \
    chmod -R 770 /app/.next

# Switch to non-root user
USER nextjs

# Production startup command with clustering
CMD ["npm", "start"]