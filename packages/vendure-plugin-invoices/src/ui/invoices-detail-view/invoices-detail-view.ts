import gql from 'graphql-tag';

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
      errorMessage
    }
  }
`;

export const getOrderWithInvoices = gql`
  ${invoiceFragment}
  query order($id: ID!) {
    order(id: $id) {
      id
      code
      state
      invoices {
        ...invoiceFields
      }
    }
  }
`;
