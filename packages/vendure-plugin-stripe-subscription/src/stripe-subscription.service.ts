import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import { RequestContext } from '@vendure/core';

@Injectable()
export class StripeSubscriptionService {
  createPaymentIntent(ctx: RequestContext, paymentMethodCode: string) {
    // Get paymentmethod by code
    // Get apiKey from method
    // get products from activeOrder
    // Get or create subscriptions based on products in activeOrder https://stripe.com/docs/billing/subscriptions/multiple-products
    // Create paymentLink for created subscriptions: https://stripe.com/docs/payments/payment-links/api
  }
}
