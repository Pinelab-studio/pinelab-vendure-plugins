import { Body, Controller, Param, Post, Req, Headers } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { Args, Mutation, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { StripeSubscriptionService } from './stripe-subscription.service';
import { loggerCtx } from './constants';
import { IncomingCheckoutWebhook } from './stripe.types';

export type RequestWithRawBody = Request & { rawBody: any };

@Resolver()
export class StripeSubscriptionResolver {
  constructor(private stripeSubscriptionService: StripeSubscriptionService) {}

  @Mutation()
  @Allow(Permission.Owner)
  async createStripeSubscriptionCheckout(
    @Ctx() ctx: RequestContext,
    @Args('paymentMethodCode') code: string
  ): Promise<string> {
    return this.stripeSubscriptionService.createStripeSubscriptionCheckout(
      ctx,
      code
    );
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
