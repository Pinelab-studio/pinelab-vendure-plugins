import { Body, Controller, Post } from '@nestjs/common';
import { Resolver, Mutation } from '@nestjs/graphql';
import { CoinbaseService } from './coinbase.service';
import { Ctx, Logger, RequestContext } from '@vendure/core';
import { ChargeConfirmedWebhookEvent } from './coinbase.types';
import { loggerCtx } from './constants';

@Controller('payments')
export class CoinbaseController {
  constructor(private service: CoinbaseService) {}

  @Post('coinbase')
  async webhook(@Body() body: ChargeConfirmedWebhookEvent): Promise<void> {
    try {
      await this.service.settlePayment(body.event);
    } catch (error: any) {
      Logger.error(
        `Failed to process incoming webhook: ${
          error?.message
        }: ${JSON.stringify(body)}`,
        loggerCtx,
        error
      );
      throw error;
    }
  }
}

@Resolver()
export class CoinbaseResolver {
  constructor(private service: CoinbaseService) {}

  @Mutation()
  createCoinbasePaymentIntent(@Ctx() ctx: RequestContext): Promise<string> {
    return this.service.createPaymentIntent(ctx);
  }
}
