import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Select from '../common/Select';
import useTargeting from '../../hooks/useTargeting';
import { TargetingRule, AudienceSegment, Platform } from '../../types/targeting';

// Form validation schema with platform-specific rules
const targetingFormSchema = z.object({
  industry: z.array(z.string()).min(1, 'Select at least one industry'),
  companySize: z.array(z.string()).min(1, 'Select at least one company size'),
  jobTitles: z.array(z.string()).min(1, 'Select at least one job title'),
  location: z.array(z.string()).min(1, 'Select at least one location'),
  includeSubsidiaries: z.boolean().optional(),
  excludedAudiences: z.array(z.string()).optional(),
  customAudiences: z.array(z.string()).optional()
});

interface TargetingFormProps {
  platform: Platform;
  initialValues?: Partial<AudienceSegment>;
  onSubmit: (data: AudienceSegment) => Promise<void>;
  onCancel: () => void;
}

export const TargetingForm: React.FC<TargetingFormProps> = ({
  platform,
  initialValues,
  onSubmit,
  onCancel
}) => {
  // State and hooks
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<TargetingRule[]>([]);
  const [estimatedReach, setEstimatedReach] = useState<number>(0);

  const {
    segments,
    platformConstraints,
    validateRules,
    performanceMetrics,
    aiInsights,
    error: targetingError
  } = useTargeting(platform, {
    enableCache: true,
    validateOnChange: true,
    optimizationEnabled: true
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid, isDirty }
  } = useForm({
    defaultValues: initialValues,
    mode: 'onChange'
  });

  // Watch form values for AI suggestions
  const formValues = watch();

  // Handle rule changes with debounced AI suggestions
  const handleRuleChange = useCallback(async (rule: TargetingRule, index: number) => {
    try {
      setIsProcessing(true);
      
      // Validate rule against platform constraints
      const isValid = await validateRules([rule]);
      
      if (isValid) {
        // Update form state
        setValue(`targetingRules.${index}`, rule, {
          shouldValidate: true,
          shouldDirty: true
        });

        // Update estimated reach
        if (aiInsights?.estimatedReach) {
          setEstimatedReach(aiInsights.estimatedReach);
        }

        // Update AI suggestions
        if (aiInsights?.recommendations) {
          setAiSuggestions(aiInsights.recommendations);
        }
      }
    } catch (error) {
      console.error('Error updating targeting rule:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [validateRules, setValue, aiInsights]);

  // Handle form submission
  const handleFormSubmit = async (data: any) => {
    try {
      setIsProcessing(true);

      // Transform form data to targeting rules
      const targetingRules: TargetingRule[] = [
        {
          id: crypto.randomUUID(),
          ruleType: 'industry',
          operator: 'include',
          criteria: {
            industries: data.industry,
            includeSubsidiaries: data.includeSubsidiaries
          },
          weight: 1,
          isActive: true
        },
        {
          id: crypto.randomUUID(),
          ruleType: 'company_size',
          operator: 'include',
          criteria: {
            sizes: data.companySize
          },
          weight: 1,
          isActive: true
        },
        {
          id: crypto.randomUUID(),
          ruleType: 'job_title',
          operator: 'include',
          criteria: {
            titles: data.jobTitles
          },
          weight: 1,
          isActive: true
        },
        {
          id: crypto.randomUUID(),
          ruleType: 'location',
          operator: 'include',
          criteria: {
            locations: data.location
          },
          weight: 1,
          isActive: true
        }
      ];

      // Validate all rules
      const isValid = await validateRules(targetingRules);

      if (!isValid) {
        throw new Error('Invalid targeting rules');
      }

      // Create audience segment
      const segment: AudienceSegment = {
        id: initialValues?.id || crypto.randomUUID(),
        name: data.name || 'New Segment',
        description: data.description || '',
        platform,
        targetingRules,
        estimatedReach,
        confidence: aiInsights?.confidence || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          lastOptimized: new Date().toISOString(),
          performanceScore: performanceMetrics?.optimizationScore || 0
        }
      };

      await onSubmit(segment);
    } catch (error) {
      console.error('Error submitting targeting form:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Update suggestions when form values change
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (isDirty && isValid) {
        handleRuleChange(formValues as TargetingRule, 0);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [formValues, isDirty, isValid, handleRuleChange]);

  return (
    <form 
      onSubmit={handleSubmit(handleFormSubmit)}
      className="targeting-form"
      aria-label="Audience Targeting Form"
    >
      {/* Industry Selection */}
      <div className="form-group">
        <label htmlFor="industry" className="form-label">
          Industry
          {platformConstraints?.industry?.requiresSubsidiaryFlag && (
            <span className="required-indicator">*</span>
          )}
        </label>
        <Select
          id="industry"
          multiple
          value={formValues.industry}
          options={segments?.map(s => ({
            value: s.id,
            label: s.name
          })) || []}
          onChange={(value) => setValue('industry', value)}
          error={!!errors.industry}
          aria-describedby="industry-error"
          required
        />
        {errors.industry && (
          <span id="industry-error" className="error-message">
            {errors.industry.message}
          </span>
        )}
      </div>

      {/* Company Size Selection */}
      <div className="form-group">
        <label htmlFor="companySize" className="form-label">
          Company Size
        </label>
        <Select
          id="companySize"
          multiple
          value={formValues.companySize}
          options={platformConstraints?.companySize?.ranges?.map(range => ({
            value: `${range.min}-${range.max}`,
            label: `${range.min}+ employees`
          })) || []}
          onChange={(value) => setValue('companySize', value)}
          error={!!errors.companySize}
          aria-describedby="company-size-error"
          required
        />
        {errors.companySize && (
          <span id="company-size-error" className="error-message">
            {errors.companySize.message}
          </span>
        )}
      </div>

      {/* Job Titles Selection */}
      <div className="form-group">
        <label htmlFor="jobTitles" className="form-label">
          Job Titles
        </label>
        <Select
          id="jobTitles"
          multiple
          value={formValues.jobTitles}
          options={platformConstraints?.jobTitles?.map(title => ({
            value: title,
            label: title
          })) || []}
          onChange={(value) => setValue('jobTitles', value)}
          error={!!errors.jobTitles}
          aria-describedby="job-titles-error"
          required
        />
        {errors.jobTitles && (
          <span id="job-titles-error" className="error-message">
            {errors.jobTitles.message}
          </span>
        )}
      </div>

      {/* Location Selection */}
      <div className="form-group">
        <label htmlFor="location" className="form-label">
          Location
        </label>
        <Select
          id="location"
          multiple
          value={formValues.location}
          options={platformConstraints?.location?.countries?.map(country => ({
            value: country,
            label: country
          })) || []}
          onChange={(value) => setValue('location', value)}
          error={!!errors.location}
          aria-describedby="location-error"
          required
        />
        {errors.location && (
          <span id="location-error" className="error-message">
            {errors.location.message}
          </span>
        )}
      </div>

      {/* AI Suggestions */}
      {aiSuggestions.length > 0 && (
        <div className="ai-suggestions" role="complementary">
          <h3>AI-Powered Recommendations</h3>
          <ul>
            {aiSuggestions.map((suggestion, index) => (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => handleRuleChange(suggestion, index)}
                  className="suggestion-button"
                >
                  Apply Suggestion
                </button>
                <span>{suggestion.criteria.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Estimated Reach */}
      <div className="estimated-reach" role="status">
        <strong>Estimated Reach:</strong> {estimatedReach.toLocaleString()} users
        <div className="confidence-score">
          Confidence Score: {aiInsights?.confidence || 0}%
        </div>
      </div>

      {/* Error Messages */}
      {targetingError && (
        <div className="error-container" role="alert">
          {targetingError}
        </div>
      )}

      {/* Form Actions */}
      <div className="form-actions">
        <button
          type="button"
          onClick={onCancel}
          className="cancel-button"
          disabled={isProcessing}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="submit-button"
          disabled={!isValid || isProcessing}
          aria-busy={isProcessing}
        >
          {isProcessing ? 'Processing...' : 'Save Targeting'}
        </button>
      </div>
    </form>
  );
};

export default TargetingForm;