import { gql } from 'graphql-tag';
import { Inject } from '@nestjs/common';
import { Resolver, Mutation } from '@nestjs/graphql';
import { Permission, Allow, RequestContext, Ctx, Logger } from '@vendure/core';
import { PicqerOptions } from './picqer.plugin';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from './constants';

export const adminSchema = gql`
  extend type Mutation {
    """
    Push all products to, and pull all stock levels from Picqer
    """
    triggerPicqerFullSync: Boolean!
  }
`;

@Resolver()
export class PicqerResolver {
  constructor(@Inject(PLUGIN_INIT_OPTIONS) private options: PicqerOptions) {}

  @Mutation()
  @Allow(Permission.UpdateCatalog)
  async triggerPicqerFullSync(@Ctx() ctx: RequestContext): Promise<string> {
    Logger.info(`Full sync triggered by user ${ctx.activeUserId}`, loggerCtx);
    return `Hello! Your example plugin is set to enabled=${this.options.enabled}`;
  }
}
