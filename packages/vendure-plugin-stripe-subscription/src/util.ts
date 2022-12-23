import {
  startOfMonth,
  endOfMonth,
  differenceInDays,
  startOfWeek,
  endOfWeek,
  startOfDay,
} from 'date-fns';
import { SubscriptionBillingInterval } from './generated/graphql';
import { DurationInterval, StartDate } from './schedules';

/**
 * Calculate day rate based on the total price and duration of the subscription
 * Example: $200 per 6 months
 *          = $400 per 12 months
 *          $400 / 365 = $1,10 per day
 */
export function getDayRate(
  totalPrice: number,
  durationInterval: DurationInterval,
  durationCount: number
): number {
  let intervalsPerYear = 1; // Default is 1 year
  if (durationInterval === DurationInterval.Month) {
    intervalsPerYear = 12;
  } else if (durationInterval === DurationInterval.week) {
    intervalsPerYear = 52;
  } else if (durationInterval === DurationInterval.Day) {
    intervalsPerYear = 365;
  }
  const pricePerYear = (intervalsPerYear / durationCount) * totalPrice;
  return Math.round(pricePerYear / 365);
}

export function getDaysUntilNextStartDate(
  now: Date,
  interval: SubscriptionBillingInterval,
  startMoment: StartDate
): number {
  const startOfToday = startOfDay(now);
  let nextStartDate = new Date();
  if (interval === SubscriptionBillingInterval.Month) {
    const nextMonth = new Date(
      startOfToday.getFullYear(),
      startOfToday.getMonth() + 1,
      1
    );
    nextStartDate =
      startMoment === StartDate.START
        ? startOfMonth(nextMonth)
        : endOfMonth(startOfToday);
  } else if (interval === SubscriptionBillingInterval.Week) {
    const nextWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
    nextStartDate =
      startMoment === StartDate.START
        ? startOfWeek(nextWeek)
        : endOfWeek(startOfToday);
  }
  return differenceInDays(nextStartDate, startOfToday);
}

export function printMoney(amount: number): string {
  return (amount / 100).toFixed(2);
}
