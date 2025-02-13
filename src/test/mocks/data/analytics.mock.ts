import { CampaignMetrics, PerformanceData } from '../../web/src/types/analytics';
import { BaseResponse, DateRange } from '../../web/src/types/common';

// Mock campaign IDs for consistent test data
const MOCK_CAMPAIGN_IDS = ['camp_001', 'camp_002', 'camp_003', 'camp_004', 'camp_005'];

// Supported ad platforms
const MOCK_PLATFORMS = ['linkedin', 'google'] as const;

// Platform-specific CTR ranges based on industry benchmarks
const PLATFORM_CTR_RANGES = {
  linkedin: { min: 0.01, max: 0.05 }, // 1-5% CTR for LinkedIn
  google: { min: 0.02, max: 0.07 }    // 2-7% CTR for Google
};

// Platform-specific conversion rate ranges
const PLATFORM_CONVERSION_RATES = {
  linkedin: { min: 0.02, max: 0.08 }, // 2-8% conversion rate for LinkedIn
  google: { min: 0.03, max: 0.10 }    // 3-10% conversion rate for Google
};

/**
 * Generates deterministic random number within a range using campaign ID as seed
 * @param min Minimum value
 * @param max Maximum value
 * @param seed Seed value for consistent randomization
 */
const seededRandom = (min: number, max: number, seed: string): number => {
  const hash = seed.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  const random = Math.sin(hash) * 10000;
  return min + (random - Math.floor(random)) * (max - min);
};

/**
 * Generates realistic mock campaign metrics with platform-specific variations
 * @param campaign_id Campaign identifier
 * @param platform Ad platform (linkedin/google)
 */
const generateMockMetrics = (campaign_id: string, platform: typeof MOCK_PLATFORMS[number]): CampaignMetrics => {
  // Generate base impressions (1,000 - 100,000)
  const baseImpressions = Math.floor(seededRandom(1000, 100000, campaign_id));
  
  // Calculate platform-specific CTR
  const ctrRange = PLATFORM_CTR_RANGES[platform];
  const ctr = seededRandom(ctrRange.min, ctrRange.max, `${campaign_id}_ctr`);
  
  // Calculate clicks based on impressions and CTR
  const clicks = Math.floor(baseImpressions * ctr);
  
  // Calculate conversions using platform-specific rates
  const conversionRange = PLATFORM_CONVERSION_RATES[platform];
  const conversionRate = seededRandom(conversionRange.min, conversionRange.max, `${campaign_id}_conv`);
  const conversions = Math.floor(clicks * conversionRate);
  
  // Calculate spend based on industry average CPC ($1-5)
  const avgCpc = seededRandom(1, 5, `${campaign_id}_cpc`);
  const spend = Math.floor(clicks * avgCpc);
  
  // Calculate revenue with ROAS between 2-5x
  const roas = seededRandom(2, 5, `${campaign_id}_roas`);
  const revenue = Math.floor(spend * roas);
  
  return {
    impressions: baseImpressions,
    clicks,
    conversions,
    spend,
    revenue
  };
};

/**
 * Generates historical performance data with realistic trends
 * @param campaign_id Campaign identifier
 * @param platform Ad platform
 * @param dateRange Date range for data generation
 */
const generateMockPerformanceData = (
  campaign_id: string,
  platform: typeof MOCK_PLATFORMS[number],
  dateRange: DateRange
): PerformanceData => {
  const startDate = new Date(dateRange.startDate);
  const endDate = new Date(dateRange.endDate);
  const dailyMetrics: CampaignMetrics[] = [];
  
  // Generate daily metrics
  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay();
    const monthDay = date.getDate();
    
    // Base metrics for the day
    const baseMetrics = generateMockMetrics(campaign_id, platform);
    
    // Apply weekly patterns (weekday vs weekend variation)
    const weekendMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 0.7 : 1;
    
    // Apply monthly patterns (beginning/end of month variation)
    const monthlyMultiplier = monthDay <= 5 || monthDay >= 25 ? 1.2 : 1;
    
    // Apply seasonal variations
    const month = date.getMonth();
    const seasonalMultiplier = 1 + Math.sin(month * Math.PI / 6) * 0.2; // ±20% seasonal variation
    
    // Combine all variations
    const dailyMultiplier = weekendMultiplier * monthlyMultiplier * seasonalMultiplier;
    
    dailyMetrics.push({
      impressions: Math.floor(baseMetrics.impressions * dailyMultiplier),
      clicks: Math.floor(baseMetrics.clicks * dailyMultiplier),
      conversions: Math.floor(baseMetrics.conversions * dailyMultiplier),
      spend: Math.floor(baseMetrics.spend * dailyMultiplier),
      revenue: Math.floor(baseMetrics.revenue * dailyMultiplier)
    });
  }
  
  // Aggregate weekly metrics
  const weeklyMetrics = aggregateMetrics(dailyMetrics, 7);
  
  // Aggregate monthly metrics
  const monthlyMetrics = aggregateMetrics(dailyMetrics, 30);
  
  return {
    daily_metrics: dailyMetrics,
    weekly_metrics: weeklyMetrics,
    monthly_metrics: monthlyMetrics
  };
};

/**
 * Aggregates metrics into larger time periods
 * @param metrics Array of daily metrics
 * @param periodDays Number of days in period (7 for weekly, 30 for monthly)
 */
const aggregateMetrics = (metrics: CampaignMetrics[], periodDays: number): CampaignMetrics[] => {
  const aggregated: CampaignMetrics[] = [];
  
  for (let i = 0; i < metrics.length; i += periodDays) {
    const periodMetrics = metrics.slice(i, i + periodDays);
    
    aggregated.push({
      impressions: periodMetrics.reduce((sum, m) => sum + m.impressions, 0),
      clicks: periodMetrics.reduce((sum, m) => sum + m.clicks, 0),
      conversions: periodMetrics.reduce((sum, m) => sum + m.conversions, 0),
      spend: periodMetrics.reduce((sum, m) => sum + m.spend, 0),
      revenue: periodMetrics.reduce((sum, m) => sum + m.revenue, 0)
    });
  }
  
  return aggregated;
};

// Export mock data generators
export const mockCampaignMetrics = {
  generateMockMetrics
};

export const mockPerformanceData = {
  generateMockPerformanceData
};

// Export mock API response
export const mockAnalyticsResponse = <T>(data: T): BaseResponse<T> => ({
  data,
  status: 200,
  message: 'Success'
});