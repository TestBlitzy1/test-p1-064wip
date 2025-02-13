'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form'; // ^7.0.0
import { useQuery, useMutation } from '@tanstack/react-query'; // ^4.0.0
import * as yup from 'yup'; // ^1.0.0
import CryptoJS from 'crypto-js'; // ^4.1.1

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import useAuth from '../../hooks/useAuth';
import { Permission } from '../../types/auth';
import { PlatformSettings, NotificationSettings } from '../../types/settings';

// Validation schemas
const platformSettingsSchema = yup.object().shape({
  linkedInApiKey: yup.string().required('LinkedIn API key is required'),
  googleAdsApiKey: yup.string().required('Google Ads API key is required'),
  defaultCurrency: yup.string().required('Default currency is required'),
  timeZone: yup.string().required('Time zone is required')
});

const notificationSettingsSchema = yup.object().shape({
  emailAlerts: yup.boolean(),
  performanceAlerts: yup.boolean(),
  budgetAlerts: yup.boolean(),
  alertFrequency: yup.array().of(yup.string()),
  alertThresholds: yup.object(),
  notificationChannels: yup.array().of(yup.string())
});

const SettingsPage: React.FC = () => {
  const { user, validatePermissions } = useAuth();
  const canManageSettings = validatePermissions([Permission.MANAGE_SETTINGS]);

  // Platform settings form
  const {
    register: registerPlatform,
    handleSubmit: handlePlatformSubmit,
    formState: { errors: platformErrors }
  } = useForm<PlatformSettings>({
    defaultValues: {
      defaultCurrency: 'USD',
      timeZone: 'UTC'
    }
  });

  // Notification settings form
  const {
    register: registerNotifications,
    handleSubmit: handleNotificationSubmit,
    formState: { errors: notificationErrors }
  } = useForm<NotificationSettings>();

  // Fetch current settings
  const { data: currentSettings } = useQuery(
    ['settings'],
    async () => {
      const response = await fetch('/api/settings');
      return response.json();
    },
    {
      enabled: canManageSettings
    }
  );

  // Platform settings mutation
  const platformMutation = useMutation(
    async (settings: PlatformSettings) => {
      // Encrypt sensitive data
      const encryptedLinkedInKey = CryptoJS.AES.encrypt(
        settings.linkedInApiKey,
        process.env.NEXT_PUBLIC_ENCRYPTION_KEY || ''
      ).toString();

      const encryptedGoogleKey = CryptoJS.AES.encrypt(
        settings.googleAdsApiKey,
        process.env.NEXT_PUBLIC_ENCRYPTION_KEY || ''
      ).toString();

      const payload = {
        ...settings,
        linkedInApiKey: encryptedLinkedInKey,
        googleAdsApiKey: encryptedGoogleKey,
        updatedBy: user?.id
      };

      const response = await fetch('/api/settings/platform', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to update platform settings');
      }

      return response.json();
    }
  );

  // Notification settings mutation
  const notificationMutation = useMutation(
    async (settings: NotificationSettings) => {
      const response = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          updatedBy: user?.id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update notification settings');
      }

      return response.json();
    }
  );

  // Handle platform settings submission
  const onPlatformSubmit = async (data: PlatformSettings) => {
    try {
      await platformMutation.mutateAsync(data);
    } catch (error) {
      console.error('Platform settings update failed:', error);
    }
  };

  // Handle notification settings submission
  const onNotificationSubmit = async (data: NotificationSettings) => {
    try {
      await notificationMutation.mutateAsync(data);
    } catch (error) {
      console.error('Notification settings update failed:', error);
    }
  };

  if (!canManageSettings) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-red-600">
          Access Denied - Insufficient Permissions
        </h1>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Platform Settings</h1>

      {/* Platform Integration Settings */}
      <Card
        variant="default"
        className="mb-8"
        header={<h2 className="text-xl font-semibold">Platform Integration</h2>}
      >
        <form onSubmit={handlePlatformSubmit(onPlatformSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                LinkedIn API Key
              </label>
              <input
                type="password"
                {...registerPlatform('linkedInApiKey')}
                className="w-full p-2 border rounded-md"
                aria-invalid={!!platformErrors.linkedInApiKey}
              />
              {platformErrors.linkedInApiKey && (
                <p className="text-red-500 text-sm mt-1">
                  {platformErrors.linkedInApiKey.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Google Ads API Key
              </label>
              <input
                type="password"
                {...registerPlatform('googleAdsApiKey')}
                className="w-full p-2 border rounded-md"
                aria-invalid={!!platformErrors.googleAdsApiKey}
              />
              {platformErrors.googleAdsApiKey && (
                <p className="text-red-500 text-sm mt-1">
                  {platformErrors.googleAdsApiKey.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Default Currency
                </label>
                <select
                  {...registerPlatform('defaultCurrency')}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Time Zone
                </label>
                <select
                  {...registerPlatform('timeZone')}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="UTC">UTC</option>
                  <option value="EST">EST</option>
                  <option value="PST">PST</option>
                </select>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            isLoading={platformMutation.isLoading}
            className="w-full"
          >
            Save Platform Settings
          </Button>
        </form>
      </Card>

      {/* Notification Settings */}
      <Card
        variant="default"
        header={<h2 className="text-xl font-semibold">Notification Preferences</h2>}
      >
        <form onSubmit={handleNotificationSubmit(onNotificationSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                {...registerNotifications('emailAlerts')}
                id="emailAlerts"
              />
              <label htmlFor="emailAlerts" className="text-sm font-medium">
                Email Alerts
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                {...registerNotifications('performanceAlerts')}
                id="performanceAlerts"
              />
              <label htmlFor="performanceAlerts" className="text-sm font-medium">
                Performance Alerts
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                {...registerNotifications('budgetAlerts')}
                id="budgetAlerts"
              />
              <label htmlFor="budgetAlerts" className="text-sm font-medium">
                Budget Alerts
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Alert Frequency
              </label>
              <select
                {...registerNotifications('alertFrequency')}
                className="w-full p-2 border rounded-md"
                multiple
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            isLoading={notificationMutation.isLoading}
            className="w-full"
          >
            Save Notification Settings
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default SettingsPage;