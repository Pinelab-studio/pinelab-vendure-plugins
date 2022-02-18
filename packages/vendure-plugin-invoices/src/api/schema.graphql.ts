import gql from 'graphql-tag';

export const schema = gql`
  type InvoiceConfig {
    id: ID!
    enabled: Boolean!
    templateString: String
  }

  type Invoice {
    id: ID!
    createdAt: DateTime
    orderCode: String!
    orderId: String!
    customerEmail: String!
    invoiceNumber: Int!
    downloadUrl: String!
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
    """
    Get paginated invoices. Always returns 50 per page.
    """
    allInvoices(page: Int): [Invoice!]!
  }
`;
