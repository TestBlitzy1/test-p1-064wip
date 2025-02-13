import React, { useState, useCallback, useEffect } from 'react'; // v18.0.0
import clsx from 'clsx'; // v2.0.0
import { Campaign, PlatformType } from '../../types/campaigns';
import Card from '../common/Card';
import { useCampaign } from '../../hooks/useCampaign';
import { themeConfig } from '../../config/theme.config';

// Preview mode types
type PreviewMode = 'basic' | 'detailed';
type ValidationState = 'valid' | 'warning' | 'error';
type PreviewTab = 'overview' | 'targeting' | 'budget' | 'validation';

interface CampaignPreviewProps {
  campaignId: string;
  onEdit?: () => void;
  onDeploy?: () => void;
  previewMode?: PreviewMode;
}

const CampaignPreview: React.FC<CampaignPreviewProps> = ({
  campaignId,
  onEdit,
  onDeploy,
  previewMode = 'detailed'
}) => {
  // State management
  const [activeTab, setActiveTab] = useState<PreviewTab>('overview');
  const [validationState, setValidationState] = useState<ValidationState>('valid');
  const { campaign, loading } = useCampaign({ initialCampaign: null });

  // Format budget with proper currency and locale
  const formatBudget = useCallback((amount: number, locale = 'en-US'): string => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }, []);

  // Format reach numbers with appropriate suffixes
  const formatReach = useCallback((reach: number): string => {
    if (reach >= 1000000) {
      return `${(reach / 1000000).toFixed(1)}M`;
    }
    if (reach >= 1000) {
      return `${(reach / 1000).toFixed(1)}K`;
    }
    return reach.toString();
  }, []);

  // Platform-specific icon component
  const PlatformIcon: React.FC<{ type: PlatformType }> = ({ type }) => {
    const iconClass = clsx(
      'w-6 h-6',
      'inline-flex items-center justify-center',
      'rounded-full',
      {
        'bg-blue-100 text-blue-600': type === 'LINKEDIN',
        'bg-red-100 text-red-600': type === 'GOOGLE',
        'bg-purple-100 text-purple-600': type === 'BOTH'
      }
    );

    return (
      <div className={iconClass}>
        {type === 'LINKEDIN' && 'Li'}
        {type === 'GOOGLE' && 'G'}
        {type === 'BOTH' && 'All'}
      </div>
    );
  };

  // Validation effect
  useEffect(() => {
    if (campaign) {
      const validateCampaign = (): ValidationState => {
        if (!campaign.targetingSettings.industries.length) return 'error';
        if (!campaign.targetingSettings.locations.length) return 'error';
        if (campaign.totalBudget <= 0) return 'error';
        if (campaign.estimatedReach < 1000) return 'warning';
        return 'valid';
      };

      setValidationState(validateCampaign());
    }
  }, [campaign]);

  if (loading.status === 'loading') {
    return (
      <Card className="animate-pulse">
        <div className="h-48 bg-gray-100 rounded-lg" />
      </Card>
    );
  }

  if (!campaign) {
    return (
      <Card className="p-4 text-center text-gray-500">
        Campaign preview not available
      </Card>
    );
  }

  return (
    <Card
      variant="elevated"
      elevation="medium"
      className="overflow-hidden"
      header={
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <PlatformIcon type={campaign.platformType} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {campaign.name}
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 
                         dark:text-gray-400 dark:hover:text-gray-100"
              >
                Edit
              </button>
            )}
            {onDeploy && validationState === 'valid' && (
              <button
                onClick={onDeploy}
                className="px-4 py-1 text-sm text-white bg-primary-600 
                         hover:bg-primary-700 rounded-md transition-colors"
              >
                Deploy
              </button>
            )}
          </div>
        </div>
      }
    >
      {/* Preview tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex -mb-px">
          {(['overview', 'targeting', 'budget', 'validation'] as PreviewTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'px-4 py-2 text-sm font-medium',
                'border-b-2 transition-colors',
                activeTab === tab
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="p-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-sm text-gray-500">Total Budget</div>
                <div className="text-xl font-semibold">
                  {formatBudget(campaign.totalBudget)}
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-sm text-gray-500">Estimated Reach</div>
                <div className="text-xl font-semibold">
                  {formatReach(campaign.estimatedReach)}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'targeting' && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Industries
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {campaign.targetingSettings.industries.map((industry) => (
                  <span
                    key={industry.id}
                    className="px-2 py-1 text-xs bg-white dark:bg-gray-700 
                             rounded-full border border-gray-200 dark:border-gray-600"
                  >
                    {industry.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Locations
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {campaign.targetingSettings.locations.map((location, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs bg-white dark:bg-gray-700 
                             rounded-full border border-gray-200 dark:border-gray-600"
                  >
                    {location.country}
                    {location.region && `, ${location.region}`}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'budget' && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Budget Allocation
              </h3>
              <div className="mt-4">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500"
                    style={{ width: `${(campaign.totalBudget / 10000) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'validation' && (
          <div className="space-y-4">
            <div
              className={clsx(
                'p-4 rounded-lg',
                {
                  'bg-green-50 text-green-800': validationState === 'valid',
                  'bg-yellow-50 text-yellow-800': validationState === 'warning',
                  'bg-red-50 text-red-800': validationState === 'error'
                }
              )}
            >
              <h3 className="font-medium">Validation Status</h3>
              <p className="mt-1 text-sm">
                {validationState === 'valid' && 'Campaign is ready for deployment'}
                {validationState === 'warning' && 'Campaign may have suboptimal performance'}
                {validationState === 'error' && 'Campaign requires additional configuration'}
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default CampaignPreview;