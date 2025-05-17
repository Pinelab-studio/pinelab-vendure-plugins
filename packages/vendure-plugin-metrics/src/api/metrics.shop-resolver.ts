import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext } from '@vendure/core';
import { RequestService } from '../services/request-service';
import { PageVisitInput } from '../ui/generated/graphql';

@Resolver()
export class MetricsShopResolver {
  constructor(private readonly requestService: RequestService) {}

  @Mutation()
  pageVisit(
    @Ctx() ctx: RequestContext,
    @Args('input') input: PageVisitInput
  ): boolean {
    this.requestService.logRequest(ctx, input);
    return true;
  }
}
