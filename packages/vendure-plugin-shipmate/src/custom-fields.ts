import {
  CustomFieldConfig,
  LanguageCode,
  PermissionDefinition,
} from '@vendure/core';

export const shipmatePermission = new PermissionDefinition({
  name: 'SetShipmateConfig',
  description: 'Allows setting Shipmate configurations',
});

declare module '@vendure/core' {
  interface CustomChannelFields {
    shipmateApiKey?: string;
    shipmateUsername?: string;
    shipmatePassword?: string;
    shipmateWebhookAuthTokens?: string[];
  }
}

const uiTab = 'Shipmate';

/**
 * Per-channel Shipmate configuration, stored as Channel custom fields.
 * Vendure renders these on the Channel detail page under the "Shipmate" tab.
 * Shipmate is considered enabled for a channel once apiKey, username and password are set.
 */
export const channelCustomFields: CustomFieldConfig[] = [
  {
    name: 'shipmateApiKey',
    type: 'string',
    public: false,
    nullable: true,
    label: [{ languageCode: LanguageCode.en, value: 'API key' }],
    requiresPermission: shipmatePermission.Permission,
    ui: { tab: uiTab, component: 'password-form-input' },
  },
  {
    name: 'shipmateUsername',
    type: 'string',
    public: false,
    nullable: true,
    label: [{ languageCode: LanguageCode.en, value: 'Username' }],
    requiresPermission: shipmatePermission.Permission,
    ui: { tab: uiTab },
  },
  {
    name: 'shipmatePassword',
    type: 'string',
    public: false,
    nullable: true,
    label: [{ languageCode: LanguageCode.en, value: 'Password' }],
    requiresPermission: shipmatePermission.Permission,
    ui: { tab: uiTab, component: 'password-form-input' },
  },
  {
    name: 'shipmateWebhookAuthTokens',
    type: 'string',
    list: true,
    public: false,
    nullable: true,
    label: [{ languageCode: LanguageCode.en, value: 'Webhook auth tokens' }],
    description: [
      {
        languageCode: LanguageCode.en,
        value:
          'Auth tokens used by Shipmate to authenticate incoming webhooks for this channel',
      },
    ],
    requiresPermission: shipmatePermission.Permission,
    ui: { tab: uiTab },
  },
];
