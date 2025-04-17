import { Body, Controller, Headers, Inject, Post, Req } from '@nestjs/common';
import { Logger, OrderService } from '@vendure/core';
import { Request } from 'express';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { StripeSubscriptionPluginOptions } from '../stripe-subscription.plugin';
import { StripeSubscriptionService } from './stripe-subscription.service';
import {
  StripePaymentIntent,
  StripeSetupIntent,
} from './types/stripe-payment-intent';
import { IncomingStripeWebhook } from './types/stripe.common';
import Stripe from 'stripe';

export type RequestWithRawBody = Request & { rawBody: any };

@Controller('stripe-subscriptions')
export class StripeSubscriptionController {
  constructor(
    private stripeSubscriptionService: StripeSubscriptionService,
    private orderService: OrderService,
    @Inject(PLUGIN_INIT_OPTIONS)
    private options: StripeSubscriptionPluginOptions
  ) {}

  @Post('webhook')
  async webhook(@Req() request: RequestWithRawBody): Promise<void> {
    const body = request.body as IncomingStripeWebhook;
    Logger.info(`Incoming webhook ${body.type}`, loggerCtx);
    // Validate if metadata present
    const orderCode =
      body.data.object.metadata?.orderCode ??
      (body.data.object as Stripe.Invoice).lines?.data[0]?.metadata.orderCode;
    const channelToken =
      body.data.object.metadata?.channelToken ??
      (body.data.object as Stripe.Invoice).lines?.data[0]?.metadata
        .channelToken;
    if (!StripeSubscriptionService.webhookEvents.includes(body.type as any)) {
      Logger.info(
        `Received incoming '${body.type}' webhook, not processing this event.`,
        loggerCtx
      );
      return;
    }
    if (!orderCode || !channelToken) {
      // For some reason we get a webhook without metadata first, we ignore it
      return Logger.info(
        `Incoming webhook is missing metadata.orderCode/channelToken, ignoring. We should receive another one with metadata...`,
        loggerCtx
      );
    }
    try {
      const ctx = await this.stripeSubscriptionService.createContext(
        channelToken,
        request
      );
      const order = await this.orderService.findOneByCode(ctx, orderCode);
      if (!order) {
        throw Error(`Cannot find order with code ${orderCode}`); // Throw inside catch block, so Stripe will retry
      }
      if (
        body.type === 'payment_intent.succeeded' ||
        body.type === 'setup_intent.succeeded'
      ) {
        await this.stripeSubscriptionService.handleIntentSucceeded(
          ctx,
          body.data.object as StripePaymentIntent & StripeSetupIntent,
          order
        );
      } else if (
        body.type === 'invoice.payment_failed' ||
        body.type === 'invoice.payment_action_required'
      ) {
        const invoiceObject = body.data.object as Stripe.Invoice;
        await this.stripeSubscriptionService.handleInvoicePaymentFailed(
          ctx,
          invoiceObject.id,
          order
        );
      }
      Logger.info(`Successfully handled webhook ${body.type}`, loggerCtx);
    } catch (error) {
      // Catch all for logging purposes
      Logger.error(
        `Failed to process incoming webhook ${body.type} (${body.id}): ${
          (error as Error)?.message
        }`,
        loggerCtx,
        (error as Error)?.stack
      );
      throw error;
    }
  }
}
