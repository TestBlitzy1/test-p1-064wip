import { configureStore, combineReducers, Middleware } from '@reduxjs/toolkit'; // ^2.0.0
import authReducer from './auth.slice';
import analyticsReducer from './analytics.slice';
import campaignsReducer from './campaigns.slice';
import targetingReducer from './targeting.slice';

// Custom middleware for performance monitoring
const performanceMiddleware: Middleware = () => (next) => (action) => {
  const start = performance.now();
  const result = next(action);
  const end = performance.now();
  const duration = end - start;

  // Log actions taking longer than 100ms
  if (duration > 100) {
    console.warn(`Slow action detected: ${action.type} took ${duration.toFixed(2)}ms`);
  }

  return result;
};

// Custom middleware for error tracking
const errorMiddleware: Middleware = () => (next) => (action) => {
  try {
    return next(action);
  } catch (error) {
    console.error('Redux error:', {
      action,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

// Combine all feature reducers
const rootReducer = combineReducers({
  auth: authReducer,
  analytics: analyticsReducer,
  campaigns: campaignsReducer,
  targeting: targetingReducer
});

// Configure store with optimized middleware and development tools
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    // Optimize serialization checks for better performance
    serializableCheck: {
      // Ignore these action types in serialization checks
      ignoredActions: [
        'analytics/fetchTimeSeriesData/fulfilled',
        'campaigns/generateAICampaign/fulfilled'
      ],
      // Ignore these paths in serialization checks
      ignoredPaths: ['analytics.timeSeriesData', 'campaigns.templateCache']
    },
    // Enable immutability checks only in development
    immutableCheck: process.env.NODE_ENV === 'development',
    // Thunk configuration
    thunk: {
      extraArgument: undefined
    }
  }).concat(
    performanceMiddleware,
    errorMiddleware,
    // Add development-only middleware
    process.env.NODE_ENV === 'development' 
      ? [require('redux-logger').createLogger({
          collapsed: true,
          duration: true,
          timestamp: false
        })]
      : []
  ),
  // Enable Redux DevTools only in development
  devTools: process.env.NODE_ENV === 'development',
  // Preloaded state configuration
  preloadedState: undefined,
  // Enhance store with type checking
  enhancers: []
});

// Export types for global use
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

// Performance monitoring setup
if (process.env.NODE_ENV === 'production') {
  let lastUpdateTime = Date.now();
  store.subscribe(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTime;
    
    // Monitor for frequent state updates that might impact performance
    if (timeSinceLastUpdate < 16) { // ~60fps threshold
      console.warn('High-frequency state updates detected');
    }
    
    lastUpdateTime = now;
  });
}

// Export configured store
export default store;