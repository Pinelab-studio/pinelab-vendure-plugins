import { Query, Resolver, Args } from '@nestjs/graphql';
import { KlaviyoService } from '../klaviyo.service';
import { KlaviyoResponse } from '../../src/ui/generated/graphql';

@Resolver()
export class KlaviyoShopResolver {
  constructor(private productService: KlaviyoService) {}

  @Query()
  getKlaviyoReviews(@Args() args: { next?: string }): Promise<KlaviyoResponse> {
    return this.productService.getAllReviews(args.next);
  }
}
