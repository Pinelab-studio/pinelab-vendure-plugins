import { gql } from 'graphql-tag';
export const convertToDraftMutation = gql`
  mutation ConvertToDraft($id: ID) {
    convertToDraft(id: $id) {
      id
      code
      state
      active
      total
      totalWithTax
      lines {
        id
        quantity
        productVariant {
          id
        }
        discounts {
          adjustmentSource
          amount
          amountWithTax
          description
          type
        }
      }
    }
  }
`;
