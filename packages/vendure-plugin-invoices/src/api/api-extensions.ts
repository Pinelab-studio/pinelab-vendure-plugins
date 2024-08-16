import gql from 'graphql-tag';
// This is only used by codegen so it knows DateTime is a custom scalar
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const scalars = gql`
  scalar DateTime
  scalar JSON
  scalar LogicalOperator
  scalar StringOperators
  scalar Money
`;

const commonSchemaExtensions = gql`
  type InvoiceTaxSummary {
    description: String!
    taxBase: Money!
    taxRate: Money!
    taxTotal: Money!
  }

  """
  The order totals that were used to generate the invoice.
  These are used to generate credit invoices.
  """
  type InvoiceOrderTotals {
    taxSummaries: [InvoiceTaxSummary!]!
    total: Money!
    totalWithTax: Money!
  }

  type Invoice {
    id: ID!
    createdAt: DateTime
    invoiceNumber: Int!
    downloadUrl: String!
    orderCode: String!
    orderId: ID!
    isCreditInvoice: Boolean!
    accountingReference: InvoiceAccountingReference
    orderTotals: InvoiceOrderTotals!
  }

  extend type Order {
    invoices: [Invoice!]!
  }
  type InvoiceAccountingReference {
    reference: String!
    link: String
  }
`;
export const shopSchemaExtensions = gql`
  ${commonSchemaExtensions}
`;

export const adminSchemaExtensions = gql`
  ${commonSchemaExtensions}

  type InvoiceConfig {
    id: ID!
    enabled: Boolean!
    createCreditInvoices: Boolean!
    templateString: String!
  }

  type InvoiceList {
    items: [Invoice!]!
    totalItems: Int!
  }

  input InvoiceConfigInput {
    enabled: Boolean!
    createCreditInvoices: Boolean
    templateString: String
  }

  input InvoiceListFilter {
    orderCode: StringOperators
    invoiceNumber: StringOperators
  }

  input InvoiceListOptions {
    skip: Int
    take: Int
    filter: InvoiceListFilter
    filterOperator: LogicalOperator
    sort: JSON
  }

  extend type Mutation {
    upsertInvoiceConfig(input: InvoiceConfigInput): InvoiceConfig!
    """
    Generate a new invoice for the given order. Creates a credit invoice if the order already has an invoice.
    """
    createInvoice(orderId: ID!): Invoice!
  }

  extend type Query {
    invoiceConfig: InvoiceConfig
    invoices(options: InvoiceListOptions): InvoiceList
  }
`;
