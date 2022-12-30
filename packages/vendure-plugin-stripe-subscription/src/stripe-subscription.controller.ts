import { Body, Controller, Get, Headers, Post, Req, Res } from '@nestjs/common';
import {
  Allow,
  Ctx,
  ID,
  Logger,
  OrderService,
  Permission,
  RequestContext,
  UserInputError,
} from '@vendure/core';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { StripeSubscriptionService } from './stripe-subscription.service';
import { loggerCtx } from './constants';
import { IncomingStripeWebhook } from './stripe.types';
import {
  StripeSubscriptionPricing,
  StripeSubscriptionPricingInput,
} from './generated/graphql';
import { Request } from 'express';

export type RequestWithRawBody = Request & { rawBody: any };

@Resolver()
export class StripeSubscriptionResolver {
  constructor(
    private stripeSubscriptionService: StripeSubscriptionService,
    private orderService: OrderService
  ) {}

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
  async stripeSubscriptionPricing(
    @Ctx() ctx: RequestContext,
    @Args('input') input: StripeSubscriptionPricingInput
  ): Promise<StripeSubscriptionPricing> {
    return this.stripeSubscriptionService.getSubscriptionPricing(ctx, input);
  }

  @Query()
  async stripeSubscriptionPricingForOrderLine(
    @Ctx() ctx: RequestContext,
    @Args('orderLineId') orderLineId: ID
  ): Promise<StripeSubscriptionPricing> {
    const order = await this.orderService.findOneByOrderLineId(
      ctx,
      orderLineId,
      ['lines.productVariant']
    );
    const orderLine = order?.lines.find((line) => line.id === orderLineId);
    if (!orderLine) {
      throw new UserInputError(
        `No order with orderLineId '${orderLineId}' found`
      );
    }
    return this.stripeSubscriptionService.getSubscriptionPricing(
      ctx,
      undefined,
      orderLine.productVariant
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
    @Body() body: IncomingStripeWebhook
  ): Promise<void> {
    Logger.info(`Incoming webhook ${body.type}`, loggerCtx);
    try {
      await this.stripeSubscriptionService.handlePaymentCompleteEvent(
        body,
        signature,
        request.rawBody
      );
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
