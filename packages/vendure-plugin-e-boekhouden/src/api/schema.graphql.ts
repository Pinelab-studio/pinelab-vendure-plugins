import gql from 'graphql-tag';

export const schema = gql`
  input EBoekhoudenConfigInput {
    enabled: Boolean
    username: String
    secret1: String
    secret2: String
    contraAccount: String
  }

  type EBoekhoudenConfig {
      enabled: Boolean
      username: String
      secret1: String
      secret2: String
      contraAccount: String
  }
  
  extend type Mutation {
    updateEBoekhoudenConfig(
      input: EBoekhoudenConfigInput!
    ): EBoekhoudenConfig
  }
  
  extend type Query {
    eBoekhoudenConfig: EBoekhoudenConfig
  }
`;
