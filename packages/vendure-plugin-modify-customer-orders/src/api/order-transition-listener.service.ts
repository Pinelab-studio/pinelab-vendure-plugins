/* eslint no-use-before-define: 0 */
import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
  EventBus,
  Logger,
  Order,
  OrderService,
  OrderState,
  OrderStateTransitionError,
  OrderStateTransitionEvent,
  ProcessContext,
  RequestContext,
  SessionService,
  TransactionalConnection,
} from '@vendure/core';
import { filter } from 'rxjs/operators';
import { PLUGIN_INIT_OPTIONS, loggerCtx } from '../constants';
import { ModifyCustomerOrdersPluginOptions } from '../modify-customer-orders.plugin';

@Injectable()
export class OrderTransitionListenerService implements OnApplicationBootstrap {
  constructor(
    private readonly eventBus: EventBus,
    private readonly orderService: OrderService,
    private readonly connection: TransactionalConnection,
    private readonly sessionService: SessionService,
    private readonly processContext: ProcessContext,
    @Inject(PLUGIN_INIT_OPTIONS)
    private readonly options: ModifyCustomerOrdersPluginOptions,
  ) {}

  onApplicationBootstrap(): void {
    if (
      this.processContext.isServer &&
      this.options.autoAssignDraftOrdersToCustomer
    ) {
      Logger.info(
        'Listening for Draft order completion, to auto assign draft orders to customers',
        loggerCtx,
      );
      this.eventBus
        .ofType(OrderStateTransitionEvent)
        .pipe(
          filter((event) => event.fromState === 'Draft'),
          filter((event) => event.toState === 'ArrangingPayment'),
        )
        .subscribe(({ ctx, order: draftOrder }) =>
          this.assignOrderToCustomer(ctx, draftOrder).catch((e: any) => {
            Logger.error(
              `Error assigning draft order ${draftOrder.code} to customer`,
              loggerCtx,
              e?.stack,
            );
          }),
        );
    }
  }

  async assignOrderToCustomer(
    ctx: RequestContext,
    draftOrder: Order,
  ): Promise<void> {
    if (!draftOrder.customer?.user?.id) {
      Logger.info(
        `Draft order ${draftOrder.code} has no customer, skipping auto assign`,
        loggerCtx,
      );
      return;
    }
    // Get current active order
    const activeOrder = await this.orderService.getActiveOrderForUser(
      ctx,
      draftOrder.customer.user.id,
    );
    if (activeOrder) {
      // Deactivate order, because a customer should not have multiple orders in AddingItems state
      await this.deactivateOrder(ctx, activeOrder);
      Logger.info(
        `Deactivated active order ${activeOrder.code} for customer ${draftOrder.customer?.emailAddress}`,
        loggerCtx,
      );
    }
    await this.setOrderState(ctx, draftOrder, 'AddingItems');
    await this.setAsActiveOrder(ctx, draftOrder);
    Logger.info(
      `Assigned draft order ${draftOrder.code} as active order to ${draftOrder.customer?.emailAddress}`,
      loggerCtx,
    );
  }

  /**
   * Set order to active, remove previous order from session and set new order in session.
   */
  async setAsActiveOrder(ctx: RequestContext, order: Order): Promise<void> {
    if (ctx.session) {
      await this.sessionService.unsetActiveOrder(ctx, ctx.session);
    }
    await this.connection
      .getRepository(ctx, Order)
      .update({ id: order.id }, { active: true });
    if (ctx.session) {
      await this.sessionService.setActiveOrder(ctx, ctx.session, order);
    }
  }

  /**
   * Remove order as active from session
   */
  async deactivateOrder(ctx: RequestContext, order: Order): Promise<void> {
    if (ctx.session) {
      await this.sessionService.unsetActiveOrder(ctx, ctx.session);
    }
    await this.connection
      .getRepository(ctx, Order)
      .update({ id: order.id }, { active: false });
  }

  async setOrderState(
    ctx: RequestContext,
    order: Order,
    state: OrderState,
  ): Promise<Order | OrderStateTransitionError> {
    const transitionToStateResult = await this.orderService.transitionToState(
      ctx,
      order.id,
      state,
    );
    if (transitionToStateResult instanceof OrderStateTransitionError) {
      throw Error(
        `Error transitioning order ${order.code} from ${transitionToStateResult.fromState} to ${transitionToStateResult.toState}: ${transitionToStateResult.message}`,
      );
    }
    return transitionToStateResult;
  }
}
