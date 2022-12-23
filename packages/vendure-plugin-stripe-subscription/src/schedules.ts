import { SubscriptionBillingInterval } from './generated/graphql';

export enum DurationInterval {
  Day = 'day',
  week = 'week',
  Month = 'month',
  year = 'year',
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
];
