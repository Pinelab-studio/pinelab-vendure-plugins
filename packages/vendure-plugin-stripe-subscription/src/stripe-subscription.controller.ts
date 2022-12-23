import { Body, Controller, Get, Headers, Post, Req, Res } from '@nestjs/common';
import { Allow, Ctx, Logger, Permission, RequestContext } from '@vendure/core';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { StripeSubscriptionService } from './stripe-subscription.service';
import { loggerCtx } from './constants';
import { IncomingCheckoutWebhook } from './stripe.types';
import {
  StripeSubscriptionPricing,
  StripeSubscriptionPricingInput,
} from './generated/graphql';

export type RequestWithRawBody = Request & { rawBody: any };

@Resolver()
export class StripeSubscriptionResolver {
  constructor(private stripeSubscriptionService: StripeSubscriptionService) {}

  @Mutation()
  @Allow(Permission.Owner)
  async createStripeSubscriptionIntent(
    @Ctx() ctx: RequestContext
  ): Promise<string> {
    return this.stripeSubscriptionService.createStripeSubscriptionPaymentIntent(
      ctx
    );
  }

  @Query()
  async getStripeSubscriptionPricing(
    @Ctx() ctx: RequestContext,
    @Args('input') input: StripeSubscriptionPricingInput
  ): Promise<StripeSubscriptionPricing> {
    return this.stripeSubscriptionService.getSubscriptionPricing(ctx, input);
  }
}

@Controller('stripe-subscriptions')
export class StripeSubscriptionController {
  constructor(private stripeSubscriptionService: StripeSubscriptionService) {}

  @Post('webhook')
  async webhook(
    @Headers('stripe-signature') signature: string | undefined,
    @Req() request: RequestWithRawBody,
    @Body() body: IncomingCheckoutWebhook
  ): Promise<void> {
    Logger.info(`Incoming webhook ${body.type}`, loggerCtx);
    // TODO verify signature
    try {
      await this.stripeSubscriptionService.handlePaymentCompleteEvent(body);
    } catch (error) {
      Logger.error(
        `Failed to process incoming webhook ${body.type} (${body.id}): ${error?.message}`,
        loggerCtx,
        error
      );
      throw error;
    }
  }
}
