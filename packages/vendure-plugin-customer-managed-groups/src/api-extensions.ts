import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  ForbiddenError,
  Order,
  PaginatedList,
  Permission,
  RequestContext,
  Transaction,
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
  @Allow(Permission.Authenticated)
  async ordersForMyCustomerManagedGroup(
    @Ctx() ctx: RequestContext
  ): Promise<PaginatedList<Order>> {
    if (!ctx.activeUserId) {
      throw new ForbiddenError();
    }
    return this.service.getOrdersForCustomer(ctx, ctx.activeUserId);
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