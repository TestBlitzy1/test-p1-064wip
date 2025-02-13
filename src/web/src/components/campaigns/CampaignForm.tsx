import React, { useCallback, useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { debounce } from 'lodash';
import { Campaign, PlatformType, TargetingSettings } from '../../types/campaigns';
import { useCampaign } from '../../hooks/useCampaign';
import LoadingSpinner from '../common/LoadingSpinner';

// Form validation schema
const campaignSchema = z.object({
  name: z.string().min(3).max(100),
  platformType: z.enum(['LINKEDIN', 'GOOGLE', 'BOTH']),
  totalBudget: z.number().min(1),
  dateRange: z.object({
    startDate: z.string(),
    endDate: z.string()
  }),
  targetingSettings: z.object({
    industries: z.array(z.object({
      id: z.string(),
      name: z.string()
    })).min(1),
    locations: z.array(z.object({
      country: z.string(),
      region: z.string().optional(),
      city: z.string().optional()
    })).min(1),
    jobFunctions: z.array(z.object({
      id: z.string(),
      title: z.string(),
      seniority: z.array(z.string())
    })),
    companySizes: z.array(z.object({
      min: z.number(),
      max: z.number().nullable(),
      label: z.string()
    }))
  })
});

export interface CampaignFormProps {
  initialValues?: Partial<Campaign>;
  onSubmit: (campaign: Campaign) => Promise<void>;
  onCancel: () => void;
  onProgressUpdate: (progress: number) => void;
}

const CampaignForm: React.FC<CampaignFormProps> = ({
  initialValues,
  onSubmit,
  onCancel,
  onProgressUpdate
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const { createCampaign, updateCampaign, generateCampaignStructure } = useCampaign();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<Campaign>({
    defaultValues: initialValues,
    mode: 'onChange'
  });

  const platformType = watch('platformType');
  const targetingSettings = watch('targetingSettings');

  // Debounced AI recommendations generator
  const generateAIRecommendations = useCallback(
    debounce(async (formData: Partial<Campaign>) => {
      if (!formData.platformType || !formData.targetingSettings) return;

      try {
        setIsGenerating(true);
        const generatedCampaign = await generateCampaignStructure({
          platformType: formData.platformType,
          targetingSettings: formData.targetingSettings,
          budget: formData.totalBudget || 0
        });

        // Update form with AI recommendations
        setValue('adFormats', generatedCampaign.adFormats);
        setValue('platformSettings', generatedCampaign.platformSettings);
        
        setIsGenerating(false);
      } catch (error) {
        console.error('Error generating AI recommendations:', error);
        setIsGenerating(false);
      }
    }, 500),
    [generateCampaignStructure, setValue]
  );

  // Watch for changes that trigger AI recommendations
  useEffect(() => {
    if (platformType && targetingSettings) {
      generateAIRecommendations({
        platformType,
        targetingSettings,
        totalBudget: watch('totalBudget')
      });
    }
  }, [platformType, targetingSettings, generateAIRecommendations, watch]);

  // Form submission handler
  const onFormSubmit = async (data: Campaign) => {
    try {
      const validatedData = campaignSchema.parse(data);
      const campaign = initialValues?.id
        ? await updateCampaign(initialValues.id, validatedData)
        : await createCampaign(validatedData);
      
      await onSubmit(campaign);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {/* Campaign Basic Information */}
      <div className="space-y-4">
        <Controller
          name="name"
          control={control}
          rules={{ required: 'Campaign name is required' }}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Campaign Name
              </label>
              <input
                type="text"
                {...field}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>
          )}
        />

        <Controller
          name="platformType"
          control={control}
          rules={{ required: 'Platform selection is required' }}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Platform
              </label>
              <select
                {...field}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">Select Platform</option>
                <option value="LINKEDIN">LinkedIn Ads</option>
                <option value="GOOGLE">Google Ads</option>
                <option value="BOTH">Both Platforms</option>
              </select>
              {errors.platformType && (
                <p className="mt-1 text-sm text-red-600">{errors.platformType.message}</p>
              )}
            </div>
          )}
        />

        <Controller
          name="totalBudget"
          control={control}
          rules={{ required: 'Budget is required', min: 1 }}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Total Budget
              </label>
              <input
                type="number"
                {...field}
                min="1"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
              {errors.totalBudget && (
                <p className="mt-1 text-sm text-red-600">{errors.totalBudget.message}</p>
              )}
            </div>
          )}
        />
      </div>

      {/* Targeting Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Targeting Settings</h3>
        
        {/* Industries */}
        <Controller
          name="targetingSettings.industries"
          control={control}
          rules={{ required: 'At least one industry is required' }}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Industries
              </label>
              {/* Industry selection component would go here */}
            </div>
          )}
        />

        {/* Locations */}
        <Controller
          name="targetingSettings.locations"
          control={control}
          rules={{ required: 'At least one location is required' }}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Locations
              </label>
              {/* Location selection component would go here */}
            </div>
          )}
        />
      </div>

      {/* AI Generation Status */}
      {isGenerating && (
        <div className="flex items-center space-x-2">
          <LoadingSpinner size="small" />
          <span className="text-sm text-gray-600">
            Generating AI recommendations...
          </span>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || isGenerating}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
        >
          {isSubmitting ? (
            <LoadingSpinner size="small" color="white" />
          ) : (
            initialValues?.id ? 'Update Campaign' : 'Create Campaign'
          )}
        </button>
      </div>
    </form>
  );
};

export default CampaignForm;