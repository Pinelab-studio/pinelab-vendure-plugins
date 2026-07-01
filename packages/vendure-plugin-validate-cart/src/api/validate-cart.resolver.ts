import { Mutation, Resolver } from '@nestjs/graphql';
import {
  Ctx,
  Order,
  Relations,
  RelationPaths,
  RequestContext,
} from '@vendure/core';
import { ValidateActiveOrderResult } from '../api/generated/graphql';
import { ValidateCartService } from '../services/validate-cart.service';

@Resolver()
export class ValidateCartResolver {
  constructor(private validateCartService: ValidateCartService) {}

  @Mutation()
  async validateActiveOrder(
    @Ctx() ctx: RequestContext,
    @Relations(Order) relations: RelationPaths<Order>
  ): Promise<ValidateActiveOrderResult> {
    return await this.validateCartService.validateActiveOrder(ctx, relations);
  }
}
