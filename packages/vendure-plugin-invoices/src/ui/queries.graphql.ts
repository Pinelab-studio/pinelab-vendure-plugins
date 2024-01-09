import gql from 'graphql-tag';

export const upsertConfigMutation = gql`
  mutation upsertInvoiceConfig($input: InvoiceConfigInput!) {
    upsertInvoiceConfig(input: $input) {
      id
      enabled
      createCreditInvoices
      templateString
    }
  }
`;

export const getConfigQuery = gql`
  query invoiceConfig {
    invoiceConfig {
      id
      enabled
      createCreditInvoices
      templateString
    }
  }
`;

export const getOrderWithInvoices = gql`
  query order($id: ID!) {
    order(id: $id) {
      id
      code
      invoices {
        id
        createdAt
        invoiceNumber
        downloadUrl
        isCreditInvoice
      }
    }
  }
`;
