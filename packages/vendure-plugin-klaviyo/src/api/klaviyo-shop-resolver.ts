import { Mutation, Resolver } from '@nestjs/graphql';
import {
  ActiveOrderService,
  Ctx,
  EventBus,
  RequestContext,
} from '@vendure/core';
import { CheckoutStartedEvent } from '../service/checkout-started-event';

@Resolver()
export class KlaviyoShopResolver {
  constructor(
    private readonly activeOrderService: ActiveOrderService,
    private readonly eventBus: EventBus
  ) {}

  @Mutation()
  async klaviyoCheckoutStarted(@Ctx() ctx: RequestContext): Promise<boolean> {
    const activeOrder = await this.activeOrderService.getActiveOrder(
      ctx,
      undefined
    );
    if (activeOrder) {
      await this.eventBus.publish(new CheckoutStartedEvent(ctx, activeOrder));
      return true;
    }
    return false;
  }
}
