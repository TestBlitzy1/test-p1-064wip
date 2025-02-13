import { BaseSchema } from '../../backend/common/schemas/base';
import { jest } from 'jest';
import type { MockInstance } from '@types/jest';

// Mock CRM data with privacy fields
const MOCK_CRM_DATA: Record<string, any>[] = [
  {
    id: '1',
    name: 'Acme Corp',
    email: 'contact@acme.com',
    gdprConsent: true,
    ccpaConsent: true,
    privacySettings: {
      allowDataSharing: true,
      dataRetentionDays: 365,
      marketingConsent: true
    },
    lastUpdated: new Date().toISOString()
  }
];

// Mock contact data with privacy flags
const MOCK_CONTACT_DATA: Record<string, any>[] = [
  {
    id: '1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@acme.com',
    privacyConsent: {
      marketing: true,
      dataSharing: true,
      thirdParty: false
    },
    gdprStatus: 'consented',
    ccpaStatus: 'consented'
  }
];

// Configurable response delays
const MOCK_RESPONSE_DELAYS = {
  connect: 500,
  query: 300,
  update: 400
};

/**
 * Mock CRM Service implementation with privacy compliance
 * @version 1.0.0
 */
export class MockCRMService {
  private isConnected: boolean = false;
  private mockData: Record<string, any>[] = MOCK_CRM_DATA;
  private privacySettings: Record<string, any>;
  private responseDelays: Record<string, number>;

  constructor(
    config: Record<string, any>,
    privacyConfig: Record<string, any>
  ) {
    this.privacySettings = {
      enableGDPR: true,
      enableCCPA: true,
      dataRetentionDays: 365,
      ...privacyConfig
    };
    this.responseDelays = { ...MOCK_RESPONSE_DELAYS, ...config.delays };
  }

  /**
   * Simulates CRM connection with authentication
   */
  public async connect(credentials: Record<string, any>): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, this.responseDelays.connect));
    
    if (credentials.apiKey && credentials.apiKey.length > 0) {
      this.isConnected = true;
      return true;
    }
    return false;
  }

  /**
   * Privacy-aware contact query simulation
   */
  public async queryContacts(
    queryParams: Record<string, any>,
    privacyContext: Record<string, any>
  ): Promise<Record<string, any>[]> {
    if (!this.isConnected) {
      throw new Error('CRM connection not established');
    }

    await new Promise(resolve => setTimeout(resolve, this.responseDelays.query));

    return MOCK_CONTACT_DATA.filter(contact => {
      // Apply privacy filters
      if (this.privacySettings.enableGDPR && privacyContext.region === 'EU') {
        if (contact.gdprStatus !== 'consented') return false;
      }
      if (this.privacySettings.enableCCPA && privacyContext.region === 'California') {
        if (contact.ccpaStatus !== 'consented') return false;
      }

      // Apply business filters
      return Object.entries(queryParams).every(([key, value]) => 
        contact[key] === value
      );
    });
  }
}

/**
 * Mocks CRM customer data retrieval with privacy compliance checks
 */
export const mockGetCustomerData = jest.fn(async (
  customerId: string,
  privacySettings: Record<string, any>
): Promise<Record<string, any>> => {
  const customer = MOCK_CRM_DATA.find(c => c.id === customerId);
  
  if (!customer) {
    throw new Error('Customer not found');
  }

  // Validate privacy compliance
  if (privacySettings.requireGDPR && !customer.gdprConsent) {
    throw new Error('GDPR consent not provided');
  }
  if (privacySettings.requireCCPA && !customer.ccpaConsent) {
    throw new Error('CCPA consent not provided');
  }

  // Filter sensitive data based on privacy settings
  const filteredData = { ...customer };
  if (!customer.privacySettings.allowDataSharing) {
    delete filteredData.email;
  }

  await new Promise(resolve => 
    setTimeout(resolve, MOCK_RESPONSE_DELAYS.query)
  );

  return filteredData;
});

/**
 * Mocks retrieval of contact lists with privacy controls
 */
export const mockGetContactList = jest.fn(async (
  filters: Record<string, any>,
  privacyConfig: Record<string, any>
): Promise<Record<string, any>[]> => {
  await new Promise(resolve => 
    setTimeout(resolve, MOCK_RESPONSE_DELAYS.query)
  );

  return MOCK_CONTACT_DATA.filter(contact => {
    // Privacy compliance checks
    if (privacyConfig.checkGDPR && !contact.privacyConsent.marketing) {
      return false;
    }
    if (privacyConfig.checkCCPA && !contact.privacyConsent.dataSharing) {
      return false;
    }

    // Apply business filters
    return Object.entries(filters).every(([key, value]) => 
      contact[key] === value
    );
  }).map(contact => {
    // Mask data based on privacy settings
    const masked = { ...contact };
    if (!contact.privacyConsent.thirdParty) {
      masked.email = '[REDACTED]';
      masked.lastName = '[REDACTED]';
    }
    return masked;
  });
});