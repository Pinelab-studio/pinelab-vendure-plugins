import { LanguageCode } from '@vendure/core';

export interface LocalizedString {
  languageCode: LanguageCode;
  value: string;
}

export interface ContentFieldDefinition {
  name: string;
  type: string;
  label?: LocalizedString[];
  entity?: unknown;
}

export interface ContentTypeDefinition {
  code: string;
  displayName: LocalizedString[];
  allowMultiple: boolean;
  fields: ContentFieldDefinition[];
}

export interface SimpleCmsPluginOptions {
  contentTypes: ContentTypeDefinition[];
}
