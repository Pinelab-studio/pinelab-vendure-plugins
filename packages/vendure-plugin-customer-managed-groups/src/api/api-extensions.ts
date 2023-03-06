import { Query, Resolver, Args } from '@nestjs/graphql';
import { OrderList } from '@vendure/common/lib/generated-types';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { gql } from 'graphql-tag';
import { CustomerGroupExtensionsService } from '../service/customer-group-extensions.service';

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

  extend type Query {
    ordersForMyCustomerManagedGroup: OrderList!
    addCustomerToMyCustomerManagedGroup(
      emailAddress: String!
    ): CustomerManagedGroup!
    removeCustomerFromMyCustomerManagedGroup(
      customerId: ID!
    ): CustomerManagedGroup!
  }
`;

@Resolver()
export class CustomerGroupExtensionsResolver {
  constructor(private service: CustomerGroupExtensionsService) {}

  @Query()
  @Allow(Permission.Public)
  async ordersForCustomerGroup(@Ctx() ctx: RequestContext): Promise<OrderList> {
    await this.service.getOrdersForCustomer(ctx);
    return {
      items: [],
      totalItems: 0,
    };
  }
}
