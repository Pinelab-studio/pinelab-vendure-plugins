import { Subscription } from '../../util/src/subscription/subscription-strategy';
import { AccountType, Frequency } from './types';

interface CardInput {
  card: string;
  expiry_month: number;
  expiry_year: number;
}

interface MaskedCardInput {
  last4: string;
  expiry_month: number;
  expiry_year: number;
}

interface CheckInput {
  name: string;
  routing_number: string;
  account_number: string;
  account_type?: AccountType;
  sec_code?: string;
}

interface ObfuscatedCheck {
  last4: string;
  expiry_month: number;
  expiry_year: number;
  name: string;
  routing_number: string;
  account_type?: AccountType;
  sec_code?: string;
}

export function isSameCard(
  input: CardInput | MaskedCardInput,
  card: MaskedCardInput
): boolean {
  if ((input as any).card) {
    return (
      (input as CardInput).card.endsWith(card.last4) &&
      input.expiry_month === card.expiry_month &&
      input.expiry_year === card.expiry_year
    );
  }

  return (
    (input as MaskedCardInput).last4 === card.last4 &&
    input.expiry_month === card.expiry_month &&
    input.expiry_year === card.expiry_year
  );
}
export function isSameCheck(input: CheckInput, check: ObfuscatedCheck) {
  return (
    input.name === check.name &&
    input.routing_number === check.routing_number &&
    input.account_number.endsWith(check.last4) &&
    input.account_type === check.account_type &&
    input.sec_code === check.sec_code
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
