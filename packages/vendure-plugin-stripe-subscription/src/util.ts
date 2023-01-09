import {
  addMonths,
  addWeeks,
  differenceInDays,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import {
  SubscriptionInterval,
  SubscriptionStartMoment,
} from './ui/generated/graphql';

/**
 * Calculate day rate based on the total price and duration of the subscription
 * Example: $200 per 6 months
 *          = $400 per 12 months
 *          $400 / 365 = $1,10 per day
 */
export function getDayRate(
  totalPrice: number,
  durationInterval: SubscriptionInterval,
  durationCount: number
): number {
  let intervalsPerYear = 12; // Default is 1 month
  if (durationInterval === SubscriptionInterval.Week) {
    intervalsPerYear = 52;
  }
  const pricePerYear = (intervalsPerYear / durationCount) * totalPrice;
  return Math.round(pricePerYear / 365);
}

export function getDaysUntilNextStartDate(
  now: Date,
  nextStartDate: Date
): number {
  const startOfToday = startOfDay(now);
  return differenceInDays(nextStartDate, startOfToday);
}

/**
 * Get the next startDate for a given start moment (first or last of the Interval)
 */
export function getNextStartDate(
  now: Date,
  interval: SubscriptionInterval,
  startMoment: SubscriptionStartMoment
): Date {
  const startOfToday = startOfDay(now);
  if (startMoment === SubscriptionStartMoment.TimeOfPurchase) {
    return new Date();
  }
  let nextStartDate = new Date();
  if (interval === SubscriptionInterval.Month) {
    const nextMonth = new Date(
      startOfToday.getFullYear(),
      startOfToday.getMonth() + 1,
      1
    );
    nextStartDate =
      startMoment === SubscriptionStartMoment.StartOfBillingInterval
        ? startOfMonth(nextMonth)
        : endOfMonth(startOfToday);
  } else if (interval === SubscriptionInterval.Week) {
    const nextWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
    nextStartDate =
      startMoment === SubscriptionStartMoment.StartOfBillingInterval
        ? startOfWeek(nextWeek)
        : endOfWeek(startOfToday);
  }
  return nextStartDate;
}

/**
 * Get the next cycles startDate. Used for paid-up-front subscriptions, where a user already paid for the first cycle
 */
export function getNextCyclesStartDate(
  now: Date,
  startMoment: SubscriptionStartMoment,
  interval: SubscriptionInterval,
  intervalCount: number
): Date {
  let oneCycleFromNow = new Date(startOfDay(now));
  if (interval === SubscriptionInterval.Month) {
    oneCycleFromNow = addMonths(oneCycleFromNow, intervalCount);
  } else {
    // Week
    oneCycleFromNow = addWeeks(oneCycleFromNow, intervalCount);
  }
  return getNextStartDate(oneCycleFromNow, interval, startMoment);
}

/**
 * Yes, it's real, this helper function prints money for you!
 */
export function printMoney(amount: number): string {
  return (amount / 100).toFixed(2);
}
