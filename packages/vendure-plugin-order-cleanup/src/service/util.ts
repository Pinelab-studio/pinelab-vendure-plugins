import { Channel } from '@vendure/core';
import { Cron } from 'croner';

export const ORDER_CLEANUP_PAGE_SIZE = 1000;
export const ORDER_CLEANUP_PROCESSING_LIMIT = 10000;

/**
 * Convert date object to only the date part.
 */
export function toReadableDate(date?: Date): string | undefined {
  if (!date) {
    return '';
  }
  return date.toISOString().split('T')[0];
}

/**
 * Split an array into batches of at most the requested size.
 */
export function toBatches<T>(array: T[], batchSize: number): T[][] {
  const batches = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Calculate the next cleanup page size without exceeding the per-run limit.
 */
export function getNextPageSize(processedOrders: number): number {
  return Math.min(
    ORDER_CLEANUP_PAGE_SIZE,
    Math.max(0, ORDER_CLEANUP_PROCESSING_LIMIT - processedOrders)
  );
}

/**
 * Resolve the channel in which an order should be loaded and recalculated.
 * Vendure normally assigns an order to the default channel and at most one
 * sales channel, so multiple non-default channels are ambiguous and unsafe.
 */
export function resolveOrderCleanupChannel(
  assignedChannels: Channel[],
  defaultChannel: Channel
): Channel {
  const salesChannels = assignedChannels.filter(
    (channel) => String(channel.id) !== String(defaultChannel.id)
  );
  if (salesChannels.length > 1) {
    throw new Error(
      `Order is assigned to multiple non-default channels: ${salesChannels
        .map((channel) => channel.id)
        .join(', ')}`
    );
  }
  return salesChannels[0] ?? defaultChannel;
}

/**
 * Return whether the configured five-field cron expression matches the given
 * instant in the configured IANA timezone.
 */
export function isCronDue(
  cron: string,
  timezone: string,
  now: Date = new Date()
): boolean {
  const minute = new Date(now);
  minute.setUTCSeconds(0, 0);
  return new Cron(cron, { paused: true, timezone }).match(minute);
}

/**
 * Validate that a cron expression uses the minute-level five-field form.
 */
export function validateCron(cron: string, timezone: string): void {
  if (cron.trim().split(/\s+/).length !== 5) {
    throw new Error(
      'Order cleanup schedule.cron must be a five-field cron expression'
    );
  }
  new Cron(cron, { paused: true, timezone });
}

/**
 * Validate an IANA timezone without changing the process-wide timezone.
 */
export function validateTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
  } catch {
    throw new Error(
      `Order cleanup schedule.timezone must be a valid IANA timezone: ${timezone}`
    );
  }
}
