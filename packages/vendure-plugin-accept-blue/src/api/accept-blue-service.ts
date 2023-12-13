import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ProductVariantService } from '@vendure/core';
import { SubscriptionHelper } from '../';
import { AcceptBluePluginOptions } from '../accept-blue-plugin';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';

@Injectable()
export class AcceptBlueService {
  constructor(
    productVariantService: ProductVariantService,
    moduleRef: ModuleRef,
    @Inject(PLUGIN_INIT_OPTIONS)
    private readonly options: AcceptBluePluginOptions
  ) {
    this.subscriptionHelper = new SubscriptionHelper(
      loggerCtx,
      moduleRef,
      productVariantService,
      this.options.subscriptionStrategy
    );
  }

  readonly subscriptionHelper: SubscriptionHelper;

  async createCharge(ctx: any): Promise<void> {
    // TODO
  }
}
