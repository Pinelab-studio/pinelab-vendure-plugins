import { Inject, Injectable } from '@nestjs/common';
import {
  ID,
  Product,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { ADDRESS_LOOKUP_PLUGIN_OPTIONS } from '../constants';
import { PluginInitOptions } from '../types';

@Injectable()
export class AddressLookupService {
  constructor(
    private connection: TransactionalConnection,
    @Inject(ADDRESS_LOOKUP_PLUGIN_OPTIONS) private options: PluginInitOptions
  ) {}

  async exampleMethod(ctx: RequestContext, id: ID) {
    // Add your method logic here
    const result = await this.connection
      .getRepository(ctx, Product)
      .findOne({ where: { id } });
    return result;
  }

  async lookupAddress(ctx: RequestContext, id: ID): Promise<OrderAddress[]> {
    return true;
  }
}
