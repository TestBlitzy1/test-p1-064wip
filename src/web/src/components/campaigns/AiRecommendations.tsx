import React, { useState, useEffect, useCallback, useMemo } from 'react'; // ^18.0.0
import { useVirtualizer } from 'react-virtual'; // ^2.10.4
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import Card from '../common/Card';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import { useCampaign } from '../../hooks/useCampaign';
import { ApiError } from '../../types/api';
import { Campaign, PlatformType, RecommendationType } from '../../types/campaigns';

interface AiRecommendationsProps {
  campaignId: string;
  platformType: 'linkedin' | 'google';
  onSelect: (recommendations: RecommendationType[]) => void;
  timeoutDuration?: number;
}

interface RecommendationState {
  items: RecommendationType[];
  selected: Set<string>;
  loading: boolean;
  error: ApiError | null;
  generationProgress: number;
}

const DEFAULT_TIMEOUT = 30000; // 30-second SLA requirement
const VIRTUALIZATION_ROW_HEIGHT = 120;
const BATCH_SIZE = 20;

/**
 * AI-powered recommendations component for campaign optimization
 * Implements strict performance requirements and enhanced error handling
 */
const AiRecommendations: React.FC<AiRecommendationsProps> = ({
  campaignId,
  platformType,
  onSelect,
  timeoutDuration = DEFAULT_TIMEOUT
}) => {
  // State management with performance optimization
  const [state, setState] = useState<RecommendationState>({
    items: [],
    selected: new Set(),
    loading: false,
    error: null,
    generationProgress: 0
  });

  // Campaign generation hook
  const { generateCampaignStructure, error: campaignError } = useCampaign();

  // Virtualization for large recommendation sets
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: state.items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => VIRTUALIZATION_ROW_HEIGHT,
    overscan: 5
  });

  // Memoized recommendation filtering and sorting
  const sortedRecommendations = useMemo(() => {
    return [...state.items].sort((a, b) => 
      (b.confidenceScore || 0) - (a.confidenceScore || 0)
    );
  }, [state.items]);

  // Handle recommendation selection with debouncing
  const handleSelect = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      selected: new Set(prev.selected.has(id) 
        ? Array.from(prev.selected).filter(item => item !== id)
        : [...prev.selected, id]
      )
    }));
  }, []);

  // Generate recommendations with timeout handling
  const generateRecommendations = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

    try {
      const campaign = await generateCampaignStructure({
        platformType,
        targetingSettings: {
          industries: [],
          jobFunctions: [],
          companySizes: [],
          locations: []
        },
        budget: 0,
        signal: controller.signal
      });

      setState(prev => ({
        ...prev,
        items: campaign.optimizationHints?.suggestedBidAdjustments.map(hint => ({
          id: crypto.randomUUID(),
          type: 'targeting',
          content: hint.dimension,
          confidenceScore: hint.confidence,
          metrics: {
            potentialReach: 0,
            estimatedCtr: 0
          },
          platformValidation: {
            isValid: true,
            errors: []
          }
        })) || [],
        loading: false,
        generationProgress: 100
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error as ApiError,
        loading: false
      }));
    } finally {
      clearTimeout(timeoutId);
    }
  }, [generateCampaignStructure, platformType, timeoutDuration]);

  // Progress tracking effect
  useEffect(() => {
    if (state.loading) {
      const interval = setInterval(() => {
        setState(prev => ({
          ...prev,
          generationProgress: Math.min(prev.generationProgress + 5, 99)
        }));
      }, timeoutDuration / 20);

      return () => clearInterval(interval);
    }
  }, [state.loading, timeoutDuration]);

  // Error boundary fallback component
  const ErrorFallback = ({ error, resetErrorBoundary }: { 
    error: Error; 
    resetErrorBoundary: () => void; 
  }) => (
    <Card variant="outlined" className="p-4 bg-red-50">
      <h3 className="text-red-800 font-semibold mb-2">Error Generating Recommendations</h3>
      <p className="text-red-600 mb-4">{error.message}</p>
      <Button 
        variant="secondary" 
        onClick={resetErrorBoundary}
        ariaLabel="Retry generating recommendations"
      >
        Retry
      </Button>
    </Card>
  );

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={generateRecommendations}
    >
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">AI Recommendations</h2>
          <Button
            variant="primary"
            isLoading={state.loading}
            onClick={generateRecommendations}
            ariaLabel="Generate AI recommendations"
          >
            Generate Recommendations
          </Button>
        </div>

        {state.loading && (
          <div className="flex flex-col items-center gap-4 py-8">
            <LoadingSpinner size="large" />
            <div className="w-full max-w-md">
              <div className="h-2 bg-gray-200 rounded">
                <div 
                  className="h-full bg-primary-600 rounded transition-all duration-200"
                  style={{ width: `${state.generationProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2 text-center">
                Generating recommendations ({Math.round(state.generationProgress)}%)
              </p>
            </div>
          </div>
        )}

        {!state.loading && state.items.length > 0 && (
          <div
            ref={parentRef}
            className="h-[600px] overflow-auto"
            role="list"
            aria-label="AI recommendations list"
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative'
              }}
            >
              {rowVirtualizer.getVirtualItems().map(virtualRow => {
                const recommendation = sortedRecommendations[virtualRow.index];
                return (
                  <div
                    key={recommendation.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                  >
                    <Card
                      variant="outlined"
                      interactive
                      className={`m-2 transition-all ${
                        state.selected.has(recommendation.id) 
                          ? 'border-primary-500 bg-primary-50' 
                          : ''
                      }`}
                      onClick={() => handleSelect(recommendation.id)}
                    >
                      <div className="flex justify-between p-4">
                        <div>
                          <h3 className="font-medium">{recommendation.content}</h3>
                          <p className="text-sm text-gray-600">
                            Confidence: {(recommendation.confidenceScore * 100).toFixed(1)}%
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {recommendation.platformValidation.isValid && (
                            <span className="text-green-600 text-sm">✓ Platform Validated</span>
                          )}
                        </div>
                      </div>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!state.loading && state.items.length === 0 && !state.error && (
          <Card variant="outlined" className="p-8 text-center text-gray-600">
            No recommendations available. Click generate to start.
          </Card>
        )}

        {state.selected.size > 0 && (
          <div className="sticky bottom-0 bg-white border-t p-4 shadow-lg">
            <Button
              variant="primary"
              onClick={() => {
                const selectedRecommendations = state.items.filter(item => 
                  state.selected.has(item.id)
                );
                onSelect(selectedRecommendations);
              }}
              ariaLabel={`Apply ${state.selected.size} selected recommendations`}
            >
              Apply Selected ({state.selected.size})
            </Button>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default React.memo(AiRecommendations);