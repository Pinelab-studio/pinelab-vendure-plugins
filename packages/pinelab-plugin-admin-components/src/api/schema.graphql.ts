import gql from 'graphql-tag';

export const schema = gql`
  type InvoiceConfig {
    id: ID!
    enabled: Boolean!
    templateString: String
  }

  input InvoicesListInput {
    page: Int!
    itemsPerPage: Int!
  }

  input InvoiceConfigInput {
    enabled: Boolean!
    templateString: String
  }

  extend type Mutation {
    upsertInvoiceConfig(input: InvoiceConfigInput): InvoiceConfig!
  }

  extend type Query {
    invoiceConfig: InvoiceConfig
  }
`;
