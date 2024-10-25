import gql from 'graphql-tag';

export const CAMPAIGN_FRAGMENT = gql`
  fragment Campaign on Campaign {
    id
    createdAt
    updatedAt
    code
    name
    metricsUpdatedAt
    revenueLast7days
    revenueLast30days
    revenueLast365days
  }
`;

export const CREATE_CAMPAIGN = gql`
  mutation CreateCampaign($input: CampaignInput!) {
    createCampaign(input: $input) {
      ...Campaign
    }
  }
  ${CAMPAIGN_FRAGMENT}
`;

export const UPDATE_CAMPAIGN = gql`
  mutation UpdateCampaign($id: ID!, $input: CampaignInput!) {
    updateCampaign(id: $id, input: $input) {
      ...Campaign
    }
  }
  ${CAMPAIGN_FRAGMENT}
`;

export const DELETE_CAMPAIGN = gql`
  mutation DeleteCampaign($id: ID!) {
    deleteCampaign(id: $id)
  }
`;

export const GET_CAMPAIGNS = gql`
  query GetCampaigns($options: CampaignListOptions) {
    campaigns(options: $options) {
      items {
        ...Campaign
      }
      totalItems
    }
  }
  ${CAMPAIGN_FRAGMENT}
`;
