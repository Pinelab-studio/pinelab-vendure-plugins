import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  ActiveOrderService,
  EntityHydrator,
  Injector,
  Logger,
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
    readonly moduleRef: ModuleRef
  ) {
    this.injector = new Injector(this.moduleRef);
  }

  async validateActiveOrder(
    ctx: RequestContext
  ): Promise<ActiveOrderValidationError[]> {
    const start = Date.now();
    const validationStrategy = this.options.validationStrategy;
    if (!validationStrategy) {
      return []; // A bit strange, but no strategy means always valid
    }
    const activeOrder = await this.activeOrderService.getActiveOrder(ctx, {});
    if (!activeOrder) {
      throw new UserInputError('No active order found');
    }
    if (validationStrategy.loadOrderRelations) {
      await this.entityHydrator.hydrate(ctx, activeOrder, {
        relations: validationStrategy.loadOrderRelations,
      });
    }
    const result = await validationStrategy.validate(
      ctx,
      activeOrder,
      this.injector
    );
    const duration = Date.now() - start;
    if (
      this.options.logWarningAfterMs &&
      duration > this.options.logWarningAfterMs
    ) {
      Logger.warn(`Active Order validation took ${duration}ms`, loggerCtx);
    }
    return result;
  }
}
