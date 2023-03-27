import { Injectable } from '@nestjs/common';
import { OrderList } from '@vendure/common/lib/generated-types';
import {
  Customer,
  CustomerGroup,
  CustomerGroupService,
  CustomerService,
  EntityHydrator,
  ForbiddenError,
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
import {
  AddCustomerToMyCustomerManagedGroupInput,
  CustomerManagedGroup,
  CustomerManagedGroupMember,
} from './generated/graphql';

@Injectable()
export class CustomerManagedGroupsService {
  constructor(
    private orderService: OrderService,
    private customerService: CustomerService,
    private customerGroupService: CustomerGroupService,
    private hydrator: EntityHydrator
  ) {}

  async getOrdersForCustomer(
    ctx: RequestContext
  ): Promise<PaginatedList<Order>> {
    const userId = this.getOrThrowUserId(ctx);
    const customer = await this.getOrThrowCustomerByUserId(ctx, userId);
    const customerManagedGroup = this.getCustomerManagedGroup(customer);
    if (!customerManagedGroup) {
      throw new UserInputError(`You are not in a customer managed group`);
    }
    const isAdmin = this.isAdministratorOfGroup(userId, customerManagedGroup);
    const orders: Order[] = [];
    // If not admin, only fetch orders for the current user
    const customers = isAdmin ? customerManagedGroup.customers : [customer];
    for (const customer of customers) {
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
    {
      emailAddress: inviteeEmailAddress,
      isGroupAdmin: inviteeIsAdmin,
    }: AddCustomerToMyCustomerManagedGroupInput
  ): Promise<CustomerManagedGroup> {
    const userId = this.getOrThrowUserId(ctx);
    let [currentCustomer, invitee] = await Promise.all([
      this.getOrThrowCustomerByUserId(ctx, userId),
      this.getOrThrowCustomerByEmail(ctx, inviteeEmailAddress),
    ]);
    let customerManagedGroup = this.getCustomerManagedGroup(currentCustomer);
    if (customerManagedGroup) {
      this.throwIfNotAdministratorOfGroup(userId, customerManagedGroup);
    }
    if (!customerManagedGroup) {
      Logger.info(
        `Creating new group "${currentCustomer.lastName}'s Group"`,
        loggerCtx
      );
      customerManagedGroup = await this.customerGroupService.create(ctx, {
        name: `${currentCustomer.lastName}'s Group`,
        customerIds: [currentCustomer.id, invitee.id],
        customFields: {
          isCustomerManaged: true,
        },
      });
    }
    const existingAdminIds = (
      customerManagedGroup.customFields.groupAdmins || []
    ).map((admin) => admin.id);
    // Add current customer as admin
    const adminIds = [currentCustomer.id, ...existingAdminIds];
    Logger.info(
      `Adding ${currentCustomer.emailAddress} as administrator of group`,
      loggerCtx
    );
    if (inviteeIsAdmin) {
      // Add invitee as admin
      adminIds.push(invitee.id);
      Logger.info(
        `Adding ${invitee.emailAddress} as administrator of group`,
        loggerCtx
      );
    }
    // Set group admins
    customerManagedGroup = await this.customerGroupService.update(ctx, {
      id: customerManagedGroup.id,
      customFields: {
        groupAdmins: adminIds.map((id) => ({ id })),
      },
    });
    await this.hydrator.hydrate(ctx, customerManagedGroup, {
      relations: ['customers'],
    });
    const existingCustomersIds = customerManagedGroup.customers.map(
      (customer) => customer.id
    );
    if (!existingCustomersIds.includes(invitee.id)) {
      // Add invitee to group
      customerManagedGroup =
        await this.customerGroupService.addCustomersToGroup(ctx, {
          customerGroupId: customerManagedGroup.id,
          customerIds: [invitee.id, ...existingCustomersIds],
        });
      Logger.info(
        `Added ${invitee.emailAddress} as participants of group`,
        loggerCtx
      );
    }
    // Refetch customer and group
    currentCustomer = await this.getOrThrowCustomerByUserId(ctx, userId);
    customerManagedGroup = this.getCustomerManagedGroup(currentCustomer)!;
    return this.mapToCustomerManagedGroup(customerManagedGroup);
  }

  async removeFromGroup(
    ctx: RequestContext,
    customerIdToRemove: ID
  ): Promise<CustomerManagedGroup> {
    const userId = this.getOrThrowUserId(ctx);
    let customer = await this.getOrThrowCustomerByUserId(ctx, userId);
    let customerManagedGroup = this.getCustomerManagedGroup(customer);
    if (!customerManagedGroup) {
      throw new UserInputError(`You are not in a customer managed group`);
    }
    this.throwIfNotAdministratorOfGroup(userId, customerManagedGroup);
    const customerToRemove = customerManagedGroup.customers.find(
      (c) => c.id == customerIdToRemove
    );
    if (!customerToRemove) {
      throw new UserInputError(
        `Customer '${customerIdToRemove}' is not in your group`
      );
    }
    if (customer.id === customerIdToRemove) {
      throw new UserInputError(`You cannot remove yourself from your group`);
    }
    customerManagedGroup =
      await this.customerGroupService.removeCustomersFromGroup(ctx, {
        customerGroupId: customerManagedGroup.id,
        customerIds: [customerIdToRemove],
      });
    Logger.info(
      `Removed customer ${customerToRemove.emailAddress} from group`,
      loggerCtx
    );
    const existingAdminIds =
      customerManagedGroup.customFields.groupAdmins?.map((a) => a.id) || [];
    if (existingAdminIds.includes(customerToRemove.id)) {
      const newAdminIds = existingAdminIds.filter(
        (id) => id != customerToRemove.id
      );
      customerManagedGroup = await this.customerGroupService.update(ctx, {
        id: customerManagedGroup.id,
        customFields: {
          groupAdmins: newAdminIds.map((id) => ({ id })),
        },
      });
      Logger.info(
        `Removed ${customerToRemove.emailAddress} as group administrator`,
        loggerCtx
      );
    }
    // Refetch customer and group
    customer = await this.getOrThrowCustomerByUserId(ctx, userId);
    customerManagedGroup = this.getCustomerManagedGroup(customer);
    return this.mapToCustomerManagedGroup(customerManagedGroup!);
  }

  async getOrThrowCustomerByUserId(
    ctx: RequestContext,
    userId: ID
  ): Promise<CustomerWithCustomFields> {
    const customer = await this.customerService.findOneByUserId(ctx, userId);
    if (!customer) {
      throw new UserInputError(`No customer found for user with id ${userId}`);
    }
    await this.hydrator.hydrate(ctx, customer, {
      relations: ['groups', 'groups.customers'],
    });
    return customer;
  }

  async getOrThrowCustomerByEmail(
    ctx: RequestContext,
    emailAddress: string
  ): Promise<Customer> {
    const customers = await this.customerService.findAll(ctx, {
      filter: {
        emailAddress: {
          eq: emailAddress,
        },
      },
    });
    if (!customers.items[0]) {
      throw new UserInputError(
        `No customer found for email adress ${emailAddress}`
      );
    }
    return customers.items[0];
  }

  /**
   * Get userId from RequestContext or throw a ForbiddenError if not logged in
   */
  getOrThrowUserId(ctx: RequestContext): ID {
    if (!ctx.activeUserId) {
      throw new ForbiddenError();
    }
    return ctx.activeUserId;
  }

  throwIfNotAdministratorOfGroup(
    userId: ID,
    group: CustomerGroupWithCustomFields
  ): void {
    if (!this.isAdministratorOfGroup(userId, group)) {
      throw new UserInputError('You are not administrator of your group');
    }
  }

  isAdministratorOfGroup(
    userId: ID,
    group: CustomerGroupWithCustomFields
  ): boolean {
    return !!group.customFields.groupAdmins?.find(
      (admin) => admin.user!.id == userId
    );
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
  
  
  async activeCustomerManagedGroupAdministrator(
    ctx: RequestContext
  ): Promise<Boolean> {
    const userId = this.getOrThrowUserId(ctx);
    const customer = await this.getOrThrowCustomerByUserId(ctx, userId);
    const customerManagedGroup = this.getCustomerManagedGroup(customer);
    return this.isAdministratorOfGroup(userId!, customerManagedGroup!);
  }

  async myCustomerManagedGroup(
    ctx: RequestContext
  ): Promise<CustomerManagedGroup> {
    const userId = this.getOrThrowUserId(ctx);
    const customer = await this.getOrThrowCustomerByUserId(ctx, userId);
    const customerManagedGroup = this.getCustomerManagedGroup(customer);
    return this.mapToCustomerManagedGroup(customerManagedGroup!);
  }

  mapToCustomerManagedGroup(
    group: CustomerGroupWithCustomFields
  ): CustomerManagedGroup {
    const adminIds =
      group.customFields.groupAdmins?.map((admin) => admin.id) || [];
    // Filter out group administrators
    const participants = group.customers
      .filter((customer) => !adminIds.includes(customer.id))
      .map((c) => this.mapToCustomerManagedGroupMember(c, false));
    const administrators = (group.customFields.groupAdmins || []).map((a) =>
      this.mapToCustomerManagedGroupMember(a, true)
    );
    return {
      ...group,
      customers: [...administrators, ...participants],
    };
  }

  mapToCustomerManagedGroupMember(
    customer: Customer,
    isGroupAdministrator: boolean
  ): CustomerManagedGroupMember {
    return {
      ...customer,
      customerId: customer.id,
      isGroupAdministrator,
    };
  }
}
