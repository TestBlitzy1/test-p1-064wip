import React, { useState, useEffect, useMemo, useCallback } from 'react'; // v18.0.0
import { formatNumber, formatPercentage } from 'numeral'; // v2.0.6
import debounce from 'lodash/debounce'; // v4.17.21
import { ErrorBoundary } from '@sentry/react'; // v7.0.0

import Card from '../common/Card';
import { useTargeting } from '../../hooks/useTargeting';
import { Platform } from '../../types/common';
import { TargetingRecommendation } from '../../types/targeting';

interface AudienceInsightsProps {
  platform: Platform;
  segmentId: string;
  config?: {
    refreshInterval?: number;
    enableRealTimeValidation?: boolean;
    showConfidenceScores?: boolean;
  };
}

interface InsightMetrics {
  reach: number;
  confidence: number;
  costEstimate: {
    min: number;
    max: number;
    recommended: number;
  };
}

const AudienceInsights: React.FC<AudienceInsightsProps> = ({
  platform,
  segmentId,
  config = {
    refreshInterval: 30000,
    enableRealTimeValidation: true,
    showConfidenceScores: true
  }
}) => {
  // State management
  const [metrics, setMetrics] = useState<InsightMetrics>({
    reach: 0,
    confidence: 0,
    costEstimate: { min: 0, max: 0, recommended: 0 }
  });
  const [recommendations, setRecommendations] = useState<TargetingRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Custom hooks
  const {
    segments,
    activeSegment,
    platformConstraints,
    performanceMetrics,
    aiInsights,
    validateRules
  } = useTargeting(platform, {
    enableCache: true,
    validateOnChange: config.enableRealTimeValidation,
    optimizationEnabled: true
  });

  // Memoized calculations
  const reachScore = useMemo(() => {
    if (!activeSegment || !platformConstraints) return 0;
    const baseScore = (activeSegment.estimatedReach / platformConstraints.maxReach) * 100;
    return Math.min(Math.max(baseScore, 0), 100);
  }, [activeSegment, platformConstraints]);

  const confidenceIndicator = useMemo(() => {
    if (!config.showConfidenceScores || !aiInsights) return null;
    return {
      score: aiInsights.confidence * 100,
      label: aiInsights.confidence >= 0.7 ? 'High' : aiInsights.confidence >= 0.4 ? 'Medium' : 'Low'
    };
  }, [aiInsights, config.showConfidenceScores]);

  // Debounced validation handler
  const validateSegment = useCallback(
    debounce(async () => {
      if (!activeSegment?.targetingRules) return;
      
      try {
        const isValid = await validateRules(activeSegment.targetingRules);
        if (!isValid) {
          setError('Current targeting rules may not meet platform requirements');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Validation failed');
      }
    }, 500),
    [activeSegment, validateRules]
  );

  // Effect for data fetching and refresh
  useEffect(() => {
    let isSubscribed = true;
    const fetchInsights = async () => {
      setIsLoading(true);
      try {
        if (aiInsights) {
          if (isSubscribed) {
            setMetrics({
              reach: aiInsights.estimatedReach,
              confidence: aiInsights.confidence,
              costEstimate: {
                min: performanceMetrics.loadTime * 0.8,
                max: performanceMetrics.loadTime * 1.2,
                recommended: performanceMetrics.loadTime
              }
            });
            setRecommendations(aiInsights.recommendations);
          }
        }
      } catch (err) {
        if (isSubscribed) {
          setError(err instanceof Error ? err.message : 'Failed to load insights');
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    fetchInsights();
    const refreshInterval = setInterval(fetchInsights, config.refreshInterval);

    return () => {
      isSubscribed = false;
      clearInterval(refreshInterval);
    };
  }, [segmentId, aiInsights, performanceMetrics, config.refreshInterval]);

  // Effect for validation
  useEffect(() => {
    if (config.enableRealTimeValidation) {
      validateSegment();
    }
  }, [activeSegment, config.enableRealTimeValidation, validateSegment]);

  return (
    <ErrorBoundary fallback={<div>Error loading audience insights</div>}>
      <div className="space-y-4">
        {/* Main Insights Card */}
        <Card
          className="p-4"
          aria-label="Audience Insights Overview"
          elevation="medium"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Audience Insights</h2>
            {isLoading && (
              <span className="text-gray-500" aria-live="polite">
                Refreshing...
              </span>
            )}
          </div>

          {error && (
            <div 
              className="bg-red-50 text-red-700 p-3 rounded-md mb-4" 
              role="alert"
              aria-live="assertive"
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Reach Metrics */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500">Estimated Reach</h3>
              <p className="mt-2 text-2xl font-bold">
                {formatNumber(metrics.reach).format('0.0a')}
              </p>
              <div 
                className="mt-2 h-2 bg-gray-200 rounded-full"
                role="progressbar"
                aria-valuenow={reachScore}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div 
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: `${reachScore}%` }}
                />
              </div>
            </div>

            {/* Confidence Score */}
            {confidenceIndicator && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-500">Confidence Score</h3>
                <p className="mt-2 text-2xl font-bold">
                  {formatPercentage(confidenceIndicator.score).format('0.0%')}
                </p>
                <span className={`
                  mt-2 inline-block px-2 py-1 rounded-full text-sm
                  ${confidenceIndicator.label === 'High' ? 'bg-green-100 text-green-800' :
                    confidenceIndicator.label === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'}
                `}>
                  {confidenceIndicator.label}
                </span>
              </div>
            )}

            {/* Cost Estimate */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500">Estimated Cost</h3>
              <p className="mt-2 text-2xl font-bold">
                ${formatNumber(metrics.costEstimate.recommended).format('0,0')}
              </p>
              <p className="text-sm text-gray-500">
                Range: ${formatNumber(metrics.costEstimate.min).format('0,0')} - 
                ${formatNumber(metrics.costEstimate.max).format('0,0')}
              </p>
            </div>
          </div>
        </Card>

        {/* Recommendations Section */}
        {recommendations.length > 0 && (
          <Card
            className="p-4"
            aria-label="Targeting Recommendations"
            elevation="low"
          >
            <h3 className="text-lg font-semibold mb-4">Recommendations</h3>
            <ul className="space-y-3">
              {recommendations.map((rec, index) => (
                <li 
                  key={`${rec.segmentId}-${index}`}
                  className="bg-white p-3 rounded-md border border-gray-200"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{rec.reasoning[0]}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Expected impact: {formatPercentage(rec.expectedImpact.reachIncrease).format('+0.0%')} reach
                      </p>
                    </div>
                    <span className={`
                      px-2 py-1 rounded-full text-sm
                      ${rec.expectedImpact.confidenceScore > 0.7 ? 'bg-green-100 text-green-800' :
                        'bg-yellow-100 text-yellow-800'}
                    `}>
                      {formatPercentage(rec.expectedImpact.confidenceScore).format('0%')} confidence
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default AudienceInsights;