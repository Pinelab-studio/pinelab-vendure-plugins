import {
  CustomFieldConfig,
  LanguageCode,
  PermissionDefinition,
} from '@vendure/core';

export const eBoekhoudenPermission = new PermissionDefinition({
  name: 'eBoekhouden',
  description: 'Allows enabling e-Boekhouden plugin',
});

declare module '@vendure/core' {
  interface CustomChannelFields {
    eBoekhoudenEnabled?: boolean;
    eBoekhoudenUsername?: string;
    eBoekhoudenSecret1?: string;
    eBoekhoudenSecret2?: string;
    eBoekhoudenAccount?: string;
    eBoekhoudenContraAccount?: string;
  }
}

const uiTab = 'E-boekhouden';

/**
 * Per-channel e-Boekhouden configuration, stored as Channel custom fields.
 * Vendure renders these on the Channel detail page under the "E-boekhouden" tab.
 */
export const channelCustomFields: CustomFieldConfig[] = [
  {
    name: 'eBoekhoudenEnabled',
    type: 'boolean',
    public: false,
    defaultValue: false,
    label: [{ languageCode: LanguageCode.en, value: 'Enabled' }],
    requiresPermission: eBoekhoudenPermission.Permission,
    ui: { tab: uiTab },
  },
  {
    name: 'eBoekhoudenUsername',
    type: 'string',
    public: false,
    nullable: true,
    label: [{ languageCode: LanguageCode.en, value: 'Username' }],
    requiresPermission: eBoekhoudenPermission.Permission,
    ui: { tab: uiTab },
  },
  {
    name: 'eBoekhoudenSecret1',
    type: 'string',
    public: false,
    nullable: true,
    label: [{ languageCode: LanguageCode.en, value: 'Security code 1' }],
    requiresPermission: eBoekhoudenPermission.Permission,
    ui: { tab: uiTab, component: 'password-form-input' },
  },
  {
    name: 'eBoekhoudenSecret2',
    type: 'string',
    public: false,
    nullable: true,
    label: [{ languageCode: LanguageCode.en, value: 'Security code 2' }],
    requiresPermission: eBoekhoudenPermission.Permission,
    ui: { tab: uiTab, component: 'password-form-input' },
  },
  {
    name: 'eBoekhoudenAccount',
    type: 'string',
    public: false,
    nullable: true,
    label: [{ languageCode: LanguageCode.en, value: 'Account' }],
    requiresPermission: eBoekhoudenPermission.Permission,
    ui: { tab: uiTab },
  },
  {
    name: 'eBoekhoudenContraAccount',
    type: 'string',
    public: false,
    nullable: true,
    label: [{ languageCode: LanguageCode.en, value: 'Contra account' }],
    requiresPermission: eBoekhoudenPermission.Permission,
    ui: { tab: uiTab },
  },
];
