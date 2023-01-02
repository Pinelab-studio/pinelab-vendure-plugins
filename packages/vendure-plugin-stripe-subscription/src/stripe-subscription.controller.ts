import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import {
  Allow,
  Ctx,
  EntityHydrator,
  ID,
  Logger,
  OrderService,
  Permission,
  ProductService,
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
import { ScheduleService } from './schedule.service';
import { Schedule } from './schedule.entity';
import {
  OrderLineWithSubscriptionFields,
  VariantWithSubscriptionFields,
} from './subscription-custom-fields';

export type RequestWithRawBody = Request & { rawBody: any };

@Resolver()
export class ShopResolver {
  constructor(
    private stripeSubscriptionService: StripeSubscriptionService,
    private orderService: OrderService,
    private productService: ProductService,
    private hydrator: EntityHydrator
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
      ['lines', 'lines.productVariant']
    );
    const orderLine: OrderLineWithSubscriptionFields | undefined =
      order?.lines.find((line) => line.id === orderLineId);
    if (!orderLine) {
      throw new UserInputError(
        `No order with orderLineId '${orderLineId}' found`
      );
    }
    return this.stripeSubscriptionService.getSubscriptionPricing(
      ctx,
      {
        downpayment: orderLine.customFields.downpayment,
        startDate: orderLine.customFields.startDate,
      },
      orderLine.productVariant
    );
  }

  @Query()
  async stripeSubscriptionPricingForProduct(
    @Ctx() ctx: RequestContext,
    @Args('productId') productId: ID
  ): Promise<StripeSubscriptionPricing[]> {
    const product = await this.productService.findOne(ctx, productId);
    if (!product) {
      throw new UserInputError(`No product with id '${productId}' found`);
    }
    await this.hydrator.hydrate(ctx, product, {
      relations: ['variants'],
      applyProductVariantPrices: true,
    });
    const subscriptionVariants = product.variants.filter(
      (v: VariantWithSubscriptionFields) =>
        !!v.customFields.subscriptionSchedule
    );
    return await Promise.all(
      subscriptionVariants.map((variant) =>
        this.stripeSubscriptionService.getSubscriptionPricing(
          ctx,
          undefined,
          variant
        )
      )
    );
  }
}

@Resolver()
export class AdminResolver {
  constructor(private scheduleService: ScheduleService) {}

  @Allow(Permission.ReadSettings)
  @Query()
  async stripeSubscriptionSchedules(
    @Ctx() ctx: RequestContext
  ): Promise<Schedule[]> {
    return this.scheduleService.getSchedules(ctx);
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
