import { Injectable } from '@nestjs/common';
import {
  ID,
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import {
  StripeSubscriptionSchedule,
  SubscriptionStartMoment,
  UpsertStripeSubscriptionScheduleInput,
} from '../ui/generated/graphql';
import { cloneSchedule } from './pricing.helper';
import { Schedule } from './schedule.entity';

@Injectable()
export class ScheduleService {
  constructor(private connection: TransactionalConnection) {}

  async getSchedules(
    ctx: RequestContext
  ): Promise<StripeSubscriptionSchedule[]> {
    const schedules = await this.connection
      .getRepository(ctx, Schedule)
      .find({ where: { channelId: String(ctx.channelId) } });

    return schedules.map((schedule) => {
      return cloneSchedule(ctx, schedule);
    });
  }

  async upsert(
    ctx: RequestContext,
    input: UpsertStripeSubscriptionScheduleInput
  ): Promise<StripeSubscriptionSchedule> {
    this.validate(input);
    const { id } = await this.connection.getRepository(ctx, Schedule).save({
      ...input,
      channelId: String(ctx.channelId),
    } as Schedule);
    const schedule = await this.connection
      .getRepository(ctx, Schedule)
      .findOneOrFail({ where: { id } });

    return cloneSchedule(ctx, schedule);
  }

  async delete(ctx: RequestContext, scheduleId: ID): Promise<void> {
    const { id } = await this.connection.rawConnection
      .getRepository(Schedule)
      .findOneOrFail({
        where: {
          id: scheduleId,
          channelId: ctx.channelId!,
        },
      });
    await this.connection.getRepository(ctx, Schedule).delete({ id });
  }

  validate(input: UpsertStripeSubscriptionScheduleInput): void {
    if (
      input.billingInterval === input.durationInterval &&
      input.billingCount === input.durationCount &&
      input.downpayment
    ) {
      throw new UserInputError(
        `Paid up front schedules can not have downpayments. When duration and billing intervals are the same your schedule is a paid-up-front schedule.`
      );
    }
    if (
      input.startMoment === SubscriptionStartMoment.FixedStartdate &&
      !input.fixedStartDate
    ) {
      throw new UserInputError(
        `Schedules with a fixed start date require a selected startDate`
      );
    }
    if (
      input.startMoment === SubscriptionStartMoment.FixedStartdate &&
      input.useProration
    ) {
      throw new UserInputError(
        `Schedules with a fixed start date cannot use proration`
      );
    }
  }
}
