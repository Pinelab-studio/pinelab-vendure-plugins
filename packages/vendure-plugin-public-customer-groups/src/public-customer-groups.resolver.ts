import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import {
  Ctx,
  RequestContext,
  Customer,
  CustomerService,
  CustomerGroup,
  PaginatedList,
} from '@vendure/core';

@Resolver()
export class PublicCustomerGroupsResolver {
  constructor(private readonly customerService: CustomerService) {}

  @ResolveField('customerGroups')
  @Resolver('Customer')
  async customerGroups(
    @Ctx() ctx: RequestContext,
    @Parent() customer: Customer
  ): Promise<CustomerGroup[]> {
    const customerGroups = await this.customerService.getCustomerGroups(
      ctx,
      customer.id
    );
    return customerGroups.filter((group) => !!group.customFields.isPublic);
  }

  @ResolveField('customers')
  @Resolver('CustomerGroup')
  async customers(
    @Ctx() ctx: RequestContext,
    @Parent() _: CustomerGroup
  ): Promise<PaginatedList<Customer>> {
    return { items: [], totalItems: 0 };
  }
}
