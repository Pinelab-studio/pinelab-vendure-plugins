import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { AcceptBlueService } from './accept-blue-service';
import {
  Mutation as GraphqlMutation,
  MutationRefundAcceptBlueTransactionArgs,
  MutationUpdateAcceptBlueSubscriptionArgs,
} from './generated/graphql';

@Resolver()
export class AcceptBlueAdminResolver {
  constructor(private acceptBlueService: AcceptBlueService) {}

  @Mutation()
  @Allow(Permission.UpdateOrder)
  async refundAcceptBlueTransaction(
    @Ctx() ctx: RequestContext,
    @Args()
    { transactionId, amount, cvv2 }: MutationRefundAcceptBlueTransactionArgs
  ): Promise<GraphqlMutation['refundAcceptBlueTransaction']> {
    return await this.acceptBlueService.refund(
      ctx,
      transactionId,
      amount ?? undefined,
      cvv2 ?? undefined
    );
  }

  @Mutation()
  @Allow(Permission.UpdateOrder)
  async updateAcceptBlueSubscription(
    @Ctx() ctx: RequestContext,
    @Args()
    { input }: MutationUpdateAcceptBlueSubscriptionArgs
  ): Promise<GraphqlMutation['updateAcceptBlueSubscription']> {
    return await this.acceptBlueService.updateSubscription(ctx, input);
  }
}