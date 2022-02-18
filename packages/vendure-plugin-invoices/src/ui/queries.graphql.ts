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
  query allInvoices($page: Int) {
    allInvoices(page: $page) {
      id
      createdAt
      orderCode
      orderId
      customerEmail
      invoiceNumber
      downloadUrl
    }
  }
`;
