import { Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { RequestService } from '../services/request-service';
import { AdvancedMetricSummary } from '../ui/generated/graphql';

@Resolver()
export class MetricsShopResolver {
  constructor(private readonly requestService: RequestService) {}

  @Mutation()
  pageVisit(@Ctx() ctx: RequestContext): boolean {
    this.requestService.logRequest(ctx);
    return true;
  }
}
