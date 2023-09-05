import { Injectable } from '@nestjs/common';
import {
  ID,
  ListQueryBuilder,
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import {
  StripeSubscriptionSchedule,
  StripeSubscriptionScheduleList,
  StripeSubscriptionScheduleListOptions,
  SubscriptionStartMoment,
  UpsertStripeSubscriptionScheduleInput,
} from '../ui/generated/graphql';
import { cloneSchedule } from './pricing.helper';
import { Schedule } from './schedule.entity';

@Injectable()
export class ScheduleService {
  constructor(
    private listQueryBuilder: ListQueryBuilder,
    private connection: TransactionalConnection
  ) {}

  async getSchedules(
    ctx: RequestContext,
    options: StripeSubscriptionScheduleListOptions
  ): Promise<StripeSubscriptionScheduleList> {
    return this.listQueryBuilder
      .build(Schedule, options, { ctx })
      .getManyAndCount()
      .then(([items, totalItems]) => ({
        items: items.map((schedule) => {
          return cloneSchedule(ctx, schedule);
        }),
        totalItems,
      }));
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

  async delete(ctx: RequestContext, scheduleId: string): Promise<void> {
    const { id } = await this.connection.rawConnection
      .getRepository(Schedule)
      .findOneOrFail({
        where: {
          id: scheduleId,
          channelId: ctx.channelId as string,
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
