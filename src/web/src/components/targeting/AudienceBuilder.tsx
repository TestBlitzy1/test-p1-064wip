import React, { useState, useEffect, useCallback, useMemo } from 'react'; // ^18.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import debounce from 'lodash/debounce'; // ^4.17.21

import { useTargeting } from '../../hooks/useTargeting';
import { useAnalytics } from '../../hooks/useAnalytics';
import Button from '../common/Button';
import type {
  AudienceSegment,
  TargetingRule,
  Platform,
  RuleType,
  ValidationRule,
  TargetingRecommendation
} from '../../types/targeting';

interface AudienceBuilderProps {
  platform: Platform;
  initialSegment?: AudienceSegment;
  onSave: (segment: AudienceSegment) => Promise<void>;
  onCancel: () => void;
  onError?: (error: Error) => void;
}

const VALIDATION_DEBOUNCE = 300; // ms
const MIN_RULES = 1;
const MAX_RULES = 20;

const AudienceBuilder: React.FC<AudienceBuilderProps> = ({
  platform,
  initialSegment,
  onSave,
  onCancel,
  onError
}) => {
  // Hooks
  const {
    segments,
    createSegment,
    updateSegment,
    validateRules,
    platformConstraints,
    performanceMetrics
  } = useTargeting(platform, {
    enableCache: true,
    validateOnChange: true,
    optimizationEnabled: true
  });

  const { trackEvent } = useAnalytics();

  // State
  const [segment, setSegment] = useState<AudienceSegment>(
    initialSegment || {
      id: '',
      name: '',
      description: '',
      platform,
      targetingRules: [],
      estimatedReach: 0,
      confidence: 0,
      createdAt: '',
      updatedAt: '',
      metadata: {}
    }
  );

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Memoized platform-specific constraints
  const constraints = useMemo(() => {
    return platformConstraints?.[platform] || {
      maxRules: MAX_RULES,
      supportedRuleTypes: [],
      minReach: 0,
      maxReach: 0,
      ruleSpecificConstraints: {}
    };
  }, [platform, platformConstraints]);

  // Debounced validation
  const debouncedValidate = useCallback(
    debounce(async (rules: TargetingRule[]) => {
      setIsValidating(true);
      try {
        const isValid = await validateRules(rules);
        if (!isValid) {
          setValidationErrors({
            rules: 'Invalid targeting rules configuration'
          });
        } else {
          setValidationErrors({});
        }
      } catch (error) {
        setValidationErrors({
          validation: error instanceof Error ? error.message : 'Validation failed'
        });
        onError?.(error as Error);
      } finally {
        setIsValidating(false);
      }
    }, VALIDATION_DEBOUNCE),
    [validateRules, onError]
  );

  // Effect for rule validation
  useEffect(() => {
    if (segment.targetingRules.length) {
      debouncedValidate(segment.targetingRules);
    }
    return () => {
      debouncedValidate.cancel();
    };
  }, [segment.targetingRules, debouncedValidate]);

  // Handlers
  const handleRuleChange = useCallback((index: number, rule: TargetingRule) => {
    setSegment(prev => ({
      ...prev,
      targetingRules: prev.targetingRules.map((r, i) => 
        i === index ? rule : r
      )
    }));

    trackEvent({
      category: 'Targeting',
      action: 'RuleModified',
      label: rule.ruleType
    });
  }, [trackEvent]);

  const handleAddRule = useCallback(() => {
    if (segment.targetingRules.length >= constraints.maxRules) {
      setValidationErrors(prev => ({
        ...prev,
        rules: `Maximum of ${constraints.maxRules} rules allowed`
      }));
      return;
    }

    setSegment(prev => ({
      ...prev,
      targetingRules: [
        ...prev.targetingRules,
        {
          id: crypto.randomUUID(),
          ruleType: constraints.supportedRuleTypes[0],
          operator: 'include',
          criteria: {},
          weight: 1,
          isActive: true
        }
      ]
    }));

    trackEvent({
      category: 'Targeting',
      action: 'RuleAdded'
    });
  }, [segment.targetingRules.length, constraints, trackEvent]);

  const handleRemoveRule = useCallback((index: number) => {
    setSegment(prev => ({
      ...prev,
      targetingRules: prev.targetingRules.filter((_, i) => i !== index)
    }));

    trackEvent({
      category: 'Targeting',
      action: 'RuleRemoved'
    });
  }, [trackEvent]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // Final validation before save
      const isValid = await validateRules(segment.targetingRules);
      if (!isValid) {
        throw new Error('Invalid targeting configuration');
      }

      if (segment.id) {
        await updateSegment(segment.id, segment);
      } else {
        await createSegment(segment);
      }

      trackEvent({
        category: 'Targeting',
        action: 'SegmentSaved',
        value: segment.targetingRules.length
      });

      await onSave(segment);
    } catch (error) {
      setValidationErrors({
        save: error instanceof Error ? error.message : 'Failed to save segment'
      });
      onError?.(error as Error);
    } finally {
      setIsSaving(false);
    }
  }, [segment, validateRules, updateSegment, createSegment, onSave, onError, trackEvent]);

  // Render helpers
  const renderValidationErrors = () => {
    if (Object.keys(validationErrors).length === 0) return null;

    return (
      <div
        role="alert"
        aria-live="polite"
        className="bg-red-50 border border-red-200 rounded-md p-4 mt-4"
      >
        <ul className="list-disc pl-4">
          {Object.entries(validationErrors).map(([key, error]) => (
            <li key={key} className="text-red-700">
              {error}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div role="alert" className="text-red-600">
          <p>Error building audience: {error.message}</p>
          <Button
            variant="secondary"
            onClick={resetErrorBoundary}
            ariaLabel="Reset audience builder"
          >
            Reset
          </Button>
        </div>
      )}
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            {segment.id ? 'Edit Audience Segment' : 'Create Audience Segment'}
          </h2>
          <div className="space-x-4">
            <Button
              variant="outline"
              onClick={onCancel}
              ariaLabel="Cancel audience building"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              isLoading={isSaving}
              isDisabled={
                isValidating ||
                Object.keys(validationErrors).length > 0 ||
                segment.targetingRules.length < MIN_RULES
              }
              ariaLabel="Save audience segment"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Targeting Rules Section */}
        <section aria-labelledby="targeting-rules-heading">
          <h3 id="targeting-rules-heading" className="text-lg font-medium mb-4">
            Targeting Rules
          </h3>
          
          <div className="space-y-4">
            {segment.targetingRules.map((rule, index) => (
              <div
                key={rule.id}
                className="border rounded-lg p-4"
                role="group"
                aria-label={`Targeting rule ${index + 1}`}
              >
                {/* Rule configuration UI */}
                {/* Implementation details omitted for brevity */}
                <Button
                  variant="text"
                  onClick={() => handleRemoveRule(index)}
                  ariaLabel={`Remove rule ${index + 1}`}
                >
                  Remove
                </Button>
              </div>
            ))}

            <Button
              variant="outline"
              onClick={handleAddRule}
              isDisabled={segment.targetingRules.length >= constraints.maxRules}
              ariaLabel="Add targeting rule"
            >
              Add Rule
            </Button>
          </div>
        </section>

        {/* Validation Feedback */}
        {renderValidationErrors()}

        {/* Performance Metrics */}
        {performanceMetrics && (
          <div className="mt-4 text-sm text-gray-600">
            <p>Validation time: {performanceMetrics.validationTime}ms</p>
            <p>Estimated reach: {segment.estimatedReach.toLocaleString()}</p>
            <p>Confidence score: {(segment.confidence * 100).toFixed(1)}%</p>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default AudienceBuilder;