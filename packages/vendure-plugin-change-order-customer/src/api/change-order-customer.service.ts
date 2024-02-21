import { Injectable } from '@nestjs/common';
import {
  Customer,
  CustomerService,
  EmailAddressConflictError,
  ID,
  Order,
  OrderService,
  RequestContext,
  TransactionalConnection,
  UserInputError,
  assertFound,
  isGraphQlErrorResult,
} from '@vendure/core';
import { CreateCustomerInput } from '@vendure/common/lib/generated-types';

@Injectable()
export class ChangeOrderCustomerService {
  constructor(
    private readonly conn: TransactionalConnection,
    private readonly orderService: OrderService,
    private readonly customerService: CustomerService
  ) {}

  async setCustomerForOrder(
    ctx: RequestContext,
    orderId: ID,
    input?: ID | CreateCustomerInput
  ): Promise<Order> {
    if (!input) {
      throw new UserInputError(
        'Either "customerId" or "input" must be supplied to setCustomerForOrder'
      );
    }
    let result: Customer | EmailAddressConflictError | undefined;
    if (typeof input === 'object') {
      result = await this.customerService.createOrUpdate(ctx, input);
    } else {
      result = await this.customerService.findOne(ctx, input);
      if (!result) {
        throw new UserInputError(`Couldn't find Customer with id ${input}`);
      }
    }

    if (isGraphQlErrorResult(result)) {
      throw new UserInputError(result.message);
    }

    const order = await this.orderService.findOne(ctx, orderId);
    if (!order) {
      throw new UserInputError(`Couldn't find Order with id ${orderId}`);
    }
    order.customer = result;
    await this.conn.getRepository(ctx, Order).save(order);
    return await assertFound(this.orderService.findOne(ctx, orderId));
  }
}
