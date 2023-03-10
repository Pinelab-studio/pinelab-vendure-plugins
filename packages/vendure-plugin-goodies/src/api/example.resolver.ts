import { Inject } from '@nestjs/common';
import { Resolver, Query } from '@nestjs/graphql';
import { Permission, Allow, RequestContext, Ctx, Logger } from '@vendure/core';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { ExampleOptions } from '../example.plugin';

@Resolver()
export class ExampleResolver {
  constructor(@Inject(PLUGIN_INIT_OPTIONS) private options: ExampleOptions) {}

  @Query()
  @Allow(Permission.Public)
  async exampleQuery(@Ctx() ctx: RequestContext): Promise<string> {
    Logger.info(`Initialezed ExamplePlugin`, loggerCtx);
    return `Hello! Your example plugin is set to enabled=${this.options.enabled}`;
  }
}
