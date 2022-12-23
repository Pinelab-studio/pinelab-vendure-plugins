import Stripe from 'stripe';
import { CustomerWithSubscriptionFields } from './subscription-custom-fields';

interface SubscriptionInput {
  customerId: string;
  productId: string;
  currencyCode: string;
  amount: number;
  interval: Stripe.SubscriptionCreateParams.Item.PriceData.Recurring.Interval;
  intervalCount: number;
  paymentMethodId: string;
}

/**
 * Wrapper around the Stripe client with specifics for this subscription plugin
 */
export class StripeClient extends Stripe {
  async getOrCreateClient(
    customer: CustomerWithSubscriptionFields
  ): Promise<Stripe.Customer> {
    if (customer.customFields?.stripeCustomerId) {
      const stripeCustomer = await this.customers.retrieve(
        customer.customFields.stripeCustomerId
      );
      if (stripeCustomer && !stripeCustomer.deleted) {
        return stripeCustomer as Stripe.Customer;
      }
    }
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

  async createOffSessionSubscription({
    customerId,
    productId,
    currencyCode,
    amount,
    interval,
    intervalCount,
    paymentMethodId,
  }: SubscriptionInput): Promise<Stripe.Subscription> {
    return this.subscriptions.create({
      customer: customerId,
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
    });
  }
}
