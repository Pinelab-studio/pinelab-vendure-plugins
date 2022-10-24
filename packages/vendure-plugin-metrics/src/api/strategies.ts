import {
  Injector,
  ListQueryBuilder,
  Logger,
  Order,
  RequestContext,
  Session,
  TransactionalConnection,
} from '@vendure/core';
import { Metric, MetricInterval } from '../ui/generated/graphql';
import { generatePublicId } from '@vendure/core/dist/common/generate-public-id';
import { Between, IsNull, Not } from 'typeorm';
import { loggerCtx } from '../constants';

/**
 * Data loaded in this function is passed to all strategies.
 * For example: Load all placed orders if you want to show orders per month/week
 */
export type MetricDataLoaderFunction<T> = (
  ctx: RequestContext,
  injector: Injector,
  startDate: Date,
  endDate: Date
) => Promise<T>;

/**
 * Calculate your metric data based on the given input.
 * Be careful with heavy queries and calculations,
 * as this function is executed everytime a user views its dashboard
 *
 */
export type MetricCalculation<T> = (
  ctx: RequestContext,
  injector: Injector,
  interval: MetricInterval,
  data: T
) => Promise<Metric>;

export type DefaultData = {
  orders: Order[];
  sessions: Session[];
};

/**
 * Default data loader that fetches placed Orders and Sessions, so we can calculate:
 * Average order value, Conversion and placed orders per month/week
 */
export const defaultDataLoader: MetricDataLoaderFunction<DefaultData> = async (
  ctx,
  injector,
  startDate,
  endDate
) => {
  const listBuilder = injector.get(ListQueryBuilder);
  const ordersPromise = listBuilder
    .build(
      Order,
      {},
      {
        ctx,
        relations: [],
        channelId: ctx.channelId,
        /*    where: {
      orderPlacedAt: Not(IsNull())
    }*/
      }
    )
    .getManyAndCount();
  const connection = injector.get(TransactionalConnection);
  const sessionPromise = connection.rawConnection.getRepository(Session).count({
    updatedAt: Between(startDate.toISOString(), endDate.toISOString()),
  });
  const [[orders, nrOfOrders], sessions] = await Promise.all([
    ordersPromise,
    sessionPromise,
  ]);
  console.log('Orders', JSON.stringify(orders[0]));
  console.log('Sesions', sessions);
  if (nrOfOrders > orders.length) {
    Logger.error(
      `Too many orders, only using first ${orders.length} orders.`,
      loggerCtx
    );
  }
  return {
    orders: [],
    sessions: [],
  };
};

export const averageOrderValueMetric: MetricCalculation<DefaultData> = async (
  ctx,
  injector,
  interval,
  data
) => {
  return {
    id: generatePublicId(),
    title: `Average order value in ${ctx.channel.currencyCode}`,
    data: [
      {
        label: 'Jan',
        value: 123,
      },
    ],
  };
};
