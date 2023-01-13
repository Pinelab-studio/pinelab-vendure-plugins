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
 * Get the next startDate for a given start moment (first or last of the Interval). Always returns the start of the day (00:00:000)
 */
export function getNextStartDate(
  now: Date,
  interval: SubscriptionInterval,
  startMoment: SubscriptionStartMoment
): Date {
  if (startMoment === SubscriptionStartMoment.TimeOfPurchase) {
    return now;
  }
  let nextStartDate = new Date();
  if (interval === SubscriptionInterval.Month) {
    if (startMoment === SubscriptionStartMoment.StartOfBillingInterval) {
      const nextMonth = addMonths(now, 1);
      nextStartDate = startOfMonth(nextMonth);
      console.log(`next month ${nextMonth}`);
    } else if (startMoment === SubscriptionStartMoment.EndOfBillingInterval) {
      nextStartDate = endOfMonth(now);
    } else {
      throw Error(
        `Unhandled combination of startMoment=${startMoment} and interval=${interval}`
      );
    }
  } else if (interval === SubscriptionInterval.Week) {
    if (startMoment === SubscriptionStartMoment.StartOfBillingInterval) {
      const nextWeek = addWeeks(now, 1);
      nextStartDate = startOfWeek(nextWeek);
    } else if (startMoment === SubscriptionStartMoment.EndOfBillingInterval) {
      nextStartDate = endOfWeek(now);
    } else {
      throw Error(
        `Unhandled combination of startMoment=${startMoment} and interval=${interval}`
      );
    }
  }
  console.log(`next startdate ${nextStartDate}`);
  console.log(`StartOfDay startdate ${startOfDay(nextStartDate)}`);
  return startOfDay(nextStartDate);
}

/**
 * Get the next cycles startDate. Used for paid-up-front subscriptions, where a user already paid for the first cycle
 * and we need the next cycles start date
 */
export function getNextCyclesStartDate(
  now: Date,
  startMoment: SubscriptionStartMoment,
  interval: SubscriptionInterval,
  intervalCount: number
): Date {
  let oneCycleFromNow = new Date(now);
  oneCycleFromNow.setHours(13); // Set middle of day to prevent daylight saving errors https://github.com/date-fns/date-fns/issues/571
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
