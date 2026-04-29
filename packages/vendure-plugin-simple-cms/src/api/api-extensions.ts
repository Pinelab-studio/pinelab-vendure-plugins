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
  type AdminContentEntry implements ContentEntry & Node {
    id: ID!
    contentTypeCode: String!
    createdAt: DateTime!
    updatedAt: DateTime!
    fields: JSON!
    translations: [AdminContentEntryTranslation!]!
    """
    Display name derived from the first \`string\` field of the
    content type definition. Resolves the active language for
    translatable fields, falling back to the first available
    translation. Returns null if no string field is defined or
    the value is empty/missing.
    """
    displayName: String
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

  type AdminContentEntryList implements PaginatedList {
    items: [AdminContentEntry!]!
    totalItems: Int!
  }

  input ContentEntryListFilter {
    id: IDOperators
    createdAt: DateOperators
    updatedAt: DateOperators
    contentTypeCode: StringOperators
    _and: [ContentEntryListFilter!]
    _or: [ContentEntryListFilter!]
  }

  input AdminContentEntryListOptions {
    skip: Int
    take: Int
    filter: ContentEntryListFilter
    filterOperator: LogicalOperator
    sort: JSON
  }

  extend type Query {
    contentEntry(id: ID!): AdminContentEntry
    contentEntries(
      options: AdminContentEntryListOptions
    ): AdminContentEntryList!
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
   - 'struct': nested primitive sub-fields under \`fields\`
   - 'relation': uses \`graphQLType\`
  The \`ui\` JSON object carries dashboard form rendering hints, e.g.
  \`{ component: 'product-selector-form-input', ...arbitraryProps }\`.

  \`isTranslatable\` is only meaningful at the top-level field. A struct
  is translatable as a whole; its sub-fields cannot individually opt
  in or out, and therefore expose no \`isTranslatable\` property.
  """
  type SimpleCmsField {
    name: String!
    type: String!
    nullable: Boolean!
    isTranslatable: Boolean
    graphQLType: String
    fields: [SimpleCmsStructSubField!]
    ui: JSON
  }

  """
  Metadata about a sub-field of a struct field. Sub-fields are always
  primitive and inherit translation behaviour from their parent struct.
  """
  type SimpleCmsStructSubField {
    name: String!
    type: String!
    nullable: Boolean!
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
  scalar IDOperators
  scalar DateOperators
  scalar Node
  scalar PaginatedList
  scalar DeletionResponse
  scalar DeletionResult
`;
export type PaginatedList = unknown;
