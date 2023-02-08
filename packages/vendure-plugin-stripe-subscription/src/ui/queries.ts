import { gql } from 'graphql-tag';

export const SCHEDULE_FRAGMENT = gql`
  fragment ScheduleFields on StripeSubscriptionSchedule {
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
    fixedStartDate
    useProration
    autoRenew
  }
`;

export const GET_SCHEDULES = gql`
  ${SCHEDULE_FRAGMENT}
  query stripeSubscriptionSchedules {
    stripeSubscriptionSchedules {
      ...ScheduleFields
    }
  }
`;

export const UPSERT_SCHEDULES = gql`
  ${SCHEDULE_FRAGMENT}
  mutation upsertStripeSubscriptionSchedule(
    $input: UpsertStripeSubscriptionScheduleInput!
  ) {
    upsertStripeSubscriptionSchedule(input: $input) {
      ...ScheduleFields
    }
  }
`;

export const DELETE_SCHEDULE = gql`
  mutation deleteStripeSubscriptionSchedule($scheduleId: ID!) {
    deleteStripeSubscriptionSchedule(scheduleId: $scheduleId)
  }
`;
