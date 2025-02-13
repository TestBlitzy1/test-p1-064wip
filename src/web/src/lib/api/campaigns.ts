import { AxiosRequestConfig } from 'axios'; // ^1.6.0
import { Campaign, PlatformType, CampaignStatus, TargetingSettings } from '../../types/campaigns';
import { ApiResponse } from '../../types/api';
import { apiClient } from '../../utils/api-client';
import { UUID } from 'crypto';

// API Constants
const CAMPAIGNS_API_PATH = '/api/v1/campaigns';
const DEFAULT_PAGE_SIZE = 10;
const API_TIMEOUT = 30000; // 30 seconds SLA requirement
const MAX_RETRIES = 3;

// Performance monitoring decorator
function performanceMonitor() {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args: any[]) {
            const startTime = performance.now();
            try {
                const result = await originalMethod.apply(this, args);
                const processingTime = performance.now() - startTime;
                
                // Add processing time to response metadata
                if (result && typeof result === 'object') {
                    result.metadata = {
                        ...result.metadata,
                        processingTime
                    };
                }
                return result;
            } catch (error) {
                console.error(`Performance monitoring error in ${propertyKey}:`, error);
                throw error;
            }
        };
        return descriptor;
    };
}

// Rate limiter decorator
function rateLimiter(config: { maxRequests: number; windowMs: number }) {
    const requests = new Map<string, number[]>();
    
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args: any[]) {
            const now = Date.now();
            const key = `${propertyKey}`;
            
            // Clean old requests
            const timestamps = (requests.get(key) || []).filter(
                time => now - time < config.windowMs
            );
            
            if (timestamps.length >= config.maxRequests) {
                throw new Error('Rate limit exceeded. Please try again later.');
            }
            
            timestamps.push(now);
            requests.set(key, timestamps);
            
            return originalMethod.apply(this, args);
        };
        return descriptor;
    };
}

/**
 * Retrieves a paginated list of campaigns with optional filters and caching
 */
export async function getCampaigns(params: {
    page?: number;
    pageSize?: number;
    status?: CampaignStatus;
    platformType?: PlatformType;
    useCache?: boolean;
}): Promise<ApiResponse<{ campaigns: Campaign[]; total: number; metadata: { processingTime: number } }>> {
    const {
        page = 1,
        pageSize = DEFAULT_PAGE_SIZE,
        status,
        platformType,
        useCache = true
    } = params;

    const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(status && { status }),
        ...(platformType && { platformType })
    });

    const config: AxiosRequestConfig = {
        timeout: API_TIMEOUT,
        params: queryParams,
        headers: {
            'Cache-Control': useCache ? 'max-age=60' : 'no-cache'
        }
    };

    try {
        const response = await apiClient.get<{
            campaigns: Campaign[];
            total: number;
            metadata: { processingTime: number };
        }>(`${CAMPAIGNS_API_PATH}?${queryParams.toString()}`, config);

        return response;
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        throw error;
    }
}

/**
 * Generates AI-powered campaign structure with performance monitoring
 */
@performanceMonitor()
@rateLimiter({ maxRequests: 10, windowMs: 60000 })
export async function generateCampaignStructure(params: {
    platformType: PlatformType;
    targetingSettings: TargetingSettings;
    budget: number;
    template?: UUID;
}): Promise<ApiResponse<Campaign>> {
    const { platformType, targetingSettings, budget, template } = params;

    // Validate input parameters
    if (budget <= 0) {
        throw new Error('Budget must be greater than 0');
    }

    if (!targetingSettings.industries?.length || !targetingSettings.locations?.length) {
        throw new Error('Targeting settings must include industries and locations');
    }

    const config: AxiosRequestConfig = {
        timeout: API_TIMEOUT,
        headers: {
            'X-Processing-Priority': 'high'
        }
    };

    try {
        const response = await apiClient.post<Campaign>(
            `${CAMPAIGNS_API_PATH}/generate`,
            {
                platformType,
                targetingSettings,
                budget,
                ...(template && { templateId: template })
            },
            config
        );

        // Validate processing time against 30-second SLA
        if (response.metadata?.processingTime > API_TIMEOUT) {
            console.warn('Campaign generation exceeded SLA threshold');
        }

        return response;
    } catch (error) {
        console.error('Error generating campaign structure:', error);
        throw error;
    }
}

/**
 * Updates an existing campaign with validation
 */
export async function updateCampaign(
    campaignId: UUID,
    updates: Partial<Campaign>
): Promise<ApiResponse<Campaign>> {
    if (!campaignId) {
        throw new Error('Campaign ID is required');
    }

    try {
        const response = await apiClient.put<Campaign>(
            `${CAMPAIGNS_API_PATH}/${campaignId}`,
            updates,
            {
                timeout: API_TIMEOUT
            }
        );

        return response;
    } catch (error) {
        console.error('Error updating campaign:', error);
        throw error;
    }
}

/**
 * Deletes a campaign with confirmation
 */
export async function deleteCampaign(
    campaignId: UUID
): Promise<ApiResponse<void>> {
    if (!campaignId) {
        throw new Error('Campaign ID is required');
    }

    try {
        const response = await apiClient.delete<void>(
            `${CAMPAIGNS_API_PATH}/${campaignId}`,
            {
                timeout: API_TIMEOUT
            }
        );

        return response;
    } catch (error) {
        console.error('Error deleting campaign:', error);
        throw error;
    }
}