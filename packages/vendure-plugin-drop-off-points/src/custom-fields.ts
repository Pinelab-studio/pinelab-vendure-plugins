import { CustomFieldConfig, LanguageCode } from '@vendure/core';

const uiTab = 'Drop Off Point';

export const customOrderFields: CustomFieldConfig[] = [
  {
    name: 'dropOffPointCarrier',
    type: 'string',
    label: [{ value: 'Drop Off Point Carrier', languageCode: LanguageCode.en }],
    ui: { tab: uiTab },
  },
  {
    name: 'dropOffPointId',
    type: 'string',
    label: [{ value: 'Drop Off Point Id', languageCode: LanguageCode.en }],
    ui: { tab: uiTab },
  },
  {
    name: 'dropOffPointName',
    type: 'string',
    label: [{ value: 'Drop Off Point Name', languageCode: LanguageCode.en }],
    ui: { tab: uiTab },
  },
  {
    name: 'dropOffPointStreetLine1',
    type: 'string',
    label: [
      { value: 'Drop Off Point Street Line 1', languageCode: LanguageCode.en },
    ],
    ui: { tab: uiTab },
  },
  {
    name: 'dropOffPointStreetLine2',
    type: 'string',
    label: [
      { value: 'Drop Off Point Street Line 2', languageCode: LanguageCode.en },
    ],
    ui: { tab: uiTab },
  },
  {
    name: 'dropOffPointHouseNumber',
    type: 'string',
    label: [
      { value: 'Drop Off Point House Number', languageCode: LanguageCode.en },
    ],
    ui: { tab: uiTab },
  },
  {
    name: 'dropOffPointHouseNumberSuffix',
    type: 'string',
    label: [
      {
        value: 'Drop Off Point House Number Suffix',
        languageCode: LanguageCode.en,
      },
    ],
    ui: { tab: uiTab },
  },
  {
    name: 'dropOffPointPostalCode',
    type: 'string',
    label: [
      { value: 'Drop Off Point Postal Code', languageCode: LanguageCode.en },
    ],
    ui: { tab: uiTab },
  },
  {
    name: 'dropOffPointCity',
    type: 'string',
    label: [{ value: 'Drop Off Point City', languageCode: LanguageCode.en }],
    ui: { tab: uiTab },
  },
  {
    name: 'dropOffPointCountry',
    type: 'string',
    label: [{ value: 'Drop Off Point Country', languageCode: LanguageCode.en }],
    ui: { tab: uiTab },
  },
];
