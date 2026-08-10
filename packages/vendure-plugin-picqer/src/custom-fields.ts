import {
  CustomFieldConfig,
  LanguageCode,
  PermissionDefinition,
} from '@vendure/core';

export const picqerPermission = new PermissionDefinition({
  name: 'Picqer',
  description: 'Allows setting Picqer config and triggering Picqer full sync',
});

declare module '@vendure/core' {
  interface CustomChannelFields {
    picqerEnabled?: boolean;
    picqerApiKey?: string;
    picqerApiEndpoint?: string;
    picqerStorefrontUrl?: string;
    picqerSupportEmail?: string;
  }
}

const uiTab = 'Picqer';

/**
 * Per-channel Picqer configuration, stored as Channel custom fields.
 * Vendure renders these on the Channel detail page under the "Picqer" tab.
 */
export const channelCustomFields: CustomFieldConfig[] = [
  {
    name: 'picqerEnabled',
    type: 'boolean',
    public: false,
    defaultValue: false,
    label: [{ languageCode: LanguageCode.en, value: 'Enabled' }],
    requiresPermission: picqerPermission.Permission,
    ui: { tab: uiTab },
  },
  {
    name: 'picqerApiKey',
    type: 'string',
    public: false,
    nullable: true,
    label: [{ languageCode: LanguageCode.en, value: 'API key' }],
    requiresPermission: picqerPermission.Permission,
    ui: { tab: uiTab, component: 'password-form-input' },
  },
  {
    name: 'picqerApiEndpoint',
    type: 'string',
    public: false,
    nullable: true,
    label: [{ languageCode: LanguageCode.en, value: 'API endpoint' }],
    description: [
      {
        languageCode: LanguageCode.en,
        value: "Your Picqer domain, without the '/api/v1/' path",
      },
    ],
    requiresPermission: picqerPermission.Permission,
    ui: { tab: uiTab },
  },
  {
    name: 'picqerStorefrontUrl',
    type: 'string',
    public: false,
    nullable: true,
    label: [{ languageCode: LanguageCode.en, value: 'Storefront URL' }],
    description: [
      {
        languageCode: LanguageCode.en,
        value:
          'Picqer requires you to register your storefront URL for API usage',
      },
    ],
    requiresPermission: picqerPermission.Permission,
    ui: { tab: uiTab },
  },
  {
    name: 'picqerSupportEmail',
    type: 'string',
    public: false,
    nullable: true,
    label: [{ languageCode: LanguageCode.en, value: 'Support email address' }],
    description: [
      {
        languageCode: LanguageCode.en,
        value:
          'Picqer requires you to register a support email address for API usage',
      },
    ],
    requiresPermission: picqerPermission.Permission,
    ui: { tab: uiTab },
  },
];
