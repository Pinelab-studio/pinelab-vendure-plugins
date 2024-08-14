import gql from 'graphql-tag';
export const GET_ORDER = gql`
  query GetOrder($id: ID!) {
    order(id: $id) {
      id
      invoices {
        id
        createdAt
        invoiceNumber
        downloadUrl
        orderCode
        orderId
        isCreditInvoice
        orderTotals {
          totalWithTax
        }
      }
      state
      totalWithTax
    }
  }
`;
