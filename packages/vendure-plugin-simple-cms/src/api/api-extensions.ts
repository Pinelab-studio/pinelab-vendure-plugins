import gql from 'graphql-tag';
import { DocumentNode } from 'graphql';
import {
  SimpleCmsPluginOptions,
  PrimitiveFieldDefinition,
  StructFieldDefinition,
  RelationFieldDefinition,
} from '../types';

type FieldDefinition =
  | PrimitiveFieldDefinition
  | StructFieldDefinition
  | RelationFieldDefinition;

/**
 * Converts a displayName like "Featured Product" into a PascalCase
 * GraphQL type name like "FeaturedProduct".
 */
export function toGraphQLTypeName(displayName: string): string {
  return displayName
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

function primitiveToGraphQLType(type: string): string {
  switch (type) {
    case 'string':
    case 'text':
      return 'String';
    case 'number':
      return 'Float';
    case 'boolean':
      return 'Boolean';
    case 'date':
      return 'DateTime';
    default:
      return 'JSON';
  }
}

function fieldToGraphQL(field: FieldDefinition): string {
  const nullable = field.nullable !== false;
  const bang = nullable ? '' : '!';
  if (field.type === 'relation') {
    return `${field.name}: ${field.graphQLType}${bang}`;
  }
  if (field.type === 'struct') {
    return `${field.name}: JSON${bang}`;
  }
  const gqlType = primitiveToGraphQLType(field.type);
  return `${field.name}: ${gqlType}${bang}`;
}

/**
 * Splits field definitions into non-translatable and translatable groups.
 * Translatable fields appear in both groups: on the entry type (resolved
 * for the current request language) and inside the translations array.
 */
function partitionFields(fields: FieldDefinition[]): {
  entryFields: string[];
  translationFields: string[];
} {
  const entryFields: string[] = [];
  const translationFields: string[] = [];
  for (const field of fields) {
    const sdl = fieldToGraphQL(field);
    const isTranslatable = field.type !== 'relation' && field.isTranslatable;
    if (isTranslatable) {
      translationFields.push(sdl);
      entryFields.push(sdl);
    } else {
      entryFields.push(sdl);
    }
  }
  return { entryFields, translationFields };
}

const baseEntryFields = `
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    code: String!
    name: String!
    contentTypeCode: String!`;

const baseTranslationFields = `
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    languageCode: LanguageCode!`;

/**
 * Builds the complete dynamic SDL for all content types.
 * Each content type becomes its own GraphQL type, and ContentEntry is a union of all of them.
 */
function buildDynamicSchema(options: SimpleCmsPluginOptions): string {
  const typeNames: string[] = [];
  let sdl = '';

  for (const [, typeDef] of Object.entries(options.contentTypes)) {
    const typeName = toGraphQLTypeName(typeDef.displayName);
    typeNames.push(typeName);
    const { entryFields, translationFields } = partitionFields(typeDef.fields);

    const translationTypeName = `${typeName}Translation`;
    const hasTranslations = translationFields.length > 0;

    if (hasTranslations) {
      sdl += `
  type ${translationTypeName} {${baseTranslationFields}
    ${translationFields.join('\n    ')}
  }
`;
    }

    const translationsType = hasTranslations
      ? `[${translationTypeName}!]!`
      : `[JSON!]!`;
    sdl += `
  type ${typeName} implements Node {${baseEntryFields}
    translations: ${translationsType}
    ${entryFields.join('\n    ')}
  }
`;
  }

  if (typeNames.length > 0) {
    sdl += `
  union ContentEntry = ${typeNames.join(' | ')}
`;
  }

  return sdl;
}

const commonSchemaExtensions = gql`
  type ContentEntryList {
    items: [ContentEntry!]!
    totalItems: Int!
  }

  input ContentEntryListFilter {
    code: StringOperators
    name: StringOperators
    contentTypeCode: StringOperators
  }

  input ContentEntryListOptions {
    skip: Int
    take: Int
    filter: ContentEntryListFilter
    filterOperator: LogicalOperator
    sort: JSON
  }

  extend type Query {
    contentEntries(options: ContentEntryListOptions): ContentEntryList!
    contentEntry(id: ID!): ContentEntry
  }
`;

export function getShopSchemaExtensions(
  options: SimpleCmsPluginOptions
): DocumentNode {
  const dynamicSdl = buildDynamicSchema(options);
  return gql`
    ${dynamicSdl}
    ${commonSchemaExtensions}
  `;
}

/**
 * Builds `extend type` blocks that add admin-only fields
 * (allowMultiple, fieldDefinitions) to each concrete content type.
 */
function buildAdminTypeExtensions(options: SimpleCmsPluginOptions): string {
  let sdl = '';
  for (const typeDef of Object.values(options.contentTypes)) {
    const typeName = toGraphQLTypeName(typeDef.displayName);
    sdl += `
  extend type ${typeName} {
    allowMultiple: Boolean!
    fieldDefinitions: [ContentFieldDefinition!]!
  }
`;
  }
  return sdl;
}

export function getAdminSchemaExtensions(
  options: SimpleCmsPluginOptions
): DocumentNode {
  const dynamicSdl = buildDynamicSchema(options);
  const adminExtensions = buildAdminTypeExtensions(options);
  return gql`
    ${dynamicSdl}
    ${commonSchemaExtensions}

    type ContentFieldDefinition {
      name: String!
      type: String!
      nullable: Boolean!
      isTranslatable: Boolean!
      uiComponent: String
      """
      Sub-fields for struct fields
      """
      fields: [ContentFieldDefinition!]
    }

    ${adminExtensions}

    input ContentEntryTranslationInput {
      languageCode: LanguageCode!
      fields: JSON!
    }

    input ContentEntryInput {
      code: String!
      name: String!
      contentTypeCode: String!
      fields: JSON!
      translations: [ContentEntryTranslationInput!]
    }

    extend type Mutation {
      createContentEntry(input: ContentEntryInput!): ContentEntry!
      updateContentEntry(id: ID!, input: ContentEntryInput!): ContentEntry!
      deleteContentEntry(id: ID!): DeletionResponse!
    }
  `;
}

/**
 * These are just to 'fool' the codegen, so that we can statically generate types
 * from the plugin's schema extensions.
 */
export const scalars = gql`
  scalar DateTime
  scalar JSON
  scalar LanguageCode
  scalar LogicalOperator
  scalar StringOperators
  scalar Node
  scalar PaginatedList
  scalar DeletionResponse
  scalar DeletionResult
  scalar ContentEntry
`;
export type PaginatedList = unknown;
