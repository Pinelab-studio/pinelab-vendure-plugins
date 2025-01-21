import gql from 'graphql-tag';

// This is only used by codegen so it knows DateTime is a custom scalar
const scalars = gql`
  scalar DateTime
`;

export const schema = gql`
  type PDFTemplate {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    enabled: Boolean!
    name: String!
    templateString: String
  }

  input PDFTemplateInput {
    name: String!
    enabled: Boolean!
    templateString: String!
  }

  extend type Mutation {
    createPDFTemplate(input: PDFTemplateInput): PDFTemplate!
    updatePDFTemplate(id: ID!, input: PDFTemplateInput!): PDFTemplate!
    deletePDFTemplate(id: ID!): [PDFTemplate!]!
  }

  extend type Query {
    pdfTemplates: PDFTemplateList!
  }

  type PDFTemplateList {
    items: [PDFTemplate!]!
    totalItems: Int!
  }
`;
