import { SubscriptionBillingInterval } from './generated/graphql';
import { DurationInterval, Schedule, StartDate } from './schedule.entity';
import { Injectable } from '@nestjs/common';
import { VariantWithSubscriptionFields } from './subscription-custom-fields';

export const schedules: Partial<Schedule>[] = [
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
  {
    name: '12 months, billed monthly, 199 downpayment',
    downpayment: 19900,
    durationInterval: DurationInterval.Month,
    durationCount: 12,
    startDate: StartDate.START,
    billingInterval: SubscriptionBillingInterval.Month,
    billingCount: 1,
  },
  {
    name: '12 months, paid in full, 199 downpayment',
    downpayment: 19900,
    durationInterval: DurationInterval.Month,
    durationCount: 12,
    startDate: StartDate.START,
    billingInterval: SubscriptionBillingInterval.Month,
    billingCount: 12,
  },
];

@Injectable()
export class ScheduleService {
  async getSchedule(variant: VariantWithSubscriptionFields): Promise<Schedule> {
    const schedule = schedules.find(
      (s) => s.name === variant!.customFields.subscriptionSchedule
    );
    if (!schedule) {
      throw Error(
        `No schedule found with name "${variant.customFields.subscriptionSchedule}"`
      );
    }
    return schedule as Schedule;
  }
}
