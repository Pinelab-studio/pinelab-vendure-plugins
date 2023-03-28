import { gql } from 'graphql-tag';
import { Inject } from '@nestjs/common';
import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { Permission, Allow, RequestContext, Ctx, Logger } from '@vendure/core';
import { PicqerOptions } from '../picqer.plugin';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { permission as picqerPermission } from '..';
import { PicqerService } from './picqer.service';
import {
  PicqerConfigInput,
  PicqerConfig,
  TestPicqerInput,
} from '../ui/generated/graphql';

export const adminSchema = gql`
  input PicqerConfigInput {
    enabled: Boolean
    apiKey: String
    apiEndpoint: String
    storefrontUrl: String
    supportEmail: String
  }

  input TestPicqerInput {
    apiKey: String!
    apiEndpoint: String!
    storefrontUrl: String!
    supportEmail: String!
  }

  type PicqerConfig {
    enabled: Boolean
    apiKey: String
    apiEndpoint: String
    storefrontUrl: String
    supportEmail: String
  }

  extend type Query {
    picqerConfig: PicqerConfig
    """
    Test Picqer config against the Picqer API
    """
    isPicqerConfigValid(input: TestPicqerInput!): Boolean!
  }

  extend type Mutation {
    """
    Push all products to, and pull all stock levels from Picqer
    """
    triggerPicqerFullSync: Boolean!
    """
    Upsert Picqer config for the current channel
    """
    upsertPicqerConfig(input: PicqerConfigInput!): PicqerConfig!
  }
`;

@Resolver()
export class PicqerResolver {
  constructor(
    @Inject(PLUGIN_INIT_OPTIONS) private options: PicqerOptions,
    private service: PicqerService
  ) {}

  @Mutation()
  @Allow(picqerPermission.Permission)
  async triggerPicqerFullSync(@Ctx() ctx: RequestContext): Promise<boolean> {
    // TODO
    return true;
  }

  @Mutation()
  @Allow(picqerPermission.Permission)
  async upsertPicqerConfig(
    @Ctx() ctx: RequestContext,
    @Args('input') input: PicqerConfigInput
  ): Promise<PicqerConfig> {
    return this.service.upsertConfig(ctx, input);
  }

  @Query()
  @Allow(picqerPermission.Permission)
  async picqerConfig(
    @Ctx() ctx: RequestContext
  ): Promise<PicqerConfig | undefined> {
    return this.service.getConfig(ctx);
  }

  @Query()
  // FIXME @Allow(picqerPermission.Permission)
  async isPicqerConfigValid(
    @Ctx() ctx: RequestContext,
    @Args('input') input: TestPicqerInput
  ): Promise<boolean> {
    return this.service.testRequest(input);
  }
}
