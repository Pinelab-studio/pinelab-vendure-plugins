import {
  SubscriptionInterval,
  SubscriptionStartMoment,
  UpsertStripeSubscriptionScheduleInput,
} from './ui/generated/graphql';
import { Schedule } from './schedule.entity';
import { Injectable } from '@nestjs/common';
import { VariantWithSubscriptionFields } from './subscription-custom-fields';
import { RequestContext, TransactionalConnection } from '@vendure/core';

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
  constructor(private connection: TransactionalConnection) {}

  async getSchedule(variant: VariantWithSubscriptionFields): Promise<Schedule> {
    const schedule = schedules.find(
      (s) => s.name === variant!.customFields.subscriptionSchedule
    );
    if (!schedule) {
      throw Error(
        `No schedule found with name "${variant.customFields.subscriptionSchedule}"`
      );
    }
    return {
      ...schedule,
      id: schedule.name,
      createdAt: new Date(),
      paidUpFront: schedule.paidUpFront,
      updatedAt: new Date(),
    };
  }

  async getSchedules(ctx: RequestContext): Promise<Schedule[]> {
    return this.connection
      .getRepository(ctx, Schedule)
      .find({ where: { channelId: String(ctx.channelId) } });
  }

  async upsert(
    ctx: RequestContext,
    input: UpsertStripeSubscriptionScheduleInput
  ): Promise<Schedule> {
    const { id } = await this.connection.getRepository(ctx, Schedule).save({
      id: input.id || undefined,
      channelId: String(ctx.channelId),
      name: input.name || undefined,
      downpayment:
        input.downpayment || input.downpayment === 0
          ? input.downpayment
          : undefined,
      durationInterval: input.durationInterval || undefined,
      durationCount: input.durationCount || undefined,
      startMoment: input.startMoment || undefined,
      billingInterval: input.billingInterval || undefined,
      billingCount: input.billingCount || undefined,
    });
    return this.connection.getRepository(ctx, Schedule).findOneOrFail({ id });
  }

  async delete(ctx: RequestContext, scheduleId: string): Promise<void> {
    const { id } = await this.connection
      .getRepository(ctx, Schedule)
      .findOneOrFail({
        where: {
          id: scheduleId,
          channelId: ctx.channelId,
        },
      });
    await this.connection.getRepository(ctx, Schedule).delete({ id });
  }
}
