import gql from 'graphql-tag';

export const upsertConfigMutation = gql`
  mutation upsertInvoiceConfig($input: InvoiceConfigInput!) {
    upsertInvoiceConfig(input: $input) {
      id
      enabled
      templateString
    }
  }
`;

export const getConfigQuery = gql`
  query invoiceConfig {
    invoiceConfig {
      id
      enabled
      templateString
    }
  }
`;

export const getAllInvoicesQuery = gql`
  query invoices($input: InvoicesListInput) {
    invoices(input: $input) {
      items {
        id
        createdAt
        orderCode
        orderId
        customerEmail
        invoiceNumber
        downloadUrl
      }
      totalItems
    }
  }
`;
