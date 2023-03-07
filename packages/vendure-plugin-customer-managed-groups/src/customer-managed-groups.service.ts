import { Injectable } from '@nestjs/common';
import { OrderList } from '@vendure/common/lib/generated-types';
import {
  CustomerGroup,
  CustomerGroupService,
  CustomerService,
  EntityHydrator,
  ID,
  Logger,
  Order,
  OrderService,
  PaginatedList,
  RequestContext,
  User,
  UserInputError,
} from '@vendure/core';
import { loggerCtx } from './constants';
import {
  CustomerGroupWithCustomFields,
  CustomerWithCustomFields,
} from './custom-fields';
import { CustomerManagedGroup } from './generated/graphql';

@Injectable()
export class CustomerManagedGroupsService {
  constructor(
    private orderService: OrderService,
    private customerService: CustomerService,
    private customerGroupService: CustomerGroupService,
    private hydrator: EntityHydrator
  ) {}

  async getOrdersForCustomer(
    ctx: RequestContext,
    userId: ID
  ): Promise<PaginatedList<Order>> {
    const customer = await this.getOrThrowCustomer(ctx, userId);
    const customerManagedGroup = this.getCustomerManagedGroup(customer);
    if (!customerManagedGroup) {
      throw new UserInputError(`You are not in a customer managed group`);
    }
    this.throwIfNotAdministratorOfGroup(userId, customerManagedGroup);
    const orders: Order[] = [];
    await this.hydrator.hydrate(ctx, customerManagedGroup, {
      relations: ['customers'],
    });
    const dinges = await this.orderService.findAll(ctx);
    console.log('ORDESRS', dinges.items);
    for (const customer of customerManagedGroup.customers) {
      const ordersForCustomer = await this.orderService.findByCustomerId(
        ctx,
        customer.id
      );
      Logger.info(
        `Found ${ordersForCustomer.items.length} orders for customer ${customer.emailAddress}`,
        loggerCtx
      );
      orders.push(...ordersForCustomer.items);
      if (ordersForCustomer.totalItems > ordersForCustomer.items.length) {
        throw Error(
          `Too many orders for customer ${customer.emailAddress}, pagination is not implemented yet.`
        );
      }
    }
    return {
      items: orders,
      totalItems: orders.length,
    };
  }

  async addToGroup(
    ctx: RequestContext,
    userId: ID,
    inviteeEmailAddress: string
  ): Promise<CustomerManagedGroup> {
    const [user, invitees] = await Promise.all([
      this.getOrThrowCustomer(ctx, userId),
      this.customerService.findAll(
        ctx,
        {
          filter: {
            emailAddress: {
              eq: inviteeEmailAddress,
            },
          },
        },
        ['groups']
      ),
    ]);
    if (!invitees.items[0]) {
      throw new UserInputError(
        `No customer found for email adress ${inviteeEmailAddress}`
      );
    }
    const invitee = invitees.items[0];
    let customerManagedGroup = this.getCustomerManagedGroup(user);
    if (customerManagedGroup) {
      this.throwIfNotAdministratorOfGroup(userId, customerManagedGroup);
    }
    if (!customerManagedGroup) {
      Logger.info(
        `Creating new group with owner ${user.emailAddress} and invitee ${invitee.emailAddress}`,
        loggerCtx
      );
      customerManagedGroup = await this.customerGroupService.create(ctx, {
        name: `${user.lastName}'s Group`,
        customerIds: [user.id, invitee.id],
        customFields: {
          isCustomerManaged: true,
        },
      });
    }
    if (
      !customerManagedGroup.customFields.groupAdmins?.find(
        (admin) => admin.id === user.id
      )
    ) {
      // Add owner as group admin
      const existingAdmins = (
        customerManagedGroup.customFields.groupAdmins || []
      ).map((admin) => ({ id: admin.id }));
      customerManagedGroup = await this.customerGroupService.update(ctx, {
        id: customerManagedGroup.id,
        customFields: {
          groupAdmins: [
            {
              id: user.id,
              ...existingAdmins,
            },
          ],
        },
      });
    }
    await this.hydrator.hydrate(ctx, customerManagedGroup, {
      relations: ['customers'],
    });
    const existingCustomersIds = customerManagedGroup.customers.map(
      (customer) => customer.id
    );
    // Add invitee to group
    customerManagedGroup = await this.customerGroupService.addCustomersToGroup(
      ctx,
      {
        customerGroupId: customerManagedGroup.id,
        customerIds: [invitee.id, ...existingCustomersIds],
      }
    );
    await this.hydrator.hydrate(ctx, customerManagedGroup, {
      relations: ['customers'],
    });
    return this.mapToCustomerManagedGroup(customerManagedGroup);
  }

  async getOrThrowCustomer(
    ctx: RequestContext,
    userId: ID
  ): Promise<CustomerWithCustomFields> {
    const customer = await this.customerService.findOne(ctx, userId, [
      'groups',
    ]);
    if (!customer) {
      throw new UserInputError(`No customer found for user with id ${userId}`);
    }
    return customer;
  }

  throwIfNotAdministratorOfGroup(
    userId: ID,
    group: CustomerGroupWithCustomFields
  ): void {
    const isAdmin = !!group.customFields.groupAdmins?.find(
      (admin) => admin.id == userId
    );
    if (!isAdmin) {
      throw new UserInputError('You are not administrator of your group');
    }
  }

  getCustomerManagedGroup(
    customer: CustomerWithCustomFields
  ): CustomerGroupWithCustomFields | undefined {
    if (!customer.groups) {
      throw Error(
        `Make sure to include groups in the customer query. Can not find customer managed group for customer ${customer.emailAddress}`
      );
    }
    return customer.groups.find(
      (group) => group.customFields.isCustomerManaged
    );
  }

  mapToCustomerManagedGroup(
    group: CustomerGroupWithCustomFields
  ): CustomerManagedGroup {
    const adminIds =
      group.customFields.groupAdmins?.map((admin) => admin.id) || [];
    const participants = group.customers.filter(
      (customer) => !adminIds.includes(customer.id)
    );
    return {
      ...group,
      administrators: group.customFields.groupAdmins || [],
      participants,
    };
  }
}
