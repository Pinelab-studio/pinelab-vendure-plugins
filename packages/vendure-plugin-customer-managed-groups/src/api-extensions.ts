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
  UpdateCustomerManagedGroupMemberInput,
} from './generated/graphql';

// This is just to enable static codegen, without starting a server
const scalars = gql`
  scalar DateTime
  scalar OrderList
  scalar LanguageCode
  scalar JSON
`;

export const shopSchema = gql`
  input AddCustomerToMyCustomerManagedGroupInput {
    emailAddress: String!
    isGroupAdmin: Boolean
  }

  input UpdateCustomerManagedGroupMemberInput {
    title: String
    firstName: String
    lastName: String
    emailAddress: String
    addresses: [CustomerManagedGroupAddressInput!]
    customerId: ID!
    customFields: JSON
  }

  """
  When no ID is given, a new address will be created
  """
  input CustomerManagedGroupAddressInput {
    id: ID
    fullName: String
    company: String
    streetLine1: String
    streetLine2: String
    city: String
    province: String
    postalCode: String
    countryCode: String
    phoneNumber: String
    defaultShippingAddress: Boolean
    defaultBillingAddress: Boolean
  }

  type CustomerManagedGroupMember {
    customerId: ID!
    title: String
    addresses: [CustomerManagedGroupAddress!]
    firstName: String!
    lastName: String!
    emailAddress: String!
    isGroupAdministrator: Boolean!
    customFields: JSON
  }

  type CustomerManagedGroupAddress {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    fullName: String
    company: String
    streetLine1: String!
    streetLine2: String
    city: String
    province: String
    postalCode: String
    country: CustomerManagedGroupCountry!
    phoneNumber: String
    defaultShippingAddress: Boolean
    defaultBillingAddress: Boolean
  }

  type CustomerManagedGroupCountry {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    code: String!
    name: String!
    enabled: Boolean!
    translations: [CustomerManagedGroupCountryTranslation!]!
  }

  type CustomerManagedGroupCountryTranslation {
    id: ID!
    languageCode: LanguageCode!
    name: String!
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

    """
    Update a member of one's group
    """
    updateCustomerManagedGroupMember(
      input: UpdateCustomerManagedGroupMemberInput!
    ): CustomerManagedGroup!
    makeCustomerAdminOfCustomerManagedGroup(
      groupId: ID!
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
  async makeCustomerAdminOfCustomerManagedGroup(
    @Ctx() ctx: RequestContext,
    @Args('groupId') groupId: ID,
    @Args('customerId') customerId: ID
  ): Promise<CustomerManagedGroup> {
    return this.service.makeAdminOfGroup(ctx, groupId, customerId);
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
  async updateCustomerManagedGroupMember(
    @Ctx() ctx: RequestContext,
    @Args('input') input: UpdateCustomerManagedGroupMemberInput
  ): Promise<CustomerManagedGroup> {
    return this.service.updateGroupMember(ctx, input);
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
