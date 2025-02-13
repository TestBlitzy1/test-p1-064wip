import express, { Express, Request, Response, NextFunction } from 'express'; // v4.18.2
import { beforeAll, afterAll } from '@jest/globals'; // v29.0.0
import supertest from 'supertest'; // v6.3.3
import cors from 'cors'; // v2.8.5
import morgan from 'morgan'; // v1.10.0
import { TEST_DATABASE_CONFIG } from '../config/test-database.config';
import { initializeTestDatabase, cleanupTestDatabase } from './test-database';

/**
 * Global test server instance
 */
let testServer: Express | null = null;

/**
 * Test server configuration constants
 */
const TEST_SERVER_PORT: number = 4000;
const TEST_SERVER_HOST: string = 'localhost';
const REQUEST_TIMEOUT: number = 5000;

/**
 * Starts the test server with proper configuration and middleware
 * Initializes database connection and sets up all required routes
 */
export const startTestServer = beforeAll(async (): Promise<void> => {
    try {
        // Initialize test database first
        await initializeTestDatabase();

        // Create Express application
        const app: Express = express();

        // Configure security middleware
        app.use(cors({
            origin: `http://${TEST_SERVER_HOST}:${TEST_SERVER_PORT}`,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            credentials: true,
            maxAge: 3600
        }));

        // Configure request parsing
        app.use(express.json({ limit: '10mb' }));
        app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Configure request logging for test environment
        app.use(morgan('dev', {
            skip: (req) => req.url === '/health'
        }));

        // Set request timeout
        app.use((req: Request, res: Response, next: NextFunction) => {
            res.setTimeout(REQUEST_TIMEOUT, () => {
                res.status(408).json({ error: 'Request timeout' });
            });
            next();
        });

        // Configure test routes
        configureTestRoutes(app);

        // Global error handler
        app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
            console.error('Server Error:', err);
            res.status(500).json({
                error: 'Internal Server Error',
                message: process.env.NODE_ENV === 'test' ? err.message : undefined
            });
        });

        // Start server
        await new Promise<void>((resolve, reject) => {
            try {
                const server = app.listen(TEST_SERVER_PORT, TEST_SERVER_HOST, () => {
                    console.log(`Test server started at http://${TEST_SERVER_HOST}:${TEST_SERVER_PORT}`);
                    resolve();
                });

                server.on('error', (error) => {
                    reject(error);
                });
            } catch (error) {
                reject(error);
            }
        });

        testServer = app;

    } catch (error) {
        console.error('Failed to start test server:', error);
        throw error;
    }
});

/**
 * Stops the test server and cleans up resources
 * Ensures proper database cleanup and connection closing
 */
export const stopTestServer = afterAll(async (): Promise<void> => {
    try {
        if (testServer) {
            // Close all active connections
            await new Promise<void>((resolve, reject) => {
                const server = testServer?.listen();
                server?.close((err) => {
                    if (err) reject(err);
                    resolve();
                });
            });

            // Cleanup database
            await cleanupTestDatabase();

            testServer = null;
            console.log('Test server stopped and cleaned up');
        }
    } catch (error) {
        console.error('Failed to stop test server:', error);
        throw error;
    }
});

/**
 * Returns the complete base URL of the test server
 */
export const getTestServerUrl = (): string => {
    return `http://${TEST_SERVER_HOST}:${TEST_SERVER_PORT}`;
};

/**
 * Configures all test API routes with mock handlers
 * Sets up endpoints for testing campaign, analytics, and audience features
 */
const configureTestRoutes = (app: Express): void => {
    // Health check endpoint
    app.get('/health', (req: Request, res: Response) => {
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Campaign routes
    app.get('/api/campaigns', (req: Request, res: Response) => {
        res.json({
            campaigns: [
                {
                    id: 'test-campaign-1',
                    name: 'Test B2B Campaign',
                    status: 'active',
                    budget: 5000,
                    platform: 'linkedin'
                }
            ]
        });
    });

    // Analytics routes
    app.get('/api/analytics', (req: Request, res: Response) => {
        res.json({
            metrics: {
                impressions: 10000,
                clicks: 500,
                conversions: 50,
                ctr: 0.05,
                conversionRate: 0.1
            }
        });
    });

    // Audience routes
    app.get('/api/audiences', (req: Request, res: Response) => {
        res.json({
            segments: [
                {
                    id: 'test-segment-1',
                    name: 'Tech Decision Makers',
                    size: 50000,
                    criteria: {
                        industry: 'Technology',
                        jobTitles: ['CTO', 'IT Director']
                    }
                }
            ]
        });
    });

    // Error simulation route for testing
    app.get('/api/test/error', () => {
        throw new Error('Simulated test error');
    });

    // Add security headers
    app.use((req: Request, res: Response, next: NextFunction) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        next();
    });
};