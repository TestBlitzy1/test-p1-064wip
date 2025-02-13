import { useState, useCallback, useEffect } from 'react'; // v18.0.0
import { useDispatch, useSelector } from 'react-redux'; // v8.0.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0
import { usePerformanceMonitor } from '@performance-monitor/react'; // v1.0.0

import { 
  createSegment, 
  updateSegment, 
  fetchInsights 
} from '../store/targeting.slice';
import { selectTargetingState } from '../store/targeting.slice';
import { 
  getAudienceSegments, 
  validateTargetingRules, 
  getPlatformConstraints 
} from '../lib/api/targeting';
import { 
  AudienceSegment, 
  TargetingRule, 
  PlatformConstraints, 
  Platform,
  TargetingRecommendation
} from '../types/targeting';

// Cache duration in milliseconds
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

interface TargetingHookOptions {
  enableCache?: boolean;
  retryOnError?: boolean;
  validateOnChange?: boolean;
  optimizationEnabled?: boolean;
}

interface PerformanceMetrics {
  loadTime: number;
  validationTime: number;
  optimizationTime: number;
}

interface AudienceInsights {
  estimatedReach: number;
  confidence: number;
  recommendations: TargetingRecommendation[];
}

export function useTargeting(platform: Platform, options: TargetingHookOptions = {}) {
  const dispatch = useDispatch();
  const targetingState = useSelector(selectTargetingState);
  const performance = usePerformanceMonitor('targeting');

  const [segments, setSegments] = useState<AudienceSegment[]>([]);
  const [activeSegment, setActiveSegment] = useState<AudienceSegment | null>(null);
  const [platformConstraints, setPlatformConstraints] = useState<PlatformConstraints | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cache, setCache] = useState<Map<string, { data: any; timestamp: number }>>(new Map());
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    loadTime: 0,
    validationTime: 0,
    optimizationTime: 0
  });
  const [aiInsights, setAiInsights] = useState<AudienceInsights>({
    estimatedReach: 0,
    confidence: 0,
    recommendations: []
  });

  // Cache management
  const getCachedData = useCallback((key: string) => {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    return null;
  }, [cache]);

  const setCachedData = useCallback((key: string, data: any) => {
    setCache(prev => new Map(prev).set(key, { data, timestamp: Date.now() }));
  }, []);

  // Retry logic with exponential backoff
  const retryOperation = useCallback(async (operation: () => Promise<any>) => {
    let attempt = 0;
    while (attempt < RETRY_ATTEMPTS) {
      try {
        return await operation();
      } catch (err) {
        attempt++;
        if (attempt === RETRY_ATTEMPTS) throw err;
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, attempt)));
      }
    }
  }, []);

  // Load platform constraints
  const loadPlatformConstraints = useCallback(async () => {
    const startTime = performance.now();
    try {
      const constraints = await retryOperation(() => getPlatformConstraints(platform));
      setPlatformConstraints(constraints);
      setPerformanceMetrics(prev => ({
        ...prev,
        loadTime: performance.now() - startTime
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load platform constraints');
    }
  }, [platform, retryOperation]);

  // Validate targeting rules
  const validateRules = useCallback(async (rules: TargetingRule[]): Promise<boolean> => {
    const startTime = performance.now();
    try {
      const isValid = await retryOperation(() => validateTargetingRules(rules, platform));
      setPerformanceMetrics(prev => ({
        ...prev,
        validationTime: performance.now() - startTime
      }));
      return isValid;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
      return false;
    }
  }, [platform, retryOperation]);

  // Create new segment with validation
  const createNewSegment = useCallback(async (segmentData: Partial<AudienceSegment>) => {
    setLoading(true);
    try {
      if (options.validateOnChange) {
        const isValid = await validateRules(segmentData.targetingRules || []);
        if (!isValid) throw new Error('Invalid targeting rules');
      }
      
      const newSegment = await retryOperation(() => 
        dispatch(createSegment(segmentData)).unwrap()
      );
      
      setSegments(prev => [...prev, newSegment]);
      setActiveSegment(newSegment);
      
      if (options.enableCache) {
        setCachedData('segments', segments);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create segment');
    } finally {
      setLoading(false);
    }
  }, [dispatch, options, validateRules, retryOperation, segments]);

  // Update existing segment
  const updateExistingSegment = useCallback(async (
    segmentId: string, 
    segmentData: Partial<AudienceSegment>
  ) => {
    setLoading(true);
    try {
      if (options.validateOnChange) {
        const isValid = await validateRules(segmentData.targetingRules || []);
        if (!isValid) throw new Error('Invalid targeting rules');
      }

      const updatedSegment = await retryOperation(() =>
        dispatch(updateSegment({ id: segmentId, data: segmentData })).unwrap()
      );

      setSegments(prev => 
        prev.map(seg => seg.id === segmentId ? updatedSegment : seg)
      );
      setActiveSegment(updatedSegment);

      if (options.enableCache) {
        setCachedData('segments', segments);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update segment');
    } finally {
      setLoading(false);
    }
  }, [dispatch, options, validateRules, retryOperation, segments]);

  // Load AI insights and recommendations
  const loadAiInsights = useCallback(async (segmentId: string) => {
    const startTime = performance.now();
    try {
      const insights = await retryOperation(() =>
        dispatch(fetchInsights(segmentId)).unwrap()
      );
      
      setAiInsights(insights);
      setPerformanceMetrics(prev => ({
        ...prev,
        optimizationTime: performance.now() - startTime
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI insights');
    }
  }, [dispatch, retryOperation]);

  // Initialize hook
  useEffect(() => {
    const initializeTargeting = async () => {
      setLoading(true);
      try {
        await loadPlatformConstraints();
        
        const cachedSegments = options.enableCache ? getCachedData('segments') : null;
        if (cachedSegments) {
          setSegments(cachedSegments);
        } else {
          const fetchedSegments = await retryOperation(() => getAudienceSegments());
          setSegments(fetchedSegments);
          if (options.enableCache) {
            setCachedData('segments', fetchedSegments);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize targeting');
      } finally {
        setLoading(false);
      }
    };

    initializeTargeting();
  }, [platform, options.enableCache, loadPlatformConstraints, retryOperation]);

  // Clear cache utility
  const clearCache = useCallback(() => {
    setCache(new Map());
  }, []);

  return {
    segments,
    activeSegment,
    loading,
    error,
    platformConstraints,
    performanceMetrics,
    aiInsights,
    createSegment: createNewSegment,
    updateSegment: updateExistingSegment,
    validateRules,
    retryOperation,
    clearCache
  };
}