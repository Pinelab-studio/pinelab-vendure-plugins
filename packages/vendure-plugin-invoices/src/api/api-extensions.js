'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.adminSchemaExtensions = exports.shopSchemaExtensions = void 0;
const graphql_tag_1 = __importDefault(require('graphql-tag'));
// These stubs are only used by codegen so it can resolve
// Vendure core types referenced in the plugin schema
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const scalars = (0, graphql_tag_1.default)`
  scalar DateTime
  scalar JSON
  scalar LogicalOperator
  scalar StringOperators
  scalar NumberOperators
  scalar Money
  interface Node {
    id: ID!
  }
  interface PaginatedList {
    items: [Node!]!
    totalItems: Int!
  }
`;
const commonSchemaExtensions = (0, graphql_tag_1.default)`
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

  type Invoice implements Node {
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
    reference: String
    link: String
    errorMessage: String
  }
`;
exports.shopSchemaExtensions = (0, graphql_tag_1.default)`
  ${commonSchemaExtensions}
`;
exports.adminSchemaExtensions = (0, graphql_tag_1.default)`
  ${commonSchemaExtensions}

  type InvoiceConfig {
    id: ID!
    enabled: Boolean!
    createCreditInvoices: Boolean!
    templateString: String!
  }

  type InvoiceList implements PaginatedList {
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
    """
    Export the given invoice to the configured accounting platform.
    This is done via the Job Queue, so monitor invoice.accountingReference to see if the export succeeded.
    """
    exportInvoiceToAccountingPlatform(invoiceNumber: Int!): Boolean!
  }

  extend type Query {
    invoiceConfig: InvoiceConfig
    invoices(options: InvoiceListOptions): InvoiceList
  }
`;
