import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { useVirtual } from 'react-virtual'; // ^2.10.4
import clsx from 'clsx'; // ^2.0.0
import { Campaign, CampaignStatus, PlatformType } from '../../types/campaigns';
import CampaignCard from './CampaignCard';
import { useCampaign } from '../../hooks/useCampaign';

// Constants for responsive grid layout
const GRID_COLS = {
  sm: 1,
  md: 2,
  lg: 3,
  xl: 4
};

const GRID_GAP = 16; // 1rem
const CARD_HEIGHT = 280; // Base card height in pixels

interface CampaignListProps {
  campaigns: Campaign[];
  loading: boolean;
  selectedIds: string[];
  onSelect: (id: string) => void;
  onBulkSelect: (ids: string[]) => void;
  className?: string;
  filterOptions: FilterOptions;
  sortOptions: SortOptions;
  viewMode: ViewMode;
}

interface FilterOptions {
  platforms: PlatformType[];
  statuses: CampaignStatus[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
  searchQuery: string;
  budgetRange: {
    min: number;
    max: number;
  };
}

interface SortOptions {
  field: 'name' | 'status' | 'budget' | 'metrics.ctr' | 'metrics.conversions';
  direction: 'asc' | 'desc';
}

type ViewMode = 'grid' | 'list';

const CampaignList: React.FC<CampaignListProps> = ({
  campaigns,
  loading,
  selectedIds,
  onSelect,
  onBulkSelect,
  className,
  filterOptions,
  sortOptions,
  viewMode
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { updateCampaign } = useCampaign();

  // Filter campaigns based on all criteria
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(campaign => {
      const matchesPlatform = filterOptions.platforms.length === 0 || 
        filterOptions.platforms.includes(campaign.platformType);
      
      const matchesStatus = filterOptions.statuses.length === 0 || 
        filterOptions.statuses.includes(campaign.status);
      
      const matchesDateRange = !filterOptions.dateRange.startDate || 
        (new Date(campaign.dateRange.startDate) >= new Date(filterOptions.dateRange.startDate) &&
         new Date(campaign.dateRange.endDate) <= new Date(filterOptions.dateRange.endDate));
      
      const matchesBudget = !filterOptions.budgetRange.min || 
        (campaign.totalBudget >= filterOptions.budgetRange.min &&
         campaign.totalBudget <= filterOptions.budgetRange.max);
      
      const matchesSearch = !filterOptions.searchQuery || 
        campaign.name.toLowerCase().includes(filterOptions.searchQuery.toLowerCase());

      return matchesPlatform && matchesStatus && matchesDateRange && 
             matchesBudget && matchesSearch;
    }).sort((a, b) => {
      const getValue = (campaign: Campaign, field: string) => {
        return field.split('.').reduce((obj, key) => obj?.[key], campaign);
      };

      const aValue = getValue(a, sortOptions.field);
      const bValue = getValue(b, sortOptions.field);

      return sortOptions.direction === 'asc' 
        ? aValue > bValue ? 1 : -1
        : aValue < bValue ? 1 : -1;
    });
  }, [campaigns, filterOptions, sortOptions]);

  // Calculate grid dimensions based on container width
  const getGridDimensions = useCallback(() => {
    if (!containerRef.current) return { columns: GRID_COLS.sm, width: 0 };
    
    const containerWidth = containerRef.current.offsetWidth;
    let columns = GRID_COLS.sm;

    if (containerWidth >= 1536) columns = GRID_COLS.xl;
    else if (containerWidth >= 1200) columns = GRID_COLS.lg;
    else if (containerWidth >= 900) columns = GRID_COLS.md;

    return { columns, width: containerWidth };
  }, []);

  // Set up virtualization
  const { columns, width } = getGridDimensions();
  const rowCount = Math.ceil(filteredCampaigns.length / columns);
  
  const rowVirtualizer = useVirtual({
    size: rowCount,
    parentRef: containerRef,
    estimateSize: useCallback(() => CARD_HEIGHT + GRID_GAP, []),
    overscan: 5
  });

  // Handle window resize
  useEffect(() => {
    const handleResize = () => rowVirtualizer.measure();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [rowVirtualizer]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent, campaignId: string) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        onSelect(campaignId);
        break;
      case 'ArrowRight':
        event.preventDefault();
        const nextElement = document.querySelector(`[data-campaign-id="${campaignId}"]`)
          ?.nextElementSibling;
        if (nextElement) {
          (nextElement as HTMLElement).focus();
        }
        break;
      case 'ArrowLeft':
        event.preventDefault();
        const prevElement = document.querySelector(`[data-campaign-id="${campaignId}"]`)
          ?.previousElementSibling;
        if (prevElement) {
          (prevElement as HTMLElement).focus();
        }
        break;
    }
  }, [onSelect]);

  return (
    <div
      ref={containerRef}
      className={clsx(
        'relative w-full h-full overflow-auto',
        loading && 'opacity-50 pointer-events-none',
        className
      )}
      role="grid"
      aria-busy={loading}
      aria-label="Campaign list"
    >
      {filteredCampaigns.length === 0 ? (
        <div className="flex items-center justify-center h-full p-8 text-gray-500">
          {loading ? 'Loading campaigns...' : 'No campaigns found'}
        </div>
      ) : (
        <div
          className={clsx(
            'grid gap-4',
            viewMode === 'grid' && {
              'grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4': true
            },
            viewMode === 'list' && 'grid-cols-1'
          )}
          style={{
            height: `${rowVirtualizer.totalSize}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {rowVirtualizer.virtualItems.map(virtualRow => {
            const rowStartIndex = virtualRow.index * columns;
            const rowCampaigns = filteredCampaigns.slice(
              rowStartIndex,
              rowStartIndex + columns
            );

            return (
              <div
                key={virtualRow.index}
                className={clsx(
                  'grid gap-4',
                  viewMode === 'grid' && `grid-cols-${columns}`,
                  viewMode === 'list' && 'grid-cols-1'
                )}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${CARD_HEIGHT}px`,
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                {rowCampaigns.map(campaign => (
                  <CampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    isSelected={selectedIds.includes(campaign.id)}
                    onSelect={onSelect}
                    isLoading={loading}
                    className="h-full"
                    data-campaign-id={campaign.id}
                    tabIndex={0}
                    onKeyDown={(e) => handleKeyDown(e, campaign.id)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CampaignList;