import { Injectable } from '@nestjs/common';
import { OrderService, RequestContext } from '@vendure/core';

@Injectable()
export class CustomerGroupExtensionsService {
  constructor(private orderService: OrderService) {}

  async getOrdersForCustomer(ctx: RequestContext) {
    return;
  }
}
