import { gql } from 'graphql-tag';

export const getSchedules = gql`
  query stripeSubscriptionSchedules {
    stripeSubscriptionSchedules {
      id
      createdAt
      updatedAt
      name
      downpayment
      durationInterval
      durationCount
      startMoment
      billingInterval
      billingCount
    }
  }
`;
