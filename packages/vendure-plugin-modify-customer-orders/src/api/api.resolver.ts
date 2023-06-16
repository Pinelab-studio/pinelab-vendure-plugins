import { Resolver, Mutation, Args } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  RequestContext,
  Permission,
  OrderService,
  CustomerService,
  ID,
  UserInputError,
  TransactionalConnection,
  Order,
  assertFound,
  EntityRelationPaths,
  Logger,
} from '@vendure/core';
import { loggerCtx } from '../constants';
@Resolver()
export class AdminApiResolver {
  constructor(
    private readonly orderService: OrderService,
    private readonly conn: TransactionalConnection
  ) {}

  @Mutation()
  @Allow(Permission.CreateOrder)
  async convertOrderToDraft(
    @Ctx() ctx: RequestContext,
    @Args('id') id: ID
  ): Promise<Order> {
    const orderRepo = this.conn.getRepository(ctx, Order);
    const orderRelations: Array<EntityRelationPaths<Order>> = [
      'lines',
      'lines.productVariant',
      'shippingLines',
      'promotions',
      'customer',
      'shippingLines.shippingMethod',
    ];
    const existingOrder = await this.orderService.findOne(
      ctx,
      id,
      orderRelations
    );
    if (!existingOrder) {
      throw new UserInputError(`No order with id ${id} could be found`);
    }
    if (existingOrder.state !== 'AddingItems') {
      throw new UserInputError(
        `Only active orders can be changed to a draft order`
      );
    }
    const newDraft = await this.orderService.createDraft(ctx);
    for (const line of existingOrder.lines) {
      await this.orderService.addItemToOrder(
        ctx,
        newDraft.id,
        line.productVariant.id,
        line.quantity
      );
    }
    Logger.info(
      `Copied ${existingOrder.lines.length} lines to new draft`,
      loggerCtx
    );
    if (existingOrder.customer) {
      await this.orderService.addCustomerToOrder(
        ctx,
        newDraft.id,
        existingOrder.customer
      );
      Logger.info(
        `Copied customer ${existingOrder.customer.emailAddress} to new draft`,
        loggerCtx
      );
    }
    if (existingOrder.shippingAddress) {
      await orderRepo
        .createQueryBuilder('order')
        .update(Order)
        .set({ shippingAddress: existingOrder.shippingAddress })
        .where('id = :id', { id: newDraft.id })
        .execute();
      Logger.info(
        `Copied shipping address ${existingOrder.shippingAddress.fullName} to new draft`,
        loggerCtx
      );
    }
    if (existingOrder.billingAddress) {
      await orderRepo
        .createQueryBuilder('order')
        .update(Order)
        .set({ billingAddress: existingOrder.billingAddress })
        .where('id = :id', { id: newDraft.id })
        .execute();
      Logger.info(
        `Copied billing address ${existingOrder.billingAddress.fullName} to new draft`,
        loggerCtx
      );
    }
    if (existingOrder.shippingLines[0]?.shippingMethod) {
      await this.orderService.setShippingMethod(ctx, newDraft.id, [
        existingOrder.shippingLines[0]?.shippingMethod.id,
      ]);
      Logger.info(
        `Copied shipping ${existingOrder.shippingLines[0].shippingMethod.code} to new draft`,
        loggerCtx
      );
    }
    for (const couponCode of existingOrder.couponCodes) {
      await this.orderService.applyCouponCode(ctx, newDraft.id, couponCode);
      Logger.info(`Copied coupon ${couponCode} to new draft`, loggerCtx);
    }

    return await assertFound(
      this.orderService.findOne(ctx, newDraft.id, orderRelations)
    );
  }
}
