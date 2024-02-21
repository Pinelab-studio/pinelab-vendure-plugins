import gql from 'graphql-tag';

export const upsertConfigMutation = gql`
  mutation upsertPicklistConfig($templateString: String!) {
    upsertPicklistConfig(templateString: $templateString) {
      id
      templateString
    }
  }
`;

export const getConfigQuery = gql`
  query picklistConfig {
    picklistConfig {
      id
      templateString
    }
  }
`;
