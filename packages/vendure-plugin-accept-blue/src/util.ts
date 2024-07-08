import { Subscription } from '../../util/src/subscription/subscription-strategy';
import {
  AcceptBlueRefundResult,
  AcceptBlueRefundStatus,
} from './api/generated/graphql';
import {
  AcceptBlueTransaction,
  AccountType,
  CheckPaymentMethodInput,
  Frequency,
  NoncePaymentMethodInput,
  SavedPaymentMethodInput,
} from './types';

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
  name: string;
  routing_number: string;
  account_type?: AccountType;
  sec_code?: string;
}

export function isSameCard(
  card1: MaskedCardInput,
  card2: MaskedCardInput
): boolean {
  return (
    card1.last4 === card2.last4 &&
    card1.expiry_month === card2.expiry_month &&
    card1.expiry_year === card2.expiry_year
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
  if (interval === 'month' && intervalCount === 6) {
    return 'biannually';
  }
  throw new Error(
    `Subscription interval '${interval}' and intervalCount '${intervalCount}' cannot be mapped to any of these frequencies: weekly, biweekly, monthly, bimonthly, quarterly, annually or biannually`
  );
}

/**
 * Revert a frequency from Accept Blue back to an interval and interval count
 */
export function toSubscriptionInterval(frequency: Frequency): {
  interval: 'week' | 'month' | 'year';
  intervalCount: number;
} {
  if (frequency === 'weekly') {
    return { interval: 'week', intervalCount: 1 };
  } else if (frequency === 'biweekly') {
    return { interval: 'week', intervalCount: 2 };
  } else if (frequency === 'monthly') {
    return { interval: 'month', intervalCount: 1 };
  } else if (frequency === 'bimonthly') {
    return { interval: 'month', intervalCount: 2 };
  } else if (frequency === 'quarterly') {
    return { interval: 'month', intervalCount: 3 };
  } else if (frequency === 'annually') {
    return { interval: 'year', intervalCount: 1 };
  } else if (frequency === 'biannually') {
    return { interval: 'year', intervalCount: 2 };
  } else {
    throw Error(
      `Frequency '${frequency}' cannot be mapped to an interval and interval count`
    );
  }
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

export function isNoncePaymentMethod(input: NoncePaymentMethodInput): boolean {
  return !!(
    input.source &&
    input.expiry_year &&
    input.expiry_month &&
    input.last4
  );
}

export function isCheckPaymentMethod(input: CheckPaymentMethodInput): boolean {
  return !!(
    input.account_number &&
    input.routing_number &&
    input.name &&
    input.sec_code &&
    input.account_type
  );
}

export function isSavedPaymentMethod(input: SavedPaymentMethodInput): boolean {
  return !!input.paymentMethodId;
}

export function toGraphqlRefundStatus(
  status: AcceptBlueTransaction['status']
): AcceptBlueRefundResult['status'] {
  switch (status) {
    case 'Partially Approved':
      return 'PartiallyApproved';
    default:
      return status;
  }
}
