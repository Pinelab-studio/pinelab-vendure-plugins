import gql from 'graphql-tag';

// This is only used by codegen so it can resolve Vendure core types
// referenced in the plugin schema
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const scalars = gql`
  scalar DateTime
  scalar JSON
  scalar LogicalOperator
  scalar StringOperators
  scalar BooleanOperators
  interface Node {
    id: ID!
  }
  interface PaginatedList {
    items: [Node!]!
    totalItems: Int!
  }
  type DeletionResponse {
    result: DeletionResult!
    message: String
  }
  enum DeletionResult {
    DELETED
    NOT_DELETED
  }
`;

export const shopSchema = gql`
  type PDFTemplate {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    name: String!
  }

  extend type Query {
    availablePDFTemplates: [PDFTemplate!]!
  }
`;

export const adminSchema = gql`
  type PDFTemplate implements Node {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    enabled: Boolean!
    public: Boolean!
    name: String!
    templateString: String
  }

  type PDFTemplateList implements PaginatedList {
    items: [PDFTemplate!]!
    totalItems: Int!
  }

  input PDFTemplateFilterParameter {
    name: StringOperators
    enabled: BooleanOperators
    public: BooleanOperators
  }

  input PDFTemplateListOptions {
    skip: Int
    take: Int
    filter: PDFTemplateFilterParameter
    filterOperator: LogicalOperator
    sort: JSON
  }

  input CreatePDFTemplateInput {
    name: String!
    enabled: Boolean!
    public: Boolean!
    templateString: String!
  }

  input UpdatePDFTemplateInput {
    id: ID!
    name: String!
    enabled: Boolean!
    public: Boolean!
    templateString: String!
  }

  extend type Mutation {
    createPDFTemplate(input: CreatePDFTemplateInput!): PDFTemplate!
    updatePDFTemplate(input: UpdatePDFTemplateInput!): PDFTemplate!
    deletePDFTemplate(id: ID!): DeletionResponse!
  }

  extend type Query {
    pdfTemplates(options: PDFTemplateListOptions): PDFTemplateList!
    pdfTemplate(id: ID!): PDFTemplate
  }
`;
