import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  RequestContext,
  PermissionDefinition,
} from '@vendure/core';
import { MyparcelService } from './myparcel.service';
import { MyparcelConfigEntity } from './myparcel-config.entity';
import gql from 'graphql-tag';

export const myparcelPermission = new PermissionDefinition({
  name: 'SetMyparcelConfig',
  description: 'Allows setting MyParcel configurations',
});
export const adminSchema = gql`
  input MyparcelConfigInput {
    apiKey: String
  }
  type MyparcelConfig {
    apiKey: String
  }
  extend type Mutation {
    updateMyparcelConfig(input: MyparcelConfigInput!): MyparcelConfig
  }

  extend type Query {
    myparcelConfig: MyparcelConfig
  }
`;

/**
 * Graphql resolvers for retrieving and updating myparcel configs for channel
 */
@Resolver()
export class MyparcelAdminResolver {
  constructor(private service: MyparcelService) {}

  @Query()
  @Allow(myparcelPermission.Permission)
  async myparcelConfig(
    @Ctx() ctx: RequestContext
  ): Promise<MyparcelConfigEntity | null> {
    return this.service.getConfig(ctx);
  }

  @Mutation()
  @Allow(myparcelPermission.Permission)
  async updateMyparcelConfig(
    @Ctx() ctx: RequestContext,
    @Args('input') input: { apiKey: string }
  ): Promise<MyparcelConfigEntity | null> {
    return this.service.upsertConfig({
      apiKey: input.apiKey,
      ctx,
    });
  }
}
