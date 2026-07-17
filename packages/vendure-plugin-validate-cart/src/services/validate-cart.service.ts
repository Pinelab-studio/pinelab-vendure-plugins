import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  ActiveOrderService,
  EntityHydrator,
  Injector,
  Logger,
  Order,
  OrderService,
  RelationPaths,
  RequestContext,
  UserInputError,
} from '@vendure/core';
import { ActiveOrderValidationError } from '../api/generated/graphql';
import { loggerCtx, VALIDATE_CART_PLUGIN_OPTIONS } from '../constants';
import { ValidateCartInitOptions } from '../types';

@Injectable()
export class ValidateCartService {
  private readonly injector: Injector;

  constructor(
    @Inject(VALIDATE_CART_PLUGIN_OPTIONS)
    private readonly options: ValidateCartInitOptions,
    private readonly activeOrderService: ActiveOrderService,
    private readonly entityHydrator: EntityHydrator,
    private readonly orderService: OrderService,
    readonly moduleRef: ModuleRef
  ) {
    this.injector = new Injector(this.moduleRef);
  }

  async validateActiveOrder(
    ctx: RequestContext,
    relations: RelationPaths<Order>
  ): Promise<{ errors: ActiveOrderValidationError[]; order: Order }> {
    const start = Date.now();
    const activeOrder = await this.activeOrderService.getActiveOrder(ctx, {});
    if (!activeOrder) {
      throw new UserInputError('No active order found');
    }
    const validationStrategy = this.options.validationStrategy;
    let result: ActiveOrderValidationError[] = [];
    if (validationStrategy) {
      if (validationStrategy.loadOrderRelations) {
        await this.entityHydrator.hydrate(ctx, activeOrder, {
          relations: validationStrategy.loadOrderRelations,
        });
      }
      result = await validationStrategy.validate(
        ctx,
        activeOrder,
        this.injector
      );
    }
    const duration = Date.now() - start;
    if (
      this.options.logWarningAfterMs &&
      duration > this.options.logWarningAfterMs
    ) {
      Logger.warn(`Active Order validation took ${duration}ms`, loggerCtx);
    }
    // Always join `lines`, so calculated Order fields such as `totalQuantity`,
    // `total`, `totalWithTax` and `subTotal` can be resolved regardless of the
    // relations requested by the client.
    const orderRelations = Array.from(
      new Set<string>([...(relations ?? []), 'lines', 'surcharges'])
    ) as RelationPaths<Order>;
    const order = await this.orderService.findOne(
      ctx,
      activeOrder.id,
      orderRelations
    );
    if (!order) {
      throw new UserInputError('No active order found');
    }
    return { errors: result, order };
  }
}
