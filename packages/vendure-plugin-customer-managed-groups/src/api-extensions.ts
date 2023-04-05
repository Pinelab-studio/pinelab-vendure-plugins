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
  CustomerManagedGroupMember,
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
    """
    Creates a group with the current logged in user as administrator of the group
    """
    addCustomerToMyCustomerManagedGroup(
      input: AddCustomerToMyCustomerManagedGroupInput
    ): CustomerManagedGroup!
    """
    Create an empty group with the current user as Administrator
    """
    createCustomerManagedGroup: CustomerManagedGroup!

    removeCustomerFromMyCustomerManagedGroup(
      customerId: ID!
    ): CustomerManagedGroup!
  }

  extend type Query {
    """
    Fetch placed orders for each member of the group
    """
    ordersForMyCustomerManagedGroup: OrderList!
    """
    Fetch the current logged in group member
    """
    activeCustomerManagedGroupMember: CustomerManagedGroupMember

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
  async activeCustomerManagedGroupMember(
    @Ctx() ctx: RequestContext
  ): Promise<CustomerManagedGroupMember | undefined> {
    return this.service.getActiveMember(ctx);
  }

  @Query()
  @Allow(Permission.Authenticated)
  async myCustomerManagedGroup(
    @Ctx() ctx: RequestContext
  ): Promise<CustomerManagedGroup | undefined> {
    return this.service.myCustomerManagedGroup(ctx);
  }

  @Mutation()
  @Allow(Permission.Authenticated)
  async createCustomerManagedGroup(
    @Ctx() ctx: RequestContext
  ): Promise<CustomerManagedGroup | undefined> {
    return this.service.createCustomerManagedGroup(ctx);
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
