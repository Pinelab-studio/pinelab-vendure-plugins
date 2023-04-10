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
  UserService,
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
  UpdateCustomerManagedGroupMemberInput,
} from './generated/graphql';
import { getRepository } from 'typeorm';

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
      customerManagedGroup = await this.createGroup(ctx, currentCustomer, [
        invitee.id,
      ]);
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

  /**
   * Get current logged in member, or undefined if not in a group
   */
  async getActiveMember(
    ctx: RequestContext
  ): Promise<CustomerManagedGroupMember | undefined> {
    const userId = this.getOrThrowUserId(ctx);
    const customer = await this.getOrThrowCustomerByUserId(ctx, userId);
    const customerManagedGroup = this.getCustomerManagedGroup(customer);
    if (!customerManagedGroup) {
      return;
    }
    const isAdministrator = this.isAdministratorOfGroup(
      userId,
      customerManagedGroup
    );
    return this.mapToCustomerManagedGroupMember(customer, isAdministrator);
  }

  async myCustomerManagedGroup(
    ctx: RequestContext
  ): Promise<CustomerManagedGroup | undefined> {
    const userId = this.getOrThrowUserId(ctx);
    const customer = await this.getOrThrowCustomerByUserId(ctx, userId);
    let customerManagedGroup = this.getCustomerManagedGroup(customer);
    if (!customerManagedGroup) {
      return undefined;
    }
    return this.mapToCustomerManagedGroup(customerManagedGroup);
  }

  async createCustomerManagedGroup(
    ctx: RequestContext
  ): Promise<CustomerManagedGroup> {
    const userId = this.getOrThrowUserId(ctx);
    const currentCustomer = await this.getOrThrowCustomerByUserId(ctx, userId);
    let customerManagedGroup = this.getCustomerManagedGroup(currentCustomer);
    if (customerManagedGroup) {
      throw new UserInputError(`You are already in a customer managed group`);
    }
    customerManagedGroup = await this.createGroup(ctx, currentCustomer);
    await this.hydrator.hydrate(ctx, customerManagedGroup, {
      relations: ['customers'],
    });
    return this.mapToCustomerManagedGroup(customerManagedGroup);
  }

  /**
   *
   * @param ctx Internal function to create a customer managed group based
   * @param groupAdmin
   * @param additionalMembers add addtional members to the group. Group admin is already added as member
   */
  private createGroup(
    ctx: RequestContext,
    groupAdmin: Customer,
    additionalMembers?: ID[]
  ): Promise<CustomerGroupWithCustomFields> {
    const members = [groupAdmin.id];
    if (additionalMembers) {
      members.push(...additionalMembers);
    }
    return this.customerGroupService.create(ctx, {
      name: `${groupAdmin.lastName}'s Group`,
      customerIds: members,
      customFields: {
        isCustomerManaged: true,
        groupAdmins: [groupAdmin],
      },
    });
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

  async updateGroupMember(
    ctx: RequestContext,
    input: UpdateCustomerManagedGroupMemberInput
  ): Promise<CustomerManagedGroup> {
    if (
      !input.title &&
      !input.firstName &&
      !input.lastName &&
      !input.emailAddress
    ) {
      throw new UserInputError(`Make sure to include fields to be updated`);
    }
    const myGroup = await this.myCustomerManagedGroup(ctx);
    if (myGroup) {
      const groupAdmin = myGroup.customers.find((c) => c.isGroupAdministrator);
      if (!groupAdmin) {
        throw new UserInputError('group has no admin');
      }
      const groupAdminCustomer = await this.customerService.findOne(
        ctx,
        groupAdmin?.customerId,
        ['user']
      );
      const member = myGroup.customers.find(
        (customer) => customer.customerId === input.customerId
      );
      if (member) {
        const userRepo = getRepository(User);
        const customer = await this.customerService.findOne(
          ctx,
          member.customerId,
          ['user']
        );
        if (!customer || !customer.user) {
          throw new UserInputError(
            `No customer with id ${input.customerId} exists`
          );
        }
        if (
          groupAdminCustomer?.user?.id != ctx.activeUserId &&
          customer.user.id != ctx.activeUserId
        ) {
          throw new UserInputError(
            `You are not allowed to update other member's details`
          );
        }
        if (input.emailAddress) {
          if (
            await userRepo.count({
              where: { identifier: input.emailAddress },
            })
          ) {
            throw new UserInputError('User with this email already exists');
          }
        }
        const updateUserData = {
          id: customer.id,
          ...(input.title ? { title: input.title } : []),
          ...(input.firstName ? { firstName: input.firstName } : []),
          ...(input.lastName ? { lastName: input.lastName } : []),
          ...(input.emailAddress ? { emailAddress: input.emailAddress } : []),
        };
        await this.customerService.update(ctx, updateUserData);
        const newGroupData = await this.myCustomerManagedGroup(ctx);
        return newGroupData!;
      }
      throw new UserInputError(
        `No customer with id ${input.customerId} exists in '${myGroup.name}' customer managed group`
      );
    }
    throw new UserInputError(
      `No customer managed group exists for the authenticated customer`
    );
  }

  async makeAdminOfGroup(
    ctx: RequestContext,
    groupId: ID,
    customerId: ID
  ): Promise<CustomerManagedGroup> {
    const customerGroup = await this.customerGroupService.findOne(
      ctx,
      groupId,
      ['customers', 'customers.user']
    );
    if (
      !customerGroup ||
      !customerGroup.customFields ||
      !(customerGroup.customFields as any).isCustomerManaged
    ) {
      throw new UserInputError(
        `No customer managed group with id ${groupId} exists`
      );
    }
    if (
      !(customerGroup.customFields as any).groupAdmins.find(
        (admin: Customer) => admin.user?.id === ctx.activeUserId
      )
    ) {
      throw new UserInputError(
        `You are not admin of this customer managed group`
      );
    }
    const customerInQuestion = await customerGroup.customers.find(
      (c) => c.id === customerId
    );
    if (!customerInQuestion) {
      throw new UserInputError(
        `Customer with id ${customerId} is not part of this customer managed group`
      );
    }
    if (
      (customerGroup.customFields as any).groupAdmins.find(
        (admin: Customer) => admin.id === customerId
      )
    ) {
      throw new UserInputError(
        'Customer is already admin of this customer managed group'
      );
    }
    const customerGroupRepo = getRepository(CustomerGroup);
    const partialValue = {
      id: customerGroup.id,
      customFields: {
        groupAdmins: [
          ...(customerGroup.customFields as any).groupAdmins,
          customerInQuestion,
        ],
      },
    };
    const reponse = await customerGroupRepo.save(partialValue);
    return this.mapToCustomerManagedGroup(
      (await this.customerGroupService.findOne(ctx, groupId, ['customers']))!
    );
  }
}
