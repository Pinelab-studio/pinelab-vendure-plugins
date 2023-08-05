import { gql } from 'graphql-tag';

export const SCHEDULE_FRAGMENT = gql`
  fragment ScheduleFields on StripeSubscriptionSchedule {
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
    paidUpFront
    fixedStartDate
    useProration
    autoRenew
  }
`;

export const PAYMENT_FRAGMENT = gql`
  fragment PaymentFields on StripeSubscriptionPayment {
    id
    createdAt
    updatedAt
    collectionMethod
    charge
    currency
    orderCode
    channelId
    subscriptionId
  }
`;

export const GET_SCHEDULES = gql`
  ${SCHEDULE_FRAGMENT}
  query stripeSubscriptionSchedules {
    stripeSubscriptionSchedules {
      items {
        ...ScheduleFields
      }
      totalItems
    }
  }
`;

export const GET_PAYMENTS = gql`
  ${PAYMENT_FRAGMENT}
  query stripeSubscriptionPayments {
    stripeSubscriptionPayments {
      items {
        ...PaymentFields
      }
      totalItems
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
