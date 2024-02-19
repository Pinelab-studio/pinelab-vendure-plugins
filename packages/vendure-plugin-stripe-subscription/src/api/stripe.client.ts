import { Customer } from '@vendure/core';
import Stripe from 'stripe';

interface SubscriptionInput {
  customerId: string;
  productId: string;
  currencyCode: string;
  amount: number;
  interval: Stripe.SubscriptionCreateParams.Item.PriceData.Recurring.Interval;
  intervalCount: number;
  paymentMethodId: string;
  startDate: Date;
  orderCode: string;
  channelToken: string;
  endDate?: Date;
  description?: string;
}

/**
 * Wrapper around the Stripe client with specifics for this subscription plugin
 */
export class StripeClient extends Stripe {
  constructor(
    public webhookSecret: string,
    apiKey: string,
    config: Stripe.StripeConfig,
  ) {
    super(apiKey, config);
  }

  async getOrCreateCustomer(customer: Customer): Promise<Stripe.Customer> {
    const stripeCustomers = await this.customers.list({
      email: customer.emailAddress,
    });
    if (stripeCustomers.data.length > 0) {
      return stripeCustomers.data[0];
    }
    return await this.customers.create({
      email: customer.emailAddress,
      name: `${customer.firstName} ${customer.lastName}`,
    });
  }

  /**
   * Throws an error if incoming webhook signature is invalid
   */
  validateWebhookSignature(
    payload: Buffer,
    signature: string | undefined,
  ): void {
    if (!signature) {
      throw Error(`Can not validate webhook signature without a signature!`);
    }
    this.webhooks.constructEvent(payload, signature, this.webhookSecret);
  }

  async createOffSessionSubscription({
    customerId,
    productId,
    currencyCode,
    amount,
    interval,
    intervalCount,
    paymentMethodId,
    startDate,
    endDate,
    description,
    orderCode,
    channelToken,
  }: SubscriptionInput): Promise<Stripe.Subscription> {
    return this.subscriptions.create({
      customer: customerId,
      // billing_cycle_anchor: this.toStripeTimeStamp(startDate),
      cancel_at: endDate ? this.toStripeTimeStamp(endDate) : undefined,
      // We start the subscription now, but the first payment will be at the start date.
      // This is because we can ask the customer to pay the first month during checkout, via one-time-payment
      trial_end: this.toStripeTimeStamp(startDate),
      proration_behavior: 'none',
      description: description,
      items: [
        {
          price_data: {
            product: productId,
            currency: currencyCode,
            unit_amount: amount,
            recurring: {
              interval: interval,
              interval_count: intervalCount,
            },
          },
        },
      ],
      off_session: true,
      default_payment_method: paymentMethodId,
      payment_behavior: 'allow_incomplete',
      metadata: {
        orderCode,
        channelToken,
      },
    });
  }

  toStripeTimeStamp(date: Date): number {
    return Math.round(date.getTime() / 1000);
  }
}
