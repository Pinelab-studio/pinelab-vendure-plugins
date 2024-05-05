import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  ID,
  Order,
  PaginatedList,
  Permission,
  RequestContext,
} from '@vendure/core';
import { CustomerManagedGroupsService } from './customer-managed-groups.service';
import {
  CustomerManagedGroup,
  MutationCreateCustomerManagedGroupArgs,
  MutationMakeCustomerAdminOfCustomerManagedGroupArgs,
  QueryOrdersForCustomerManagedGroupArgs,
} from './generated/admin-graphql';
import {
  AddCustomerToMyCustomerManagedGroupInput,
  CustomerManagedGroupMember,
  UpdateCustomerManagedGroupMemberInput,
} from './generated/shop-graphql';

@Resolver()
export class CustomerManagedGroupsAdminResolver {
  constructor(private service: CustomerManagedGroupsService) {}

  @Query()
  @Allow(Permission.Authenticated)
  ordersForCustomerManagedGroup(
    @Ctx() ctx: RequestContext,
    @Args() args: QueryOrdersForCustomerManagedGroupArgs
  ): Promise<PaginatedList<Order>> {
    return this.service.getOrdersForCustomer(ctx, args.customerManagedGroupId);
  }

  @Mutation()
  @Allow(Permission.Authenticated)
  createCustomerManagedGroup(
    @Ctx() ctx: RequestContext,
    @Args() args: MutationCreateCustomerManagedGroupArgs
  ): Promise<CustomerManagedGroup | undefined> {
    return this.service.createCustomerManagedGroup(ctx, args.customerId);
  }

  @Mutation()
  @Allow(Permission.Authenticated)
  makeCustomerAdminOfCustomerManagedGroup(
    @Ctx() ctx: RequestContext,
    @Args() args: MutationMakeCustomerAdminOfCustomerManagedGroupArgs
  ): Promise<CustomerManagedGroup> {
    return this.service.makeAdminOfGroup(
      ctx,
      args.groupId,
      args.customerId,
      true
    );
  }
}

@Resolver()
export class CustomerManagedGroupsShopResolver {
  constructor(private service: CustomerManagedGroupsService) {}

  @Query()
  @Allow(Permission.Authenticated)
  ordersForMyCustomerManagedGroup(
    @Ctx() ctx: RequestContext
  ): Promise<PaginatedList<Order>> {
    return this.service.getOrdersForCustomer(ctx);
  }

  @Query()
  @Allow(Permission.Authenticated)
  activeCustomerManagedGroupMember(
    @Ctx() ctx: RequestContext
  ): Promise<CustomerManagedGroupMember | undefined> {
    return this.service.getActiveMember(ctx);
  }

  @Query()
  @Allow(Permission.Authenticated)
  myCustomerManagedGroup(
    @Ctx() ctx: RequestContext
  ): Promise<CustomerManagedGroup | undefined> {
    return this.service.myCustomerManagedGroup(ctx);
  }

  @Mutation()
  @Allow(Permission.Authenticated)
  createCustomerManagedGroup(
    @Ctx() ctx: RequestContext
  ): Promise<CustomerManagedGroup | undefined> {
    return this.service.createCustomerManagedGroup(ctx);
  }

  @Mutation()
  @Allow(Permission.Authenticated)
  makeCustomerAdminOfCustomerManagedGroup(
    @Ctx() ctx: RequestContext,
    @Args('groupId') groupId: ID,
    @Args('customerId') customerId: ID
  ): Promise<CustomerManagedGroup> {
    return this.service.makeAdminOfGroup(ctx, groupId, customerId);
  }

  @Mutation()
  @Allow(Permission.Authenticated)
  addCustomerToMyCustomerManagedGroup(
    @Ctx() ctx: RequestContext,
    @Args('input') input: AddCustomerToMyCustomerManagedGroupInput
  ): Promise<CustomerManagedGroup> {
    return this.service.addToGroup(ctx, input);
  }

  @Mutation()
  @Allow(Permission.Authenticated)
  updateCustomerManagedGroupMember(
    @Ctx() ctx: RequestContext,
    @Args('input') input: UpdateCustomerManagedGroupMemberInput
  ): Promise<CustomerManagedGroup> {
    return this.service.updateGroupMember(ctx, input);
  }

  @Mutation()
  @Allow(Permission.Authenticated)
  removeCustomerFromMyCustomerManagedGroup(
    @Ctx() ctx: RequestContext,
    @Args('customerId') customerId: ID
  ): Promise<CustomerManagedGroup> {
    return this.service.removeFromGroup(ctx, customerId);
  }
}
