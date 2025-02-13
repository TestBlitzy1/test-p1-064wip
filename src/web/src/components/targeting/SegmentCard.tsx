import React from 'react'; // v18.0.0
import clsx from 'clsx'; // v2.0.0
import Card from '../common/Card';
import { useTargeting } from '../../hooks/useTargeting';
import { 
  AudienceSegment, 
  TargetingRule, 
  ValidationStatus, 
  OptimizationHint 
} from '../../types/targeting';

interface SegmentCardProps {
  segment: AudienceSegment;
  isSelected: boolean;
  onSelect: (segment: AudienceSegment) => void;
  onEdit: (segment: AudienceSegment) => void;
  onDelete: (segmentId: string) => void;
  validationStatus: ValidationStatus;
  optimizationHints: OptimizationHint[];
  performanceMetrics: {
    reach: number;
    engagement: number;
    conversion: number;
  };
  className?: string;
}

const formatReachNumber = (reach: number): string => {
  if (reach >= 1_000_000_000) {
    return `${(reach / 1_000_000_000).toFixed(1)}B`;
  }
  if (reach >= 1_000_000) {
    return `${(reach / 1_000_000).toFixed(1)}M`;
  }
  if (reach >= 1_000) {
    return `${(reach / 1_000).toFixed(1)}K`;
  }
  return reach.toString();
};

const SegmentCard: React.FC<SegmentCardProps> = ({
  segment,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  validationStatus,
  optimizationHints,
  performanceMetrics,
  className
}) => {
  const { validateRules, platformConstraints } = useTargeting();

  // Card header content
  const headerContent = (
    <div className="flex justify-between items-center">
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {segment.name}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {segment.description}
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onEdit(segment)}
          className="p-2 text-gray-600 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
          aria-label="Edit segment"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          onClick={() => onDelete(segment.id)}
          className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
          aria-label="Delete segment"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );

  // Validation status indicator
  const validationIndicator = (
    <div className={clsx(
      'flex items-center space-x-2 text-sm',
      {
        'text-green-600 dark:text-green-400': validationStatus.isValid,
        'text-yellow-600 dark:text-yellow-400': !validationStatus.isValid && validationStatus.warnings.length > 0,
        'text-red-600 dark:text-red-400': !validationStatus.isValid && validationStatus.errors.length > 0
      }
    )}>
      <span className="w-2 h-2 rounded-full bg-current" />
      <span>
        {validationStatus.isValid ? 'Valid' : 
         validationStatus.errors.length > 0 ? 'Invalid' : 'Warnings'}
      </span>
    </div>
  );

  // Performance metrics display
  const metricsDisplay = (
    <div className="grid grid-cols-3 gap-4 mt-4">
      <div className="text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">Reach</p>
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {formatReachNumber(performanceMetrics.reach)}
        </p>
      </div>
      <div className="text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">Engagement</p>
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {performanceMetrics.engagement.toFixed(1)}%
        </p>
      </div>
      <div className="text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">Conversion</p>
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {performanceMetrics.conversion.toFixed(1)}%
        </p>
      </div>
    </div>
  );

  // Optimization hints display
  const optimizationDisplay = optimizationHints.length > 0 && (
    <div className="mt-4 space-y-2">
      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
        Optimization Suggestions
      </h4>
      <ul className="space-y-1">
        {optimizationHints.map((hint, index) => (
          <li
            key={index}
            className="text-sm text-gray-600 dark:text-gray-400 flex items-start space-x-2"
          >
            <svg className="w-4 h-4 text-primary-600 dark:text-primary-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>{hint.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <Card
      variant={isSelected ? 'outlined' : 'default'}
      interactive
      elevation={isSelected ? 'medium' : 'low'}
      className={clsx(
        'transition-all duration-200',
        isSelected && 'ring-2 ring-primary-500 dark:ring-primary-400',
        className
      )}
      onClick={() => onSelect(segment)}
      header={headerContent}
      footer={validationIndicator}
      aria-selected={isSelected}
      role="article"
      aria-label={`Audience segment: ${segment.name}`}
    >
      <div className="space-y-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p>Platform: {segment.platform}</p>
          <p>Rules: {segment.targetingRules.length}</p>
        </div>
        {metricsDisplay}
        {optimizationDisplay}
      </div>
    </Card>
  );
};

export default SegmentCard;