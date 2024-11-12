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
    private readonly options: ModifyCustomerOrdersPluginOptions
  ) {}

  onApplicationBootstrap(): void {
    if (
      this.processContext.isServer &&
      this.options.autoAssignDraftOrdersToCustomer
    ) {
      Logger.info(
        'Listening for Draft order completion, to auto assign draft orders to customers',
        loggerCtx
      );
      this.eventBus
        .ofType(OrderStateTransitionEvent)
        .pipe(
          filter((event) => event.fromState === 'Draft'),
          filter((event) => event.toState === 'ArrangingPayment')
        )
        .subscribe(({ ctx, order: draftOrder }) =>
          this.assignOrderToCustomer(ctx, draftOrder).catch((e: any) => {
            Logger.error(
              `Error assigning draft order ${draftOrder.code} to customer`,
              loggerCtx,
              e?.stack
            );
          })
        );
    }

    if (this.processContext.isServer) {
      Logger.info(
        'Listening for convert to Draft transition, to set orders active to false',
        loggerCtx
      );
      this.eventBus
        .ofType(OrderStateTransitionEvent)
        .pipe(
          filter((event) => event.toState === 'Draft' && event.order.active)
        )
        .subscribe(({ ctx, order: draftOrder }) =>
          this.deactivateOrderAndRemoveCache(ctx, draftOrder).catch(
            (e: any) => {
              Logger.error(
                `Error setting draft order ${draftOrder.code} to active`,
                loggerCtx,
                e?.stack
              );
            }
          )
        );
    }
  }

  async assignOrderToCustomer(
    ctx: RequestContext,
    draftOrder: Order
  ): Promise<void> {
    if (!draftOrder.customer?.user?.id) {
      Logger.info(
        `Draft order ${draftOrder.code} has no customer, skipping auto assign`,
        loggerCtx
      );
      return;
    }
    // Get current active order
    const activeOrder = await this.orderService.getActiveOrderForUser(
      ctx,
      draftOrder.customer.user.id
    );
    if (activeOrder) {
      // Deactivate order, because a customer should not have multiple orders in AddingItems state
      await this.deactivateOrder(ctx, activeOrder);
      Logger.info(
        `Deactivated active order ${activeOrder.code} for customer ${draftOrder.customer?.emailAddress}`,
        loggerCtx
      );
    }
    await this.setOrderState(ctx, draftOrder, 'AddingItems');
    await this.setAsActiveOrder(ctx, draftOrder);
    Logger.info(
      `Assigned draft order ${draftOrder.code} as active order to ${draftOrder.customer?.emailAddress}`,
      loggerCtx
    );
  }

  /**
   * Remove order as active from session
   * This functions presumes it may be called without an attached session in order to
   * be able to de-activate an order from the admin
   */
  async deactivateOrderAndRemoveCache(ctx: RequestContext, order: Order) {
    if (!order.active) {
      Logger.warn(`Not an active order: ${order.code}. Returning`, loggerCtx);
    }
    await this.sessionService.deleteSessionsByActiveOrderId(ctx, order.id);
    await this.deactivateOrder(ctx, order);
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
    state: OrderState
  ): Promise<Order | OrderStateTransitionError> {
    const transitionToStateResult = await this.orderService.transitionToState(
      ctx,
      order.id,
      state
    );
    if (transitionToStateResult instanceof OrderStateTransitionError) {
      throw Error(
        `Error transitioning order ${order.code} from ${transitionToStateResult.fromState} to ${transitionToStateResult.toState}: ${transitionToStateResult.message}`
      );
    }
    return transitionToStateResult;
  }
}
