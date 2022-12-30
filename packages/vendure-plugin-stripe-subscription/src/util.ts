import {
  differenceInDays,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import {
  SubscriptionBillingInterval,
  SubscriptionDurationInterval,
  SubscriptionStartMoment,
} from './generated/graphql';

/**
 * Calculate day rate based on the total price and duration of the subscription
 * Example: $200 per 6 months
 *          = $400 per 12 months
 *          $400 / 365 = $1,10 per day
 */
export function getDayRate(
  totalPrice: number,
  durationInterval: SubscriptionDurationInterval,
  durationCount: number
): number {
  let intervalsPerYear = 1; // Default is 1 year
  if (durationInterval === SubscriptionDurationInterval.Month) {
    intervalsPerYear = 12;
  } else if (durationInterval === SubscriptionDurationInterval.Week) {
    intervalsPerYear = 52;
  } else if (durationInterval === SubscriptionDurationInterval.Day) {
    intervalsPerYear = 365;
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
  interval: SubscriptionBillingInterval,
  startMoment: SubscriptionStartMoment
): Date {
  const startOfToday = startOfDay(now);
  if (startMoment === SubscriptionStartMoment.TimeOfPurchase) {
    return new Date();
  }
  let nextStartDate = new Date();
  if (interval === SubscriptionBillingInterval.Month) {
    const nextMonth = new Date(
      startOfToday.getFullYear(),
      startOfToday.getMonth() + 1,
      1
    );
    nextStartDate =
      startMoment === SubscriptionStartMoment.StartOfBillingInterval
        ? startOfMonth(nextMonth)
        : endOfMonth(startOfToday);
  } else if (interval === SubscriptionBillingInterval.Week) {
    const nextWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
    nextStartDate =
      startMoment === SubscriptionStartMoment.StartOfBillingInterval
        ? startOfWeek(nextWeek)
        : endOfWeek(startOfToday);
  }
  return nextStartDate;
}

export function printMoney(amount: number): string {
  return (amount / 100).toFixed(2);
}
