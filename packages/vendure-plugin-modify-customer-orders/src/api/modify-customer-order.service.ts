import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { filter } from 'rxjs';
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
  SessionService,
  TransactionalConnection,
  UserInputError,
  assertFound,
} from '@vendure/core';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { ModifyCustomerOrdersPluginOptions } from '../modify-customer-orders.plugin';

@Injectable()
export class ModifyCustomerOrderService implements OnApplicationBootstrap {
  constructor(
    private readonly eventBus: EventBus,
    private readonly orderService: OrderService,
    private readonly connection: TransactionalConnection,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
    private readonly processContext: ProcessContext,
    @Inject(PLUGIN_INIT_OPTIONS)
    private readonly options: ModifyCustomerOrdersPluginOptions
  ) {}

  onApplicationBootstrap(): void {
    if (this.options.autoAssignDraftOrdersToCustomer) {
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
  }

  /**
   * Transition the order to Draft state and unset it as active order for the customer
   */
  async transitionToDraftState(ctx: RequestContext, id: ID) {
    const order = await this.orderService.findOne(ctx, id);
    if (order?.state !== 'AddingItems') {
      throw new UserInputError(
        `Only active orders can be changed to a draft order`
      );
    }
    // Deactivate order, because a customer should not have multiple orders in AddingItems state
    await this.unsetActiveOrder(ctx, order);
    const transitionResult = await this.orderService.transitionToState(
      ctx,
      id,
      'Draft'
    );
    if (transitionResult instanceof Order) {
      Logger.info(
        `Transitioned Order with id ${transitionResult.id} from 'AddingItems' to 'Draft'`,
        loggerCtx
      );
      return await assertFound(
        this.orderService.findOne(ctx, transitionResult.id)
      );
    }
    Logger.error(
      `Failed to transition Order with id ${id} to 'Draft' state`,
      loggerCtx
    );
    throw transitionResult;
  }

  /**
   *
   */
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
    const currentActiveOrder = await this.orderService.getActiveOrderForUser(
      ctx,
      draftOrder.customer.user.id
    );
    if (currentActiveOrder) {
      // Move current active order to Draft, because a customer should not have multiple active orders
      await this.transitionToDraftState(ctx, currentActiveOrder.id);
    }
    await this.setOrderState(ctx, draftOrder, 'AddingItems');
    await this.setAsActiveOrder(ctx, draftOrder, draftOrder.customer.user.id);
    Logger.info(
      `Assigned draft order ${draftOrder.code} as active order to ${draftOrder.customer?.emailAddress}`,
      loggerCtx
    );
  }

  /**
   * Set order to active, remove previous order from session and set new order in session.
   */
  async setAsActiveOrder(
    ctx: RequestContext,
    order: Order,
    userId: ID
  ): Promise<void> {
    // Make order active
    await this.connection
      .getRepository(ctx, Order)
      .update({ id: order.id }, { active: true });
    // Find current session for user
    const session = await this.connection
      .getRepository(ctx, Session)
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.user', 'user')
      .leftJoinAndSelect('user.roles', 'roles')
      .leftJoinAndSelect('roles.channels', 'channels')
      .where('session.userId = :userId', { userId })
      .getOne();
    if (session) {
      session.activeOrder = order;
      await this.connection
        .getRepository(ctx, Session)
        .save(session, { reload: false });
      const updatedSerializedSession =
        this.sessionService.serializeSession(session);
      await this.configService.authOptions.sessionCacheStrategy.set(
        updatedSerializedSession
      );
    }
  }

  /**
   * Remove order from all sessions that have this order set as active order
   * Typically, only one session for an active order exists
   */
  async unsetActiveOrder(ctx: RequestContext, order: Order): Promise<void> {
    await this.connection
      .getRepository(ctx, Order)
      .update({ id: order.id }, { active: false });
    // Remove active order from all related sessions -- This is copied from `SessionService.unsetActiveOrder()` in Vendure core
    const sessions = await this.connection.getRepository(ctx, Session).find({
      where: { activeOrderId: order.id },
      relations: ['user', 'user.roles', 'user.roles.channels'],
    });
    for (const session of sessions) {
      session.activeOrder = null;
      await this.connection.getRepository(ctx, Session).save(session);
      const updatedSerializedSession =
        this.sessionService.serializeSession(session);
      await this.configService.authOptions.sessionCacheStrategy.set(
        updatedSerializedSession
      );
    }
    Logger.info(
      `Unset active order ${order.code} for customer ${order.customer?.emailAddress}`,
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
