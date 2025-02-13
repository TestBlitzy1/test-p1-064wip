import React, { useCallback, useMemo } from 'react';
import clsx from 'clsx';
import { useRouter } from 'next/router';
import { Campaign, CampaignStatus, PlatformType } from '../../types/campaigns';
import Card from '../common/Card';
import { useCampaign } from '../../hooks/useCampaign';

// Interface for component props
interface CampaignCardProps {
  campaign: Campaign;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  className?: string;
  isLoading?: boolean;
}

// Status color mapping with dark mode support
const getStatusColor = (status: CampaignStatus): string => {
  const colors: Record<CampaignStatus, string> = {
    DRAFT: 'text-gray-500 dark:text-gray-400',
    ACTIVE: 'text-green-500 dark:text-green-400',
    PAUSED: 'text-yellow-500 dark:text-yellow-400',
    COMPLETED: 'text-blue-500 dark:text-blue-400',
    ARCHIVED: 'text-red-500 dark:text-red-400'
  };
  return colors[status] || colors.DRAFT;
};

// Format budget with proper currency display
const formatBudget = (budget: number, locale = 'en-US'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(budget);
};

// Platform icon mapping
const PlatformIcon: React.FC<{ type: PlatformType }> = ({ type }) => {
  const iconClass = clsx(
    'w-5 h-5 inline-block mr-2',
    type === 'LINKEDIN' && 'text-blue-600 dark:text-blue-400',
    type === 'GOOGLE' && 'text-red-500 dark:text-red-400',
    type === 'BOTH' && 'text-purple-500 dark:text-purple-400'
  );

  return (
    <span className={iconClass} role="img" aria-label={`${type} campaign`}>
      {type === 'LINKEDIN' && '🔗'}
      {type === 'GOOGLE' && '🔍'}
      {type === 'BOTH' && '🌐'}
    </span>
  );
};

const CampaignCard: React.FC<CampaignCardProps> = ({
  campaign,
  isSelected = false,
  onSelect,
  className,
  isLoading = false
}) => {
  const router = useRouter();
  const { updateCampaign } = useCampaign();

  // Memoized status color
  const statusColor = useMemo(() => getStatusColor(campaign.status), [campaign.status]);

  // Format campaign metrics
  const metrics = useMemo(() => ({
    ctr: campaign.metrics?.ctr ? `${(campaign.metrics.ctr * 100).toFixed(1)}%` : 'N/A',
    conversions: campaign.metrics?.conversions?.toLocaleString() || 'N/A',
    cpc: campaign.metrics?.cpc ? formatBudget(campaign.metrics.cpc) : 'N/A'
  }), [campaign.metrics]);

  // Handle card click
  const handleClick = useCallback(() => {
    if (isLoading) return;
    if (onSelect) {
      onSelect(campaign.id);
    } else {
      router.push(`/campaigns/${campaign.id}`);
    }
  }, [campaign.id, isLoading, onSelect, router]);

  // Handle status toggle
  const handleStatusToggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoading || campaign.status === 'COMPLETED' || campaign.status === 'ARCHIVED') return;

    const newStatus: CampaignStatus = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await updateCampaign(campaign.id, { status: newStatus });
    } catch (error) {
      console.error('Failed to update campaign status:', error);
    }
  }, [campaign.id, campaign.status, isLoading, updateCampaign]);

  return (
    <Card
      variant="default"
      elevation="low"
      interactive
      className={clsx(
        'transition-all duration-200',
        isSelected && 'ring-2 ring-primary-500 dark:ring-primary-400',
        isLoading && 'opacity-70 cursor-wait',
        className
      )}
      onClick={handleClick}
      aria-label={`Campaign: ${campaign.name}`}
      aria-selected={isSelected}
      aria-busy={isLoading}
      role="article"
    >
      <div className="flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <PlatformIcon type={campaign.platformType} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {campaign.name}
            </h3>
          </div>
          <button
            onClick={handleStatusToggle}
            disabled={isLoading || campaign.status === 'COMPLETED' || campaign.status === 'ARCHIVED'}
            className={clsx(
              'px-3 py-1 rounded-full text-sm font-medium transition-colors',
              statusColor,
              'hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
            )}
            aria-label={`Toggle campaign status: currently ${campaign.status}`}
          >
            {campaign.status}
          </button>
        </div>

        {/* Budget and Date Range */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 dark:text-gray-400">Budget</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {formatBudget(campaign.totalBudget)}
            </p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">Duration</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {new Date(campaign.dateRange.startDate).toLocaleDateString()} -{' '}
              {new Date(campaign.dateRange.endDate).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">CTR</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">{metrics.ctr}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Conversions</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">{metrics.conversions}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">CPC</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">{metrics.cpc}</p>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default CampaignCard;