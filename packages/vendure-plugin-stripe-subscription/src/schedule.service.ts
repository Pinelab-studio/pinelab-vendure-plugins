import {
  SubscriptionBillingInterval,
  SubscriptionDurationInterval,
  SubscriptionStartMoment,
} from './generated/graphql';
import { Schedule } from './schedule.entity';
import { Injectable } from '@nestjs/common';
import { VariantWithSubscriptionFields } from './subscription-custom-fields';
import { RequestContext } from '@vendure/core';

export const schedules: Partial<Schedule>[] = [
  {
    name: '6 months, billed monthly, 199 downpayment',
    downpayment: 19900,
    durationInterval: SubscriptionDurationInterval.Month,
    durationCount: 6,
    startMoment: SubscriptionStartMoment.StartOfBillingInterval,
    billingInterval: SubscriptionBillingInterval.Month,
    billingCount: 1,
  },
  {
    name: '6 months, paid in full, 199 downpayment',
    downpayment: 19900,
    durationInterval: SubscriptionDurationInterval.Month,
    durationCount: 6,
    startMoment: SubscriptionStartMoment.StartOfBillingInterval,
    billingInterval: SubscriptionBillingInterval.Month,
    billingCount: 6,
  },
  {
    name: '40 weeks, billed weekly, 99 Registration',
    downpayment: 9900,
    durationInterval: SubscriptionDurationInterval.Week,
    durationCount: 40,
    startMoment: SubscriptionStartMoment.StartOfBillingInterval,
    billingInterval: SubscriptionBillingInterval.Week,
    billingCount: 1,
  },
  {
    name: '12 months, billed monthly, 199 downpayment',
    downpayment: 19900,
    durationInterval: SubscriptionDurationInterval.Month,
    durationCount: 12,
    startMoment: SubscriptionStartMoment.StartOfBillingInterval,
    billingInterval: SubscriptionBillingInterval.Month,
    billingCount: 1,
  },
  {
    name: '12 months, paid in full, 199 downpayment',
    downpayment: 19900,
    durationInterval: SubscriptionDurationInterval.Month,
    durationCount: 12,
    startMoment: SubscriptionStartMoment.StartOfBillingInterval,
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

  async getSchedules(ctx: RequestContext): Promise<Schedule[]> {
    return schedules as Schedule[];
  }
}
