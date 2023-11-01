import { Body, Controller, Headers, Inject, Post, Req } from '@nestjs/common';
import { Logger, OrderService } from '@vendure/core';
import { Request } from 'express';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { StripeSubscriptionPluginOptions } from '../stripe-subscription.plugin';
import { StripeSubscriptionService } from './stripe-subscription.service';
import { StripeInvoice } from './types/stripe-invoice';
import {
  StripePaymentIntent,
  StripeSetupIntent,
} from './types/stripe-payment-intent';
import { IncomingStripeWebhook } from './types/stripe.common';

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
  async webhook(
    @Headers('stripe-signature') signature: string | undefined,
    @Req() request: RequestWithRawBody,
    @Body() body: IncomingStripeWebhook
  ): Promise<void> {
    Logger.info(`Incoming webhook ${body.type}`, loggerCtx);
    // Validate if metadata present
    const orderCode =
      body.data.object.metadata?.orderCode ??
      (body.data.object as StripeInvoice).lines?.data[0]?.metadata.orderCode;
    const channelToken =
      body.data.object.metadata?.channelToken ??
      (body.data.object as StripeInvoice).lines?.data[0]?.metadata.channelToken;
      // TODO get events from Service static events
    if (
      body.type !== 'payment_intent.succeeded' &&
      body.type !== 'setup_intent.succeeded' &&
      body.type !== 'invoice.payment_failed' &&
      body.type !== 'invoice.payment_succeeded' &&
      body.type !== 'invoice.payment_action_required'
    ) {
      Logger.info(
        `Received incoming '${body.type}' webhook, not processing this event.`,
        loggerCtx
      );
      return;
    }
    if (!orderCode) {
      return Logger.error(
        `Incoming webhook is missing metadata.orderCode, cannot process this event`,
        loggerCtx
      );
    }
    if (!channelToken) {
      return Logger.error(
        `Incoming webhook is missing metadata.channelToken, cannot process this event`,
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
      // Validate signature
      const { stripeClient } =
        await this.stripeSubscriptionService.getStripeContext(ctx);
      if (!this.options?.disableWebhookSignatureChecking) {
        stripeClient.validateWebhookSignature(request.rawBody, signature);
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
        const invoiceObject = body.data.object as StripeInvoice;
        await this.stripeSubscriptionService.handleInvoicePaymentFailed(
          ctx,
          invoiceObject,
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
