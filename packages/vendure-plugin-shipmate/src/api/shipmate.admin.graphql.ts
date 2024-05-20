import gql from 'graphql-tag';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ShipmateConfigService } from './shipmate-config.service';
import {
  PermissionDefinition,
  Allow,
  Ctx,
  RequestContext,
} from '@vendure/core';
import { ShipmateConfigEntity } from './shipmate-config.entity';

export const shipmatePermission = new PermissionDefinition({
  name: 'SetShipmateConfig',
  description: 'Allows setting Shipmate configurations',
});

export const adminSchema = gql`
  input ShipmateConfigInput {
    apiKey: String
    username: String
    password: String
  }
  type ShipmateConfig {
    apiKey: String
    username: String
    password: String
  }
  extend type Mutation {
    updateShipmateConfig(input: ShipmateConfigInput!): ShipmateConfig
  }

  extend type Query {
    shipmateConfig: ShipmateConfig
  }
`;
@Resolver()
export class ShipmateAdminResolver {
  constructor(private service: ShipmateConfigService) {}

  @Query()
  @Allow(shipmatePermission.Permission)
  async shipmateConfig(
    @Ctx() ctx: RequestContext
  ): Promise<ShipmateConfigEntity | null> {
    return this.service.getConfig(ctx);
  }

  @Mutation()
  @Allow(shipmatePermission.Permission)
  async updateShipmateConfig(
    @Ctx() ctx: RequestContext,
    @Args('input')
    input: { apiKey?: string; username?: string; password?: string }
  ): Promise<ShipmateConfigEntity | null> {
    return this.service.upsertConfig(
      ctx,
      input.apiKey,
      input.username,
      input.password
    );
  }
}
