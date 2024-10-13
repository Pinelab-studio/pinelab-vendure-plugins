import { gql } from 'graphql-tag';

export const getAllKlaviyoReviews = gql`
  query getAllKlaviyoReviews {
    getKlaviyoReviews {
      data {
        type
      }
    }
  }
`;
