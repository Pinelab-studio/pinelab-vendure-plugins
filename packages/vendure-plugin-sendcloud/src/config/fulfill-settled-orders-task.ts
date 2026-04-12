import { ScheduledTask } from '@vendure/core';
import { SendcloudService } from '../api/sendcloud.service';

/**
 * Scheduled task that finds all PaymentSettled orders placed within the last N days
 * that use the SendCloud fulfillment handler, and transitions them to Delivered.
 *
 * This task is opt-in: add it to `schedulerOptions.tasks` in your Vendure config.
 *
 * @example
 * ```ts
 * import { fulfillSettledOrdersTask } from '@pinelab/vendure-plugin-sendcloud';
 *
 * const config: VendureConfig = {
 *   schedulerOptions: {
 *     tasks: [
 *       fulfillSettledOrdersTask.configure({
 *         params: { settledSinceDays: 14 },
 *       }),
 *     ],
 *   },
 * };
 * ```
 */
export const fulfillSettledOrdersTask = new ScheduledTask({
  id: 'sendcloud-fulfill-settled-orders',
  description:
    'Fulfill settled SendCloud orders to Delivered. Only processes orders in PaymentSettled state with the SendCloud handler.',
  params: {
    /** Number of days to look back for settled orders */
    settledSinceDays: 7,
  },
  schedule: (cron) => cron.everyDayAt(2, 0),
  async execute({ injector, params }) {
    return injector
      .get(SendcloudService)
      .fulfillSettledOrders(params.settledSinceDays);
  },
});
