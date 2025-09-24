import { Mutation, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext } from '@vendure/core';
import { ActiveOrderValidationError } from '../api/generated/graphql';
import { ValidateCartService } from '../services/validate-cart.service';

@Resolver()
export class ValidateCartResolver {
  constructor(private validateCartService: ValidateCartService) {}

  @Mutation()
  async validateActiveOrder(
    @Ctx() ctx: RequestContext
  ): Promise<ActiveOrderValidationError[]> {
    return await this.validateCartService.validateActiveOrder(ctx);
  }
}
