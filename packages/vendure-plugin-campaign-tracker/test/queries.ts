import gql from 'graphql-tag';

export const ADD_CAMPAIGN_TO_ORDER = gql`
  mutation addCampaignToOrder($campaignCode: String!) {
    addCampaignToOrder(campaignCode: $campaignCode) {
      id
      code
      total
      taxSummary {
        taxTotal
      }
    }
  }
`;
