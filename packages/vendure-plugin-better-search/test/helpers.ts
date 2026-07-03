import gql from 'graphql-tag';

export const WARMUP_QUERY = gql`
  query Warmup($term: String!) {
    search(input: { term: $term }) {
      totalItems
    }
  }
`;

export const SEARCH_QUERY = gql`
  query Search($term: String!) {
    search(input: { term: $term }) {
      totalItems
      items {
        productId
        slug
        productName
        score
      }
    }
  }
`;

export const SEARCH_SUGGESTIONS_QUERY = gql`
  query SearchSuggestions($term: String!) {
    searchSuggestions(term: $term) {
      suggestion
    }
  }
`;

export const CREATE_CHANNEL = gql`
  mutation CreateChannel($input: CreateChannelInput!) {
    createChannel(input: $input) {
      ... on Channel {
        id
        code
        token
      }
    }
  }
`;

export const GET_PRODUCTS = gql`
  query GetProducts {
    products {
      items {
        id
        slug
        name
      }
    }
  }
`;

export const ASSIGN_PRODUCTS_TO_CHANNEL = gql`
  mutation AssignProductsToChannel($input: AssignProductsToChannelInput!) {
    assignProductsToChannel(input: $input) {
      id
      name
      channels {
        id
        code
      }
    }
  }
`;

export const UPDATE_CHANNEL = gql`
  mutation UpdateChannel($input: UpdateChannelInput!) {
    updateChannel(input: $input) {
      ... on Channel {
        id
        code
        defaultLanguageCode
        availableLanguageCodes
      }
    }
  }
`;

export const UPDATE_PRODUCT = gql`
  mutation UpdateProduct($input: UpdateProductInput!) {
    updateProduct(input: $input) {
      id
      slug
      name
    }
  }
`;

export const INSPECT_INDEX = gql`
  query InspectIndex($skip: Int, $take: Int) {
    inspectSearchIndex(skip: $skip, take: $take)
  }
`;

export const INSPECT_SEARCH_INDEX = gql`
  query {
    inspectSearchIndex(skip: 0, take: 50)
  }
`;
