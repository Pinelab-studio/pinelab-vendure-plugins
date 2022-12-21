import Stripe from 'stripe';
import { ProductVariant } from '@vendure/core';
import { VariantWithSubscriptionFields } from './subscription-custom-fields';

/**
 * Wrapper around the Stripe client with specifics for this subscription plugin
 */
export class StripeClient extends Stripe {
  // FIXME do we really want to pre-generate prices? Maybe only day-rate?
  /*        // Create day rate
          const dayRate = await stripeClient.prices.create({
            product: product.id,
            nickname: 'Day rate',
            unit_amount: subscription.subscriptionDayRate,
            currency: ctx.channel.currencyCode,
            recurring: {interval: 'day'},
          });
          variant.customFields.subscriptionDayRatePriceId = dayRate.id;
          if (subscription.subscriptionInterval === SubscriptionInterval.PAID_IN_FULL) {
            return;
          }
          // Create yearly downpayment
          const downpaymentPrice = await stripeClient.prices.create({
            product: product.id,
            nickname: 'Recurring ',
            unit_amount: subscription.downpayment,
            currency: ctx.channel.currencyCode,
            recurring: {interval: subscription.subscriptionInterval, interval_count: subscription.subscriptionIntervalCount},
          });
          variant.customFields.stripeDownpaymentPriceId = downpaymentPrice.id;
          // Create recurring membership price
          const recurring = await stripeClient.prices.create({
            product: product.id,
            unit_amount: variant.customFields.downpayment,
            currency: ctx.channel.currencyCode,
            recurring: {interval: 'year'},
          });
          variant.customFields.stripeDownpaymentPriceId = downpaymentPrice.id;
          // Create stripeRecurringPriceId
          // TODO save reference of prices*/
}
