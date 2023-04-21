/* eslint no-use-before-define: 0 */
import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
  ConfigService,
  EventBus,
  ID,
  Logger,
  Order,
  OrderService,
  OrderState,
  OrderStateTransitionError,
  OrderStateTransitionEvent,
  ProcessContext,
  RequestContext,
  Session,
  SessionCacheStrategy,
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
    private readonly configService: ConfigService,
    private readonly connection: TransactionalConnection,
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
        .subscribe(async ({ ctx, order: draftOrder }) => {
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
            // Delete active order and clear cache, because a customer should not have multiple orders in AddingItems state
            await this.orderService.deleteOrder(ctx, activeOrder.id);
            Logger.info(
              `Deactivated active order ${activeOrder.code} for customer ${draftOrder.customer?.emailAddress}`,
              loggerCtx
            );
          }
          await this.setOrderState(ctx, draftOrder, 'AddingItems');
          await this.setOrderActiveState(ctx, draftOrder, true);
          Logger.info(
            `Assigned draft order ${draftOrder.code} as active order to ${draftOrder.customer?.emailAddress}`,
            loggerCtx
          );
        });
    }
  }

  async setOrderActiveState(
    ctx: RequestContext,
    order: Order,
    active: boolean = true
  ): Promise<void> {
    await this.connection
      .getRepository(ctx, Order)
      .update({ id: order.id }, { active });
    Logger.info(
      `Successfully set order ${order.code} to ${
        active ? 'active' : 'inactive'
      }`,
      loggerCtx
    );
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
