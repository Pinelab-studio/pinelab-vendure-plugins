import { gql } from 'graphql-tag';

export const GET_SCHEDULES = gql`
  query stripeSubscriptionSchedules {
    stripeSubscriptionSchedules {
      id
      createdAt
      updatedAt
      name
      downpaymentWithTax
      durationInterval
      durationCount
      startMoment
      billingInterval
      billingCount
    }
  }
`;

export const UPSERT_SCHEDULES = gql`
  mutation upsertStripeSubscriptionSchedule(
    $input: UpsertStripeSubscriptionScheduleInput!
  ) {
    upsertStripeSubscriptionSchedule(input: $input) {
      id
      createdAt
      updatedAt
      name
      downpaymentWithTax
      durationInterval
      durationCount
      startMoment
      billingInterval
      billingCount
      paidUpFront
    }
  }
`;

export const DELETE_SCHEDULE = gql`
  mutation deleteStripeSubscriptionSchedule($scheduleId: ID!) {
    deleteStripeSubscriptionSchedule(scheduleId: $scheduleId)
  }
`;
