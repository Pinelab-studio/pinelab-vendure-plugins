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
} from '@vendure/core';
@Resolver()
export class AdminApiResolver {
  constructor(
    private readonly orderService: OrderService,
    private readonly conn: TransactionalConnection,
    private readonly customerService: CustomerService
  ) {}

  @Mutation()
  @Allow(Permission.CreateOrder)
  async convertToDraft(
    @Ctx() ctx: RequestContext,
    @Args('id') id: ID
  ): Promise<Order> {
    const orderRepo = this.conn.getRepository(ctx, Order);
    const orderRelations: Array<EntityRelationPaths<Order>> = [
      'lines',
      'lines.productVariant',
      'shippingLines',
      'lines.items',
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
    if (existingOrder.customer) {
      await this.orderService.addCustomerToOrder(
        ctx,
        newDraft.id,
        existingOrder.customer
      );
    }
    if (existingOrder.shippingAddress) {
      await orderRepo
        .createQueryBuilder('order')
        .update(Order)
        .set({ shippingAddress: existingOrder.shippingAddress })
        .where('id = :id', { id: newDraft.id })
        .execute();
    }
    if (existingOrder.billingAddress) {
      await orderRepo
        .createQueryBuilder('order')
        .update(Order)
        .set({ billingAddress: existingOrder.billingAddress })
        .where('id = :id', { id: newDraft.id })
        .execute();
    }
    if (existingOrder.shippingLines[0]?.shippingMethod) {
      await this.orderService.setShippingMethod(
        ctx,
        newDraft.id,
        existingOrder.shippingLines[0]?.shippingMethod.id
      );
    }

    for (const promo of existingOrder.promotions) {
      await this.orderService.applyCouponCode(
        ctx,
        newDraft.id,
        promo.couponCode
      );
    }

    return await assertFound(
      this.orderService.findOne(ctx, newDraft.id, orderRelations)
    );
  }
}
