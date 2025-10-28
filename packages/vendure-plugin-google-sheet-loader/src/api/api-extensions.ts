import { gql } from 'graphql-tag';

export const adminApiExtention = gql`
  extend type Mutation {
    """
    Load data from a Google Sheet. Will return true if validation is successful, otherwise will throw a UserInputError.
    Actual processing of the data is done in the worker.
    """
    loadDataFromGoogleSheet: Boolean!
  }
`;
