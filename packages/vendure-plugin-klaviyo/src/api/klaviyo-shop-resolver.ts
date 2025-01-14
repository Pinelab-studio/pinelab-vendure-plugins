import { Mutation, Resolver, Args } from '@nestjs/graphql';
import {
  ActiveOrderService,
  Ctx,
  EventBus,
  Permission,
  RequestContext,
  Allow,
  ForbiddenError,
} from '@vendure/core';
import { CheckoutStartedEvent } from '../service/checkout-started-event';
import { KlaviyoService } from '../service/klaviyo.service';

@Resolver()
export class KlaviyoShopResolver {
  constructor(
    private readonly activeOrderService: ActiveOrderService,
    private readonly klaviyoService: KlaviyoService,
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

  @Mutation()
  async subscribeToKlaviyoList(
    @Ctx() ctx: RequestContext,
    @Args('emailAddress') emailAddress: string,
    @Args('listId') list: string
  ): Promise<boolean> {
    if (!ctx.session?.token) {
      // Prevent bot access by checking if token exists. This means a user has at least done a mutation before, like add to cart.
      throw new ForbiddenError();
    }
    await this.klaviyoService.subscribeToList(ctx, emailAddress, list);
    return true;
  }
}
