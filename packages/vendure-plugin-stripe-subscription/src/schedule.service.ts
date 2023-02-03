import {
  UpsertStripeSubscriptionScheduleInput,
  StripeSubscriptionSchedule,
} from './ui/generated/graphql';
import { Schedule } from './schedule.entity';
import { Injectable } from '@nestjs/common';
import {
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';

@Injectable()
export class ScheduleService {
  constructor(private connection: TransactionalConnection) {}

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
      downpaymentWithTax:
        input.downpaymentWithTax || input.downpaymentWithTax === 0
          ? input.downpaymentWithTax
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
    const { id } = await this.connection.rawConnection
      .getRepository(Schedule)
      .findOneOrFail({
        where: {
          id: scheduleId,
          channelId: ctx.channelId,
        },
      });
    await this.connection.getRepository(ctx, Schedule).delete({ id });
  }

  validate(input: UpsertStripeSubscriptionScheduleInput): void {
    if (
      input.billingInterval === input.durationInterval &&
      input.billingCount === input.durationCount &&
      input.downpaymentWithTax
    ) {
      throw new UserInputError(
        `Paid up front schedules can not have downpayments. When duration and billing intervals are the same your schedule is a paid-up-front schedule.`
      );
    }
  }
}
