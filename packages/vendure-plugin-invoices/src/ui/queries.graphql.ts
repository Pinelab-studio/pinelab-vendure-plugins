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

export const invoiceFragment = gql`
  fragment invoiceFields on Invoice {
    id
    createdAt
    invoiceNumber
    isCreditInvoice
    downloadUrl
    accountingReference {
      reference
      link
    }
  }
`;

export const createInvoice = gql`
  ${invoiceFragment}
  mutation createInvoice($orderId: ID!) {
    createInvoice(orderId: $orderId) {
      ...invoiceFields
    }
  }
`;
