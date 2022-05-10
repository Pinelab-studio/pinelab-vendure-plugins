import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import { MyparcelService } from './myparcel.service';
import { myparcelPermission } from '../index';
import { MyparcelConfigEntity } from './myparcel-config.entity';
import {
  MyparcelDropOffPoint,
  MyparcelDropOffPointInput,
} from '../generated/graphql';
import gql from 'graphql-tag';

export const shopSchema = gql`
  type MyparcelDropOffPoint {
    location_code: String!
    location_name: String!
    city: String!
    postal_code: String!
    street: String!
    number: String!
    number_suffix: String
    phone: String
    reference: String
    longitude: String
    latitude: String
    available_days: [Int!]!
    cut_off_time: String
    carrier_id: Int
    distance: Int
  }

  input MyparcelDropOffPointInput {
    carrierId: String
    countryCode: String
    postalCode: String!
  }
  extend type Query {
    myparcelDropOffPoints(
      input: MyparcelDropOffPointInput!
    ): [MyparcelDropOffPoint!]!
  }
`;

@Resolver()
export class MyParcelShopResolver {
  constructor(private service: MyparcelService) {}

  @Query()
  async myparcelDropOffPoints(
    @Ctx() ctx: RequestContext,
    @Args('input') input: MyparcelDropOffPointInput
  ): Promise<MyparcelDropOffPoint[]> {
    return this.service.getDropOffPoints(ctx, input);
  }
}
