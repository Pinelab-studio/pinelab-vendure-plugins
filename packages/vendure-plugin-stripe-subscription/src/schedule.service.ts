import {
  SubscriptionInterval,
  SubscriptionStartMoment,
} from './generated/graphql';
import { Schedule } from './schedule.entity';
import { Injectable } from '@nestjs/common';
import { VariantWithSubscriptionFields } from './subscription-custom-fields';
import { RequestContext } from '@vendure/core';

export const schedules: Schedule[] = [
  new Schedule({
    name: '6 months, billed monthly, 199 downpayment',
    downpayment: 19900,
    durationInterval: SubscriptionInterval.Month,
    durationCount: 6,
    startMoment: SubscriptionStartMoment.StartOfBillingInterval,
    billingInterval: SubscriptionInterval.Month,
    billingCount: 1,
  }),
  new Schedule({
    name: '6 months, paid in full, no downpayment',
    downpayment: 0,
    durationInterval: SubscriptionInterval.Month,
    durationCount: 6,
    startMoment: SubscriptionStartMoment.StartOfBillingInterval,
    billingInterval: SubscriptionInterval.Month,
    billingCount: 6,
  }),
  new Schedule({
    name: '40 weeks, billed weekly, 99 Registration',
    downpayment: 9900,
    durationInterval: SubscriptionInterval.Week,
    durationCount: 40,
    startMoment: SubscriptionStartMoment.StartOfBillingInterval,
    billingInterval: SubscriptionInterval.Week,
    billingCount: 1,
  }),
  new Schedule({
    name: '12 months, billed monthly, 199 downpayment',
    downpayment: 19900,
    durationInterval: SubscriptionInterval.Month,
    durationCount: 12,
    startMoment: SubscriptionStartMoment.StartOfBillingInterval,
    billingInterval: SubscriptionInterval.Month,
    billingCount: 1,
  }),
  new Schedule({
    name: '12 months, paid in full, no downpayment',
    downpayment: 0,
    durationInterval: SubscriptionInterval.Month,
    durationCount: 12,
    startMoment: SubscriptionStartMoment.StartOfBillingInterval,
    billingInterval: SubscriptionInterval.Month,
    billingCount: 12,
  }),
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
    return schedule;
  }

  async getSchedules(ctx: RequestContext): Promise<Schedule[]> {
    return schedules;
  }
}
