import { Inject, Injectable } from '@nestjs/common';
import { ID, OrderService, Product, RequestContext } from '@vendure/core';
import { VENDURE_PLUGIN_XERO_PLUGIN_OPTIONS } from '../constants';
import { XeroPluginOptions } from '../xero.plugin';

type XeroStatus = 'Exported' | 'Not exported' | 'Failed';

@Injectable()
export class XeroService {
  constructor(
    private readonly orderService: OrderService,
    @Inject(VENDURE_PLUGIN_XERO_PLUGIN_OPTIONS)
    private options: XeroPluginOptions
  ) {}

  async sendOrders(ctx: RequestContext, orderIds: ID[]): Promise<void> {}

  /**
   * Sends a single order to Xero
   */
  async sendOrder(ctx: RequestContext, order: Order): Promise<void> {
    try {
    } catch (e) {
      // TODO log note on order
    }
    // Add your method logic here
    const result = await this.connection
      .getRepository(ctx, Product)
      .findOne({ where: { id } });
    return result;
  }

  async sendOrdersToXero(ctx: RequestContext, id: ID): Promise<boolean> {
    return true;
  }

  async myNewMutation(ctx: RequestContext, id: ID): Promise<boolean> {
    return true;
  }
}
