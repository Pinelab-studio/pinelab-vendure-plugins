import {
  CustomFieldConfig,
  LanguageCode,
  PermissionDefinition,
} from '@vendure/core';

export const myparcelPermission = new PermissionDefinition({
  name: 'SetMyparcelConfig',
  description: 'Allows setting MyParcel configurations',
});

declare module '@vendure/core' {
  interface CustomChannelFields {
    myparcelEnabled?: boolean;
    myparcelApiKey?: string;
  }
}

const uiTab = 'MyParcel';

/**
 * Per-channel MyParcel configuration, stored as Channel custom fields.
 * Vendure renders these on the Channel detail page under the "MyParcel" tab.
 */
export const channelCustomFields: CustomFieldConfig[] = [
  {
    name: 'myparcelEnabled',
    type: 'boolean',
    public: false,
    defaultValue: false,
    label: [{ languageCode: LanguageCode.en, value: 'Enabled' }],
    description: [
      {
        languageCode: LanguageCode.en,
        value: 'Enable MyParcel for this channel',
      },
    ],
    requiresPermission: myparcelPermission.Permission,
    ui: { tab: uiTab },
  },
  {
    name: 'myparcelApiKey',
    type: 'string',
    public: false,
    nullable: true,
    label: [{ languageCode: LanguageCode.en, value: 'API key' }],
    description: [
      { languageCode: LanguageCode.en, value: 'Your MyParcel API key' },
    ],
    requiresPermission: myparcelPermission.Permission,
    ui: { tab: uiTab, component: 'password-form-input' },
  },
];
