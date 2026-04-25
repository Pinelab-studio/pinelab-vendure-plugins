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
    code: String!
    name: String!
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
    code: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

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

  extend type Query {
    contentEntry(id: ID!): AdminContentEntry
    contentEntryByCode(code: String!): AdminContentEntry
    contentEntries(contentTypeCode: String!): [AdminContentEntry!]!
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
