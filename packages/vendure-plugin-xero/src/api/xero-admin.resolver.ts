import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Permission } from '@vendure/common/lib/generated-types';
import { ID } from '@vendure/common/lib/shared-types';
import { Allow, Ctx, RequestContext, Transaction } from '@vendure/core';
import { XeroService } from '../services/xero.service';

@Resolver()
export class XeroAdminResolver {
  constructor(private xeroService: XeroService) {}

  @Mutation()
  @Transaction()
  @Allow(Permission.SuperAdmin)
  async sendOrdersToXero(
    @Ctx() ctx: RequestContext,
    @Args() args: { id: ID }
  ): Promise<boolean> {
    return this.xeroService.myNewMutation(ctx, args.id);
  }
}
