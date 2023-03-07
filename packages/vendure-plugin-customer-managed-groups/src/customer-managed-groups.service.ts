import { Injectable } from '@nestjs/common';
import {
  CustomerGroup,
  CustomerGroupService,
  CustomerService,
  EntityHydrator,
  ID,
  Logger,
  OrderService,
  RequestContext,
  UserInputError,
} from '@vendure/core';
import { loggerCtx } from './constants';
import { CustomerManagedGroup } from './generated/graphql';
import {
  CustomerGroupWithCustomFields,
  CustomerWithCustomFields,
} from './custom-fields';

@Injectable()
export class CustomerManagedGroupsService {
  constructor(
    private orderService: OrderService,
    private customerService: CustomerService,
    private customerGroupService: CustomerGroupService,
    private hydrator: EntityHydrator
  ) {}

  async getOrdersForCustomer(ctx: RequestContext) {
    return;
  }

  async addToGroup(
    ctx: RequestContext,
    groupOwnerUserId: ID,
    inviteeEmailAddress: string
  ): Promise<CustomerManagedGroup> {
    const [owner, invitees] = await Promise.all([
      this.customerService.findOne(ctx, groupOwnerUserId, ['groups']),
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
    if (!owner) {
      throw new UserInputError(
        `No customer found for user with id ${groupOwnerUserId}`
      );
    }
    if (!invitees.items[0]) {
      throw new UserInputError(
        `No customer found for email adress ${inviteeEmailAddress}`
      );
    }
    const invitee = invitees.items[0];
    let customerManagedGroup = (owner as CustomerWithCustomFields).groups.find(
      (group) => group.customFields.isCustomerManaged
    );
    const isOwnerAdmin = customerManagedGroup?.customFields.groupAdmins?.find(
      (admin) => admin.id === owner.id
    );
    if (customerManagedGroup && !isOwnerAdmin) {
      throw new UserInputError(
        `Customer ${owner.emailAddress} is not group administrator`
      );
    }
    if (!customerManagedGroup) {
      Logger.info(
        `Creating new group with owner ${owner.emailAddress} and invitee ${invitee.emailAddress}`,
        loggerCtx
      );
      customerManagedGroup = await this.customerGroupService.create(ctx, {
        name: `${owner.lastName}'s Group`,
        customerIds: [owner.id, invitee.id],
        customFields: {
          isCustomerManaged: true,
        },
      });
    }
    if (
      !customerManagedGroup.customFields.groupAdmins?.find(
        (admin) => admin.id === owner.id
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
              id: owner.id,
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
