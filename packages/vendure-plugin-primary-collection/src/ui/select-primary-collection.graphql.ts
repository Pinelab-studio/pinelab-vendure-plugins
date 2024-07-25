import { gql } from 'graphql-tag';
export const GET_PRODUCT_DETAIL = gql`
  query ProductsCollection($id: ID) {
    product(id: $id) {
      primaryCollection {
        id
        name
        channels {
          id
        }
      }
      collections {
        id
        name
        channels {
          id
        }
      }
    }
  }
`;
