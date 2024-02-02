import { Subscription } from '../../util/src/subscription/subscription-strategy';
import { Frequency } from './types';

interface CardInput {
  card: string;
  expiry_month: number;
  expiry_year: number;
}

interface CardToCheck {
  last4: string;
  expiry_month: number;
  expiry_year: number;
}

export function isSameCard(input: CardInput, card: CardToCheck): boolean {
  return (
    input.card.endsWith(card.last4) &&
    input.expiry_month === card.expiry_month &&
    input.expiry_year === card.expiry_year
  );
}
/**
 * Map a subscription interval and interval count to an Accept Blue frequency
 * 'biweekly' in this context means every two weeks
 */
export function toAcceptBlueFrequency(subscription: Subscription): Frequency {
  const {
    recurring: { interval, intervalCount },
  } = subscription;
  if (interval === 'week' && intervalCount === 1) {
    return 'weekly';
  }
  if (interval === 'week' && intervalCount === 2) {
    return 'biweekly';
  }
  if (interval === 'month' && intervalCount === 1) {
    return 'monthly';
  }
  if (interval === 'month' && intervalCount === 2) {
    return 'bimonthly';
  }
  if (interval === 'month' && intervalCount === 3) {
    return 'quarterly';
  }
  if (interval === 'year' && intervalCount === 1) {
    return 'annually';
  }
  if (interval === 'year' && intervalCount === 2) {
    return 'biannually';
  }
  throw new Error(
    `Subscription interval '${interval}' and intervalCount '${intervalCount}' cannot be mapped to any of these frequencies: weekly, biweekly, monthly, bimonthly, quarterly, annually or biannually`
  );
}

/**
 * Get the number of billing cycles between start and end date for the given frequency
 */
export function getNrOfBillingCyclesLeft(
  startDate: Date,
  endDate: Date,
  frequency: Frequency
): number {
  const diff = endDate.getTime() - startDate.getTime();
  const diffInDays = diff / (1000 * 3600 * 24);
  const nrOfBillingCyclesLeft = Math.floor(
    diffInDays / getDaysBetweenBillingCycles(frequency)
  );
  return nrOfBillingCyclesLeft;
}

export function getDaysBetweenBillingCycles(frequency: Frequency): number {
  switch (frequency) {
    case 'weekly':
      return 7;
    case 'biweekly':
      return 14;
    case 'monthly':
      return 30;
    case 'bimonthly':
      return 60;
    case 'quarterly':
      return 90;
    case 'annually':
      return 365;
    case 'biannually':
      return 730;
    default:
      throw Error(`Frequency '${frequency}' is not a valid frequency`);
  }
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}
