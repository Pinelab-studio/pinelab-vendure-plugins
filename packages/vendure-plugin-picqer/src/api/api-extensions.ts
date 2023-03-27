import { gql } from 'graphql-tag';
import { Inject } from '@nestjs/common';
import { Resolver, Query } from '@nestjs/graphql';
import { Permission, Allow, RequestContext, Ctx, Logger } from '@vendure/core';
import { PicqerOptions } from '../picqer.plugin';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';

export const shopSchema = gql`
  extend type Query {
    exampleQuery: String!
  }
`;

@Resolver()
export class PicqerResolver {
  constructor(@Inject(PLUGIN_INIT_OPTIONS) private options: PicqerOptions) {}

  @Query()
  @Allow(Permission.Public)
  async exampleQuery(@Ctx() ctx: RequestContext): Promise<string> {
    Logger.info(`Initialezed ExamplePlugin`, loggerCtx);
    return `Hello! Your example plugin is set to enabled=${this.options.enabled}`;
  }
}
