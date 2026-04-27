import { DocumentNode } from 'graphql';
import gql from 'graphql-tag';
import { SimpleCmsPluginOptions } from '../types';
import { generateShopSchema, toPascalCase } from './generate-shop-schema';

/**
 * Returns the PascalCase GraphQL type name for a content type key.
 * Used to compute `__typename` at runtime for interface resolution.
 */
export function toGraphQLTypeName(contentTypeKey: string): string {
  return toPascalCase(contentTypeKey);
}

/**
 * Builds the dynamic Shop API schema from the plugin options. Each
 * configured content type becomes a concrete GraphQL type and the
 * Query is extended with typed accessors.
 */
export function shopApiExtensions(
  options: SimpleCmsPluginOptions
): DocumentNode {
  return gql(generateShopSchema(options));
}

export const adminSchemaExtensions = gql`
  type AdminContentEntry implements ContentEntry {
    id: ID!
    contentTypeCode: String!
    createdAt: DateTime!
    updatedAt: DateTime!
    fields: JSON!
    translations: [AdminContentEntryTranslation!]!
  }

  type AdminContentEntryTranslation {
    languageCode: LanguageCode!
    fields: JSON
  }

  interface ContentEntry {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  input ContentEntryTranslationInput {
    languageCode: LanguageCode!
    fields: JSON!
  }

  input ContentEntryInput {
    contentTypeCode: String!
    fields: JSON!
    translations: [ContentEntryTranslationInput!]
  }

  extend type Query {
    contentEntry(id: ID!): AdminContentEntry
    contentEntries(contentTypeCode: String!): [AdminContentEntry!]!
    simpleCmsContentTypes: [SimpleCmsContentType!]!
    simpleCmsContentType(code: String!): SimpleCmsContentType
  }

  type SimpleCmsContentType {
    code: String!
    displayName: String!
    allowMultiple: Boolean!
    fields: [SimpleCmsField!]!
  }

  """
  Metadata about a single field on a SimpleCms content type. Optional fields
  are populated based on the field kind:
   - 'string' | 'text' | 'int' | 'float' | 'boolean' | 'date': primitive
   - 'struct': nested primitive fields under \`fields\`
   - 'relation': uses \`graphQLType\`
  The \`ui\` JSON object carries dashboard form rendering hints, e.g.
  \`{ component: 'product-selector-form-input', ...arbitraryProps }\`.
  """
  type SimpleCmsField {
    name: String!
    type: String!
    nullable: Boolean!
    isTranslatable: Boolean
    graphQLType: String
    fields: [SimpleCmsField!]
    ui: JSON
  }

  extend type Mutation {
    createContentEntry(input: ContentEntryInput!): AdminContentEntry!
    updateContentEntry(id: ID!, input: ContentEntryInput!): AdminContentEntry!
    deleteContentEntry(id: ID!): DeletionResponse!
  }
`;

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
`;
export type PaginatedList = unknown;
