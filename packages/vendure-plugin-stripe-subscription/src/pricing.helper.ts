import {
  StripeSubscriptionPricing,
  StripeSubscriptionPricingInput,
  SubscriptionInterval,
  SubscriptionStartMoment,
} from './ui/generated/graphql';
import { UserInputError } from '@vendure/core';
import { VariantWithSubscriptionFields } from './subscription-custom-fields';
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
import { Schedule } from './schedule.entity';

export type VariantForCalculation = Pick<
  VariantWithSubscriptionFields,
  'id' | 'priceWithTax' | 'customFields'
>;

/**
 * Calculate subscription pricing based on variants, schedules and optional input
 */
export function calculateSubscriptionPricing(
  variant: VariantForCalculation,
  input?: Pick<
    StripeSubscriptionPricingInput,
    'downpaymentWithTax' | 'startDate'
  >
): StripeSubscriptionPricing {
  if (!variant.priceWithTax) {
    throw Error(
      `Variant "${variant.id}" has price ${variant.priceWithTax}, can not calculate subscription pricing without variant price`
    );
  }
  const schedule = variant.customFields.subscriptionSchedule;
  if (!schedule) {
    throw new UserInputError(
      `Variant ${variant.id} doesn't have a schedule attached`
    );
  }
  const billingsPerDuration = getBillingsPerDuration(schedule);
  let downpayment = schedule.downpaymentWithTax;
  if (input?.downpaymentWithTax || input?.downpaymentWithTax === 0) {
    downpayment = input.downpaymentWithTax;
  }
  if (schedule.paidUpFront && schedule.downpaymentWithTax) {
    // Paid-up-front subscriptions cant have downpayments
    throw new UserInputError(
      `Paid-up-front subscriptions can not have downpayments!`
    );
  }
  if (schedule.paidUpFront && downpayment) {
    throw new UserInputError(
      `You can not use downpayments with Paid-up-front subscriptions`
    );
  }
  const totalSubscriptionPrice =
    variant.priceWithTax * billingsPerDuration + schedule.downpaymentWithTax;
  if (downpayment > totalSubscriptionPrice) {
    throw new UserInputError(
      `Downpayment can not be higher than the total subscription value, which is (${printMoney(
        totalSubscriptionPrice
      )})`
    );
  }
  if (downpayment < schedule.downpaymentWithTax) {
    throw new UserInputError(
      `Downpayment can not be lower than schedules default downpayment, which is (${printMoney(
        schedule.downpaymentWithTax
      )})`
    );
  }
  const dayRate = getDayRate(
    totalSubscriptionPrice,
    schedule.durationInterval!,
    schedule.durationCount!
  );
  const now = new Date();
  let subscriptionStartDate = getNextStartDate(
    now,
    schedule.billingInterval,
    schedule.startMoment,
    schedule.fixedStartDate
  );
  const daysUntilStart = getDaysUntilNextStartDate(
    input?.startDate || now,
    subscriptionStartDate
  );
  if (schedule.paidUpFront) {
    // If paid up front, move the startDate to next cycle. This needs to happen AFTER proration calculation
    subscriptionStartDate = getNextCyclesStartDate(
      new Date(),
      schedule.startMoment,
      schedule.durationInterval,
      schedule.durationCount
    );
  }
  const totalProratedAmount = daysUntilStart * dayRate;
  let amountDueNow = downpayment + totalProratedAmount;
  let recurringPrice = Math.floor(
    (totalSubscriptionPrice - downpayment) / billingsPerDuration
  );
  if (schedule.paidUpFront) {
    // User pays for the full membership now
    amountDueNow = variant.priceWithTax + totalProratedAmount;
    recurringPrice = variant.priceWithTax;
  }
  return {
    variantId: variant.id as string,
    downpaymentWithTax: downpayment,
    totalProratedAmountWithTax: totalProratedAmount,
    proratedDays: daysUntilStart,
    dayRateWithTax: dayRate,
    recurringPriceWithTax: recurringPrice,
    interval: schedule.billingInterval,
    intervalCount: schedule.billingCount,
    amountDueNowWithTax: amountDueNow,
    subscriptionStartDate,
    schedule: {
      ...schedule,
      id: String(schedule.id),
      paidUpFront: schedule.paidUpFront,
    },
  };
}

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
 * Get the next startDate for a given start moment (first or last of the Interval). Always returns the middle of the day for billing
 */
export function getNextStartDate(
  now: Date,
  interval: SubscriptionInterval,
  startMoment: SubscriptionStartMoment,
  fixedStartDate?: Date
): Date {
  if (startMoment === SubscriptionStartMoment.TimeOfPurchase) {
    return now;
  } else if (startMoment === SubscriptionStartMoment.FixedStartdate) {
    if (!fixedStartDate) {
      throw Error(
        `With a 'Fixed start date' startMoment, the 'fixedStartDate' argument is mandatory`
      );
    }
    return fixedStartDate;
  }
  let nextStartDate = new Date();
  if (interval === SubscriptionInterval.Month) {
    if (startMoment === SubscriptionStartMoment.StartOfBillingInterval) {
      const nextMonth = addMonths(now, 1);
      nextStartDate = startOfMonth(nextMonth);
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
  return getMiddleOfDay(nextStartDate);
}

/**
 * Get the next cycles startDate. Used for paid-up-front subscriptions, where a user already paid for the first cycle
 * and we need the next cycles start date
 */
export function getNextCyclesStartDate(
  now: Date,
  startMoment: SubscriptionStartMoment,
  interval: SubscriptionInterval,
  intervalCount: number,
  fixedStartDate?: Date
): Date {
  let oneCycleFromNow = new Date(now);
  if (interval === SubscriptionInterval.Month) {
    oneCycleFromNow = addMonths(oneCycleFromNow, intervalCount);
  } else {
    // Week
    oneCycleFromNow = addWeeks(oneCycleFromNow, intervalCount);
  }
  return getNextStartDate(
    oneCycleFromNow,
    interval,
    startMoment,
    fixedStartDate
  );
}

/**
 * Return the middle of the day (13:00) for dates, because that makes more sense for billing
 */
export function getMiddleOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(13, 0, 0, 0);
  return start;
}

/**
 * Get the number of billings per full duration of the schedule
 */
export function getBillingsPerDuration(
  schedule: Pick<
    Schedule,
    'durationInterval' | 'durationCount' | 'billingInterval' | 'billingCount'
  >
): number {
  if (
    schedule.durationInterval === SubscriptionInterval.Week &&
    schedule.billingInterval === SubscriptionInterval.Month
  ) {
    throw new UserInputError(
      `Billing interval must be greater or equal to duration interval. E.g. billing cannot occur monthly for a schedule with a duration of 3 weeks.`
    );
  }
  if (schedule.billingInterval === schedule.durationInterval) {
    return schedule.durationCount / schedule.billingCount;
  }
  if (
    schedule.billingInterval === SubscriptionInterval.Week &&
    schedule.durationInterval === SubscriptionInterval.Month
  ) {
    return (4 / schedule.billingCount) * schedule.durationCount;
  }
  throw Error(
    `Can not calculate billingsPerDurations for billingInterval ${schedule.billingInterval} and durationInterval ${schedule.durationInterval}`
  );
}

/**
 * Yes, it's real, this helper function prints money for you!
 */
export function printMoney(amount: number): string {
  return (amount / 100).toFixed(2);
}
