import { gql } from 'graphql-tag';

export const GET_REQUIRED_FACETS = gql`
  query GetRequiredFacets {
    requiredFacets {
      id
      name
      customFields {
        showOnProductDetail
        showOnProductDetailIf {
          id
        }
      }
      values {
        id
        name
        facet {
          id
          name
        }
      }
    }
  }
`;
