import { RequestContext } from '@vendure/core';
import { ContentEntry } from '../entities/content-entry.entity';
import { SimpleCmsPluginOptions, TypeDefinition } from '../types';
import { toGraphQLTypeName } from './api-extensions';

function mapFieldDefinition(field: TypeDefinition['fields'][number]) {
  return {
    name: field.name,
    type: field.type,
    nullable: field.nullable === true,
    isTranslatable: field.type !== 'relation' ? field.isTranslatable : false,
    uiComponent: 'uiComponent' in field ? field.uiComponent ?? null : null,
    fields:
      field.type === 'struct'
        ? field.fields.map((sub) => ({
            name: sub.name,
            type: sub.type,
            nullable: sub.nullable === true,
            isTranslatable: sub.isTranslatable,
            uiComponent: sub.uiComponent ?? null,
            fields: null,
          }))
        : null,
  };
}

/**
 * Spreads the JSON `fields` column onto the entity, adds `__typename`
 * for union resolution, resolves translatable fields for the current
 * request language, and includes admin-only computed fields.
 */
export function flattenEntry(
  ctx: RequestContext,
  entity: ContentEntry,
  options: SimpleCmsPluginOptions
): Record<string, unknown> {
  const typeDef = options.contentTypes[entity.contentTypeCode];
  const typeName = typeDef
    ? toGraphQLTypeName(entity.contentTypeCode)
    : 'AdminContentEntry';
  const translations = (entity.translatableFields ?? []).map((t) => ({
    ...t,
    ...(t.fields ?? {}),
  }));
  // Resolve translatable fields for the current request language
  const currentTranslation =
    translations.find((t) => t.languageCode === ctx.languageCode) ??
    translations[0];
  const translatedFields = currentTranslation?.fields
    ? { ...currentTranslation.fields }
    : {};
  return {
    ...entity,
    ...(entity.fields ?? {}),
    ...translatedFields,
    translations,
    __typename: typeName,
    allowMultiple: typeDef?.allowMultiple ?? true,
    fieldDefinitions: typeDef ? typeDef.fields.map(mapFieldDefinition) : [],
  };
}
