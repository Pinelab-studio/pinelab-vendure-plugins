import { Query, Resolver, Args, Mutation } from '@nestjs/graphql';
import { OrderList } from '@vendure/common/lib/generated-types';
import {
  Allow,
  Ctx,
  ForbiddenError,
  Permission,
  RequestContext,
  Transaction,
  UnauthorizedError,
  UserInputError,
} from '@vendure/core';
import { gql } from 'graphql-tag';
import { CustomerManagedGroupsService } from './customer-managed-groups.service';
import { CustomerManagedGroup } from './generated/graphql';

// This is just to enable static codegen, without starting a server
const scalars = gql`
  scalar DateTime
  scalar OrderList
`;

export const shopSchema = gql`
  type CustomerManagedGroupMember {
    id: ID!
    title: String
    firstName: String!
    lastName: String!
    emailAddress: String!
  }

  type CustomerManagedGroup {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    name: String!
    administrators: [CustomerManagedGroupMember!]!
    participants: [CustomerManagedGroupMember!]!
  }

  extend type Mutation {
    addCustomerToMyCustomerManagedGroup(
      emailAddress: String!
    ): CustomerManagedGroup!
    removeCustomerFromMyCustomerManagedGroup(
      customerId: ID!
    ): CustomerManagedGroup!
  }

  extend type Query {
    ordersForMyCustomerManagedGroup: OrderList!
    myCustomerManagedGroup: CustomerManagedGroup
  }
`;

@Resolver()
export class CustomerManagedGroupsResolver {
  constructor(private service: CustomerManagedGroupsService) {}

  @Query()
  @Allow(Permission.Public)
  async ordersForMyCustomerManagedGroup(
    @Ctx() ctx: RequestContext
  ): Promise<OrderList> {
    await this.service.getOrdersForCustomer(ctx);
    return {
      items: [],
      totalItems: 0,
    };
  }

  @Transaction()
  @Mutation()
  @Allow(Permission.Owner)
  async addCustomerToMyCustomerManagedGroup(
    @Ctx() ctx: RequestContext,
    @Args('emailAddress') emailAddress: string
  ): Promise<CustomerManagedGroup> {
    if (!ctx.activeUserId) {
      throw new ForbiddenError();
    }
    return this.service.addToGroup(ctx, ctx.activeUserId, emailAddress);
  }
}
