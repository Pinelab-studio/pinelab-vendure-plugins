import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  ForbiddenError,
  ID,
  Order,
  PaginatedList,
  Permission,
  RequestContext,
} from '@vendure/core';
import { gql } from 'graphql-tag';
import { CustomerManagedGroupsService } from './customer-managed-groups.service';
import {
  AddCustomerToMyCustomerManagedGroupInput,
  CustomerManagedGroup,
} from './generated/graphql';

// This is just to enable static codegen, without starting a server
const scalars = gql`
  scalar DateTime
  scalar OrderList
`;

export const shopSchema = gql`
  input AddCustomerToMyCustomerManagedGroupInput {
    emailAddress: String!
    isGroupAdmin: Boolean
  }

  type CustomerManagedGroupMember {
    customerId: ID!
    title: String
    firstName: String!
    lastName: String!
    emailAddress: String!
    isGroupAdministrator: Boolean!
  }

  type CustomerManagedGroup {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    name: String!
    customers: [CustomerManagedGroupMember!]!
  }

  extend type Mutation {
    addCustomerToMyCustomerManagedGroup(
      input: AddCustomerToMyCustomerManagedGroupInput
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
    return this.service.getOrdersForCustomer(ctx);
  }

  @Query()
  @Allow(Permission.Authenticated)
  async myCustomerManagedGroup(
    @Ctx() ctx: RequestContext
  ): Promise<CustomerManagedGroup> {
    return this.service.myCustomerManagedGroup(ctx);
  }

  @Mutation()
  @Allow(Permission.Authenticated)
  async addCustomerToMyCustomerManagedGroup(
    @Ctx() ctx: RequestContext,
    @Args('input') input: AddCustomerToMyCustomerManagedGroupInput
  ): Promise<CustomerManagedGroup> {
    return this.service.addToGroup(ctx, input);
  }

  @Mutation()
  @Allow(Permission.Authenticated)
  async removeCustomerFromMyCustomerManagedGroup(
    @Ctx() ctx: RequestContext,
    @Args('customerId') customerId: ID
  ): Promise<CustomerManagedGroup> {
    return this.service.removeFromGroup(ctx, customerId);
  }
}
