import gql from 'graphql-tag';

export const commonSchemaExtensions = gql`
  type ContentEntry implements Node {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    code: String!
    name: String!
    contentTypeCode: String!
    fields: JSON!
  }

  type ContentEntryList implements PaginatedList {
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

export const shopSchemaExtensions = gql`
  ${commonSchemaExtensions}
`;

export const adminSchemaExtensions = gql`
  ${commonSchemaExtensions}

  input ContentEntryInput {
    code: String!
    name: String!
    contentTypeCode: String!
    fields: JSON!
  }

  extend type Mutation {
    createContentEntry(input: ContentEntryInput!): ContentEntry!
    updateContentEntry(id: ID!, input: ContentEntryInput!): ContentEntry!
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
  scalar LogicalOperator
  scalar StringOperators
  scalar Node
  scalar PaginatedList
  scalar DeletionResponse
  scalar DeletionResult
`;
export type PaginatedList = unknown;
