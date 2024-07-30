import { ModuleRef } from '@nestjs/core';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  MutationAddItemToOrderArgs,
  MutationAdjustOrderLineArgs,
  UpdateOrderItemsResult,
} from '@vendure/common/lib/generated-shop-types';
import {
  Allow,
  Ctx,
  EntityHydrator,
  Injector,
  OrderLine,
  Permission,
  RequestContext,
  Transaction,
  UserInputError
} from '@vendure/core';
import { ShopOrderResolver } from '@vendure/core/dist/api/resolvers/shop/shop-order.resolver';
import { ErrorResultUnion } from '@vendure/core/dist/common/error/error-result';
import { Order } from '@vendure/core/dist/entity/order/order.entity';
import { getChannelAwareValue } from '../util';


/**
 * Resolver that overrides the default addItemToOrder mutation
 */
@Resolver()
export class AddItemOverrideResolver {

  private injector: Injector;

  constructor(
    private readonly entityHydrator: EntityHydrator,
    moduleRef: ModuleRef,
  ) {
    this.injector = new Injector(moduleRef);
  }

  @Transaction()
  @Mutation()
  @Allow(Permission.UpdateOrder, Permission.Owner)
  async addItemToOrder(
    @Ctx() ctx: RequestContext,
    @Args() args: MutationAddItemToOrderArgs
  ): Promise<ErrorResultUnion<UpdateOrderItemsResult, Order>> {
    const result = await this.injector.get(ShopOrderResolver).addItemToOrder(ctx, args);
    if (!(result as Order).code) {
      return result;
    }
    const order = result as Order;
    const orderLine = order.lines.find(
      (line) => line.productVariant.id == args.productVariantId
    );
    if (orderLine) {
      await this.validate(ctx, orderLine);
    }
    return result;
  }

  @Transaction()
  @Mutation()
  @Allow(Permission.UpdateOrder, Permission.Owner)
  async adjustOrderLine(
    @Ctx() ctx: RequestContext,
    @Args() args: MutationAdjustOrderLineArgs
  ): Promise<ErrorResultUnion<UpdateOrderItemsResult, Order>> {
    const result = await this.injector.get(ShopOrderResolver).adjustOrderLine(ctx, args);
    if (!(result as Order).code) {
      return result;
    }
    const order = result as Order;
    const orderLine = order.lines.find((line) => line.id == args.orderLineId);
    if (orderLine) {
      await this.validate(ctx, orderLine);
    }
    return result;
  }

  /**
   * Throw an error if quantity is over maxPerOrder or if it is not a multiple of onlyAllowPer
   */
  private async validate(ctx: RequestContext, orderLine: OrderLine): Promise<void> {
    await this.entityHydrator.hydrate(ctx, orderLine.productVariant, { relations: ['product'] });
    const maxPerOrder = getChannelAwareValue(ctx, orderLine.productVariant.product.customFields.maxPerOrder);
    const onlyAllowPer = getChannelAwareValue(ctx, orderLine.productVariant.product.customFields.onlyAllowPer);
    if (maxPerOrder && orderLine.quantity > maxPerOrder) {
      throw new UserInputError(
        `You are only allowed to order max ${maxPerOrder} of item '${orderLine.productVariant.name}'`
      );
    }
    if (onlyAllowPer && orderLine.quantity % onlyAllowPer !== 0) {
      throw new UserInputError(
        `You are only allowed to order a multiple of ${onlyAllowPer} item '${orderLine.productVariant.name}'`,
      );
    }
    // Throwing an error is sufficient, because it prevents the transaction form being committed, so no items are added
  }
}
