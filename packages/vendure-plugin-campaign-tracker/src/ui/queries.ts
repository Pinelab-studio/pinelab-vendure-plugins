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
    revenueLast365Days
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
