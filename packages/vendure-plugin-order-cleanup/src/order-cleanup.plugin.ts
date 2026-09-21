import {
  PluginCommonModule,
  ScheduledTask,
  Type,
  VendurePlugin,
} from '@vendure/core';
import { OrderCleanupService } from './service/order-cleanup.service';
import { ORDER_CLEANUP_OPTIONS } from './constants';
import { isCronDue, validateCron, validateTimezone } from './service/util';

export interface OrderCleanupScheduleOptions {
  /**
   * @description
   * Five-field cron expression evaluated in {@link timezone}.
   * @default '0 3 * * *'
   */
  cron?: string;
  /**
   * @description
   * IANA timezone used when evaluating {@link cron}.
   * @default 'Europe/Amsterdam'
   */
  timezone?: string;
  /**
   * @description
   * Vendure scheduled-task timeout.
   * @default '1h'
   */
  timeout?: string | number;
}

export interface OrderCleanupPluginOptions {
  /**
   * @description
   * Orders not updated in the given number of days will be emptied.
   */
  olderThanDays: number;
  /**
   * @description
   * Number of orders to empty concurrently in each batch.
   * Reduce to 1 when using SQLite (e.g. in tests), since SQLite's single
   * connection cannot handle concurrent transactions.
   * @default 10
   */
  batchSize?: number;
  /**
   * @description
   * Configures when automatic cleanup runs.
   */
  schedule?: OrderCleanupScheduleOptions;
}

export interface NormalizedOrderCleanupPluginOptions {
  olderThanDays: number;
  batchSize: number;
  schedule: Required<OrderCleanupScheduleOptions>;
}

export const DEFAULT_ORDER_CLEANUP_OPTIONS: NormalizedOrderCleanupPluginOptions =
  {
    olderThanDays: 30,
    batchSize: 10,
    schedule: {
      cron: '0 3 * * *',
      timezone: 'Europe/Amsterdam',
      timeout: '1h',
    },
  };

/**
 * Validate and apply defaults to the public plugin options.
 */
export function normalizeOrderCleanupOptions(
  options: OrderCleanupPluginOptions
): NormalizedOrderCleanupPluginOptions {
  const normalized: NormalizedOrderCleanupPluginOptions = {
    ...DEFAULT_ORDER_CLEANUP_OPTIONS,
    ...options,
    schedule: {
      ...DEFAULT_ORDER_CLEANUP_OPTIONS.schedule,
      ...options.schedule,
    },
  };
  if (
    !Number.isFinite(normalized.olderThanDays) ||
    normalized.olderThanDays < 0
  ) {
    throw new Error('Order cleanup olderThanDays must be zero or greater');
  }
  if (!Number.isInteger(normalized.batchSize) || normalized.batchSize < 1) {
    throw new Error('Order cleanup batchSize must be a positive integer');
  }
  validateTimezone(normalized.schedule.timezone);
  validateCron(normalized.schedule.cron, normalized.schedule.timezone);
  return normalized;
}

/**
 * Create the Vendure scheduled task which directly performs order cleanup.
 */
export function createOrderCleanupTask(
  options: NormalizedOrderCleanupPluginOptions
): ScheduledTask {
  return new ScheduledTask({
    id: 'order-cleanup',
    description: 'Empty stale active orders while preserving their state',
    schedule: '* * * * *',
    timeout: options.schedule.timeout,
    preventOverlap: true,
    params: options,
    async execute({ injector, scheduledContext, params }) {
      const checkedAt = new Date();
      if (
        !isCronDue(params.schedule.cron, params.schedule.timezone, checkedAt)
      ) {
        return {
          scheduleSkipped: true,
          checkedAt: checkedAt.toISOString(),
          cron: params.schedule.cron,
          timezone: params.schedule.timezone,
        };
      }
      const result = await injector
        .get(OrderCleanupService)
        .emptyStaleOrders(
          scheduledContext,
          params.olderThanDays,
          params.batchSize
        );
      return {
        scheduleSkipped: false,
        checkedAt: checkedAt.toISOString(),
        cron: params.schedule.cron,
        timezone: params.schedule.timezone,
        ...result,
      };
    },
  });
}

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    OrderCleanupService,
    {
      provide: ORDER_CLEANUP_OPTIONS,
      useFactory: () => OrderCleanupPlugin.options,
    },
  ],
  configuration: (config) => {
    config.schedulerOptions.tasks.push(
      createOrderCleanupTask(OrderCleanupPlugin.options)
    );
    return config;
  },
})
export class OrderCleanupPlugin {
  private static options: NormalizedOrderCleanupPluginOptions =
    DEFAULT_ORDER_CLEANUP_OPTIONS;

  static init(options: OrderCleanupPluginOptions): Type<OrderCleanupPlugin> {
    OrderCleanupPlugin.options = normalizeOrderCleanupOptions(options);
    return OrderCleanupPlugin;
  }
}
