import { Injectable, Inject } from '@nestjs/common';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { AnonymizeOrderPluginOptions } from './types';
import {
  ForbiddenError,
  Order,
  OrderService,
  RequestContext,
} from '@vendure/core';

@Injectable()
export class AnonymizeOrderService {
  constructor(
    @Inject(PLUGIN_INIT_OPTIONS)
    private readonly options: AnonymizeOrderPluginOptions,
    private readonly orderService: OrderService
  ) {}

  async getAnonymizedOrder(
    ctx: RequestContext,
    orderCode: string,
    emailAddress: string
  ): Promise<Order> {
    const order = await this.orderService.findOneByCode(ctx, orderCode);
    if (order && order.customer?.emailAddress === emailAddress) {
      order.customer = undefined;
      order.shippingAddress = {};
      order.billingAddress = {};
      for (let line of order.lines) {
        line.order = new Order();
      }
      if (this.options?.anonymizeOrderFn) {
        this.options.anonymizeOrderFn(order);
      }
      return order;
    }
    throw new ForbiddenError();
  }
}
