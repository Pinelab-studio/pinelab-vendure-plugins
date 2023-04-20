/* eslint no-use-before-define: 0 */
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
  EventBus,
  OrderService,
  TransactionalConnection,
  OrderStateTransitionEvent,
  Order,
  RequestContext,
  Logger,
  OrderState,
  OrderStateTransitionError,
  ProcessContext,
} from '@vendure/core';
import { filter } from 'rxjs/operators';

@Injectable()
export class OrderTransitionListenerService implements OnApplicationBootstrap {
  constructor(
    private readonly eventBus: EventBus,
    private readonly orderService: OrderService,
    private readonly connection: TransactionalConnection,
    private readonly processContext: ProcessContext
  ) {}

  onApplicationBootstrap(): void {
    if (this.processContext.isServer) {
      this.eventBus
        .ofType(OrderStateTransitionEvent)
        .pipe(
          filter((event) => event.fromState === 'Draft'),
          filter((event) => event.toState === 'ArrangingPayment')
        )
        .subscribe(async (event) => {
          console.log(event.fromState + '->' + event.toState);
          const { order, ctx } = event;
          console.log(order.code);
          const activeOrder = await this.connection
            .getRepository(ctx, Order)
            .findOne({ customer: order.customer, active: true });
          if (activeOrder) {
            console.log(
              'Existing active order: ' +
                activeOrder.code +
                ' for customer: ' +
                activeOrder.customer?.emailAddress
            );
            await this.setOrderActiveState(ctx, activeOrder, false);
          }

          await this.setOrderState(ctx, order, 'AddingItems');
          await this.setOrderActiveState(ctx, order, true);
        });
    }
  }

  async setOrderActiveState(
    ctx: RequestContext,
    order: Order,
    active: boolean = true
  ): Promise<void> {
    try {
      await this.connection
        .getRepository(ctx, Order)
        .update({ id: order.id }, { active });
    } catch (error) {
      console.log(
        'Unable to transition order: ' +
          order.code +
          ' for customer: ' +
          order.customer?.emailAddress
      );
    }
    Logger.info(
      `Successfully transitioned order ${order.code} to ` +
        (active ? 'active' : 'inactive')
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
