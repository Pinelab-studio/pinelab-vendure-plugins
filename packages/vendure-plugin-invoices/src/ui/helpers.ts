import gql from 'graphql-tag';
export const GET_ORDER = gql`
  query GetOrder($id: ID!) {
    order(id: $id) {
      id
      createdAt
      updatedAt
      code
      state
      active
      customer {
        id
        firstName
        lastName
      }
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
      lines {
        id
        featuredAsset {
          preview
        }
        productVariant {
          id
          name
          sku
        }
        taxLines {
          description
          taxRate
        }
        unitPrice
        unitPriceWithTax
        quantity
        unitPrice
        unitPriceWithTax
        taxRate
        linePriceWithTax
      }
      surcharges {
        id
        description
        sku
        price
        priceWithTax
      }
      subTotal
      subTotalWithTax
      total
      totalWithTax
      totalQuantity
      currencyCode
      shipping
      shippingWithTax
      shippingLines {
        priceWithTax
        shippingMethod {
          id
          code
          name
          description
        }
      }
      payments {
        id
        transactionId
        amount
        method
        state
        nextStates
        metadata
        refunds {
          id
          total
          reason
        }
      }
      fulfillments {
        id
        state
        method
        trackingCode
        lines {
          orderLineId
          quantity
        }
      }
      total
      totalWithTax
    }
  }
`;
