import { gql } from 'graphql-tag';
export const GET_COLLECTIONS_WITH_POPULARITY_SCORE = gql`
  query collections {
    collections {
      items {
        id
        name
        slug
        customFields {
          popularityScore
        }
        productVariants {
          items {
            name
            id
            product {
              id
            }
          }
          totalItems
        }
      }
      totalItems
    }
  }
`;

export const GET_PRODUCTS_WITH_POPULARITY_SCORES = gql`
  query products {
    products {
      items {
        id
        name
        slug
        customFields {
          popularityScore
        }
      }
      totalItems
    }
  }
`;
