import gql from 'graphql-tag';

export const UpdateProductMutation = gql`
  mutation UpdateProduct($input: UpdateProductInput!) {
    updateProduct(input: $input) {
      id
      customFields {
        frequentlyBoughtWith {
          id
          name
        }
      }
    }
  }
`;
export const GetProductById = gql`
  query GetProduct($id: ID!) {
    product(id: $id) {
      id
      customFields {
        frequentlyBoughtWith {
          id
          name
        }
      }
    }
  }
`;
