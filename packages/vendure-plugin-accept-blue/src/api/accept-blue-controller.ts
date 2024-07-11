import { Controller, Post, Headers, Req, Body } from '@nestjs/common';
import { Request } from 'express';
import {
  RequestContext,
  TransactionalConnection,
  Ctx,
  Logger,
  OrderLine,
  EntityHydrator,
  EventBus,
  PaymentMethod,
} from '@vendure/core';
import { In } from 'typeorm';
import { TransactionEvent } from './events';
import { acceptBluePaymentHandler } from './accept-blue-handler';
import crypto from 'node:crypto';
import { loggerCtx } from '../constants';
import { AcceptBlueEvent } from '../types';

@Controller('accept-blue')
export class AcceptBlueController {
  constructor(
    private connection: TransactionalConnection,
    private entityHydrator: EntityHydrator,
    private eventBus: EventBus
  ) {}

  /**
   * Endpoint for all incoming events from Accept Blue
   */
  @Post('webhook')
  async events(
    @Ctx() ctx: RequestContext,
    @Req() request: Request,
    @Headers('X-Signature') xSignatureHeader: string
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const rawBody = (request as any).rawBody as Buffer;
    const body = JSON.parse(rawBody.toString('utf-8')) as AcceptBlueEvent; // We have to parse it ourselves, because of the rawBody middleware
    console.log('BODY', JSON.stringify(body));

    // TODO verify

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const scheduleId = request?.body?.data?.transaction?.transaction_details
      ?.schedule_id as string;
    if (!scheduleId) {
      Logger.info(
        `A webhook event with an empty recurring schedule ID received`,
        loggerCtx
      );
      return;
    }
    const orderLine = await this.connection
      .getRepository(ctx, OrderLine)
      .findOne({
        where: {
          customFields: {
            acceptBlueSubscriptionIds: In([scheduleId]),
          },
        },
      });
    if (!orderLine) {
      Logger.info(
        `A webhook event  with recurring schedule ID ${scheduleId} received for unidentified Order`,
        loggerCtx
      );
      return;
    }
    await this.entityHydrator.hydrate(ctx, orderLine, { relations: ['order'] });
    let savedWebhookSignature: string | undefined; //"h0Kqqv7Ly8BSHLh3yBUDhCqjewCnLkla";
    if (orderLine?.order) {
      await this.entityHydrator.hydrate(ctx, orderLine.order, {
        relations: ['customer', 'payments'],
      });
      const paymentMethodRepo = this.connection.getRepository(
        ctx,
        PaymentMethod
      );
      for (const payment of orderLine.order.payments) {
        const paymentMethod = await paymentMethodRepo.findOne({
          where: { code: payment.method },
        });
        if (
          paymentMethod &&
          paymentMethod.handler.code === acceptBluePaymentHandler.code
        ) {
          savedWebhookSignature = paymentMethod.handler.args.find(
            (arg) => arg.name === 'signature'
          )?.value;
        }
      }
    }
    if (!savedWebhookSignature) {
      return;
    }
    // // we need to verify the request here
    // if (this.checkSignature(savedWebhookSignature, rawBody, xSignatureHeader)) {
    //   const event = new TransactionEvent(
    //     new Date(),
    //     request.body?.data,
    //     body.type,
    //     scheduleId,
    //     orderLine.id,
    //     orderLine.order,
    //     body.data.transaction?.id
    //   );
    //   await this.eventBus.publish(event);
    // }
  }

  checkSignature(
    signature: string,
    body: Buffer,
    headerSignature: string
  ): boolean {
    const hash = crypto
      .createHmac('sha256', signature)
      .update(body)
      .digest('hex');
    return hash === headerSignature;
  }
}
