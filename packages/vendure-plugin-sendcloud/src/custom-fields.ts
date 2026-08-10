import {
  CustomFieldConfig,
  LanguageCode,
  PermissionDefinition,
} from '@vendure/core';

export const sendcloudPermission = new PermissionDefinition({
  name: 'SetSendCloudConfig',
  description: 'Allows setting SendCloud configuration',
});

declare module '@vendure/core' {
  interface CustomChannelFields {
    sendcloudSecret?: string;
    sendcloudPublicKey?: string;
    sendcloudDefaultPhoneNr?: string;
  }
}

const uiTab = 'SendCloud';

/**
 * Per-channel SendCloud configuration, stored as Channel custom fields.
 * Vendure renders these on the Channel detail page under the "SendCloud" tab.
 * SendCloud is considered enabled for a channel once both secret and publicKey are set.
 */
export const channelCustomFields: CustomFieldConfig[] = [
  {
    name: 'sendcloudSecret',
    type: 'string',
    public: false,
    nullable: true,
    label: [{ languageCode: LanguageCode.en, value: 'Secret' }],
    requiresPermission: sendcloudPermission.Permission,
    ui: { tab: uiTab, component: 'password-form-input' },
  },
  {
    name: 'sendcloudPublicKey',
    type: 'string',
    public: false,
    nullable: true,
    label: [{ languageCode: LanguageCode.en, value: 'Public key' }],
    requiresPermission: sendcloudPermission.Permission,
    ui: { tab: uiTab, component: 'password-form-input' },
  },
  {
    name: 'sendcloudDefaultPhoneNr',
    type: 'string',
    public: false,
    nullable: true,
    label: [{ languageCode: LanguageCode.en, value: 'Default phone number' }],
    requiresPermission: sendcloudPermission.Permission,
    ui: { tab: uiTab },
  },
];
