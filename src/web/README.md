# Sales & Intelligence Platform - Frontend Application

## Overview

The Sales & Intelligence Platform is an AI-powered solution for B2B marketers to automate and optimize digital advertising campaigns across LinkedIn Ads and Google Ads platforms. This repository contains the Next.js-based frontend application.

### Key Features
- AI-automated campaign structure generation
- Intelligent audience targeting and segmentation
- Real-time performance analytics and optimization
- Multi-platform campaign management (LinkedIn & Google Ads)

### Technology Stack
- Next.js 14.0+
- TypeScript 5.3+
- Material-UI (MUI) 5.14+
- Redux Toolkit 2.0+
- React Query 5.0+
- Auth0 Integration

## Prerequisites

- Node.js >= 18.17.0
- Docker >= 24.0.0
- Docker Compose >= 2.20.0
- Git >= 2.40.0
- npm >= 9.6.0

## Getting Started

### Environment Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd src/web
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.development .env.local
```

4. Start the development server:
```bash
# Using npm
npm run dev

# Using Docker
docker-compose up
```

The application will be available at `http://localhost:3000`.

## Development

### Project Structure
```
src/web/
├── public/
├── src/
│   ├── components/
│   ├── config/
│   ├── hooks/
│   ├── pages/
│   ├── services/
│   ├── store/
│   ├── styles/
│   └── types/
├── tests/
└── ...
```

### Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler check

# Testing
npm run test         # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report

# Production
npm run build        # Create production build
npm run start        # Start production server
```

## Testing

The application uses Jest and React Testing Library for testing:

- Unit Tests: `npm run test`
- Integration Tests: `npm run test:integration`
- E2E Tests: `npm run test:e2e`
- Coverage Report: `npm run test:coverage`

## Deployment

### Production Build

1. Build the Docker image:
```bash
docker build -t sales-intelligence-frontend:latest .
```

2. Deploy to Kubernetes:
```bash
kubectl apply -f k8s/
```

### Environment Variables

Critical environment variables for production:

```bash
NEXT_PUBLIC_API_URL=https://api.production.example.com
NEXT_PUBLIC_API_VERSION=v1
NEXTAUTH_URL=https://app.production.example.com
NEXTAUTH_SECRET=<secure-secret>
```

## Security

### Authentication

- OAuth 2.0 / OpenID Connect via Auth0
- JWT-based session management
- Automatic token rotation
- CSRF protection enabled

### API Security

- TLS 1.3 encryption
- Rate limiting
- Request validation
- Secure headers configuration

## Performance Optimization

- Server-side rendering (SSR)
- Static site generation (SSG) where applicable
- Image optimization
- Code splitting
- Bundle size optimization
- Redis caching

## Monitoring & Analytics

- Real-time performance monitoring
- Error tracking via Sentry
- User analytics
- Performance metrics collection

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests
4. Submit a pull request

## License

Proprietary - All rights reserved

## Support

For support and issues, please contact the development team or create an issue in the repository.