import { SubscriptionBillingInterval } from './generated/graphql';

export enum DurationInterval {
  Day = 'day',
  Week = 'week',
  Month = 'month',
  Year = 'year',
}

export enum StartDate {
  START = 'Start of the billing interval',
  END = 'End of the billing interval',
}

export interface Schedule {
  name: string;
  downpayment: number;
  durationInterval: DurationInterval;
  durationCount: number;
  startDate: StartDate;
  billingInterval: SubscriptionBillingInterval;
  billingCount: number;
}

export const schedules: Schedule[] = [
  {
    name: '6 months, billed monthly, 199 downpayment',
    downpayment: 19900,
    durationInterval: DurationInterval.Month,
    durationCount: 6,
    startDate: StartDate.START,
    billingInterval: SubscriptionBillingInterval.Month,
    billingCount: 1,
  },
  {
    name: '6 months, paid in full, 199 downpayment',
    downpayment: 19900,
    durationInterval: DurationInterval.Month,
    durationCount: 6,
    startDate: StartDate.START,
    billingInterval: SubscriptionBillingInterval.Month,
    billingCount: 6,
  },
  {
    name: '40 weeks, billed weekly, 99 Registration',
    downpayment: 9900,
    durationInterval: DurationInterval.Week,
    durationCount: 40,
    startDate: StartDate.START,
    billingInterval: SubscriptionBillingInterval.Week,
    billingCount: 1,
  },
];
