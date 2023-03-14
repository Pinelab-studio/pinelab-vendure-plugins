import { Body, Controller, Headers, Inject, Post, Req } from '@nestjs/common';
import {
  Allow,
  Ctx,
  ID,
  Logger,
  OrderService,
  Permission,
  ProductService,
  RequestContext,
  UserInputError,
} from '@vendure/core';
import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { StripeSubscriptionService } from './stripe-subscription.service';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from './constants';
import { IncomingStripeWebhook } from './stripe.types';
import {
  StripeSubscriptionPricing,
  StripeSubscriptionPricingInput,
  UpsertStripeSubscriptionScheduleInput,
} from './ui/generated/graphql';
import { Request } from 'express';
import { ScheduleService } from './schedule.service';
import { Schedule } from './schedule.entity';
import {
  OrderLineWithSubscriptionFields,
  VariantWithSubscriptionFields,
} from './subscription-custom-fields';
import { StripeSubscriptionPluginOptions } from './stripe-subscription.plugin';

export type RequestWithRawBody = Request & { rawBody: any };

@Resolver()
export class ShopResolver {
  constructor(
    private stripeSubscriptionService: StripeSubscriptionService,
    private orderService: OrderService,
    private productService: ProductService
  ) {}

  @Mutation()
  @Allow(Permission.Owner)
  async createStripeSubscriptionIntent(
    @Ctx() ctx: RequestContext
  ): Promise<string> {
    return this.stripeSubscriptionService.createPaymentIntent(ctx);
  }

  @Query()
  async stripeSubscriptionPricing(
    @Ctx() ctx: RequestContext,
    @Args('input') input: StripeSubscriptionPricingInput
  ): Promise<StripeSubscriptionPricing> {
    return this.stripeSubscriptionService.getPricing(ctx, input);
  }

  @Query()
  async stripeSubscriptionPricingForProduct(
    @Ctx() ctx: RequestContext,
    @Args('productId') productId: ID
  ): Promise<StripeSubscriptionPricing[]> {
    const product = await this.productService.findOne(ctx, productId, [
      'variants',
    ]);
    if (!product) {
      throw new UserInputError(`No product with id '${productId}' found`);
    }
    const subscriptionVariants = product.variants.filter(
      (v: VariantWithSubscriptionFields) =>
        !!v.customFields.subscriptionSchedule && v.enabled
    );
    return await Promise.all(
      subscriptionVariants.map((variant) =>
        this.stripeSubscriptionService.getPricing(ctx, {
          productVariantId: variant.id as string,
        })
      )
    );
  }
}

@Resolver('OrderLine')
export class ShopOrderLinePricingResolver {
  constructor(private subscriptionService: StripeSubscriptionService) {}

  @ResolveField()
  async subscriptionPricing(
    @Ctx() ctx: RequestContext,
    @Parent() orderLine: OrderLineWithSubscriptionFields
  ): Promise<StripeSubscriptionPricing | undefined> {
    if (orderLine.productVariant?.customFields?.subscriptionSchedule) {
      return await this.subscriptionService.getPricing(ctx, {
        downpaymentWithTax: orderLine.customFields.downpayment,
        startDate: orderLine.customFields.startDate,
        productVariantId: orderLine.productVariant.id as string,
      });
    }
    return;
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

  @Allow(Permission.UpdateSettings)
  @Mutation()
  async upsertStripeSubscriptionSchedule(
    @Ctx() ctx: RequestContext,
    @Args('input') input: UpsertStripeSubscriptionScheduleInput
  ): Promise<Schedule> {
    return this.scheduleService.upsert(ctx, input);
  }

  @Allow(Permission.UpdateSettings)
  @Mutation()
  async deleteStripeSubscriptionSchedule(
    @Ctx() ctx: RequestContext,
    @Args('scheduleId') scheduleId: string
  ): Promise<void> {
    return this.scheduleService.delete(ctx, scheduleId);
  }
}

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
      body.data.object.metadata?.orderCode ||
      body.data.object.lines?.data[0]?.metadata.orderCode;
    const channelToken =
      body.data.object.metadata?.channelToken ||
      body.data.object.lines?.data[0]?.metadata.channelToken;
    if (
      body.type !== 'payment_intent.succeeded' &&
      body.type !== 'invoice.payment_failed' &&
      body.type !== 'invoice.payment_succeeded'
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
        await this.stripeSubscriptionService.getStripeHandler(ctx, order.id);
      if (!this.options?.disableWebhookSignatureChecking) {
        stripeClient.validateWebhookSignature(request.rawBody, signature);
      }
      if (body.type === 'payment_intent.succeeded') {
        await this.stripeSubscriptionService.handlePaymentIntentSucceeded(
          ctx,
          body,
          order
        );
      } else if (body.type === 'invoice.payment_succeeded') {
        await this.stripeSubscriptionService.handleInvoicePaymentSucceeded(
          ctx,
          body,
          order
        );
      } else if (body.type === 'invoice.payment_failed') {
        await this.stripeSubscriptionService.handleInvoicePaymentFailed(
          ctx,
          body,
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
