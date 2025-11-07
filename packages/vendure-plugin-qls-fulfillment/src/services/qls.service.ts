import { Inject, Injectable } from '@nestjs/common';
import {
  ID,
  Product,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from '../constants';
import { QlsPluginOptions } from '../types';

@Injectable()
export class QlsService {
  constructor(
    private connection: TransactionalConnection,
    @Inject(PLUGIN_INIT_OPTIONS) private options: QlsPluginOptions
  ) {}

  async exampleMethod(ctx: RequestContext, id: ID) {
    // Add your method logic here
    const result = await this.connection
      .getRepository(ctx, Product)
      .findOne({ where: { id } });
    return result;
  }
}
