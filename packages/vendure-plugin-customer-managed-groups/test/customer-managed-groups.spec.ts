import { DefaultLogger, LogLevel, mergeConfig } from '@vendure/core';
import {
  createTestEnvironment,
  registerInitializer,
  SimpleGraphQLClient,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { TestServer } from '@vendure/testing/lib/test-server';
import { initialData } from '../../test/src/initial-data';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import { CustomerManagedGroupsPlugin } from '../src';
import {
  activeCustomerManagedGroupMemberQuery,
  addCustomerToGroupMutation,
  createCustomerManagedGroupMutation,
  getOrdersForMyCustomerManagedGroup,
  makeCustomerAdminOfCustomerManagedGroupMutation,
  myCustomerManagedGroupQuery,
  removeCustomerFromGroupMutation,
  updateCustomerManagedGroupMemberMutation,
} from './test-helpers';
import { createSettledOrder } from '../../test/src/shop-utils';
import { Address } from '../../test/src/generated/shop-graphql';
import { expect, describe, beforeAll, afterAll, it, vi, test } from 'vitest';

describe('Customer managed groups', function () {
  let server: TestServer;
  let adminClient: SimpleGraphQLClient;
  let shopClient: SimpleGraphQLClient;
  let serverStarted = false;

  beforeAll(async () => {
    registerInitializer('sqljs', new SqljsInitializer('__data__'));
    const config = mergeConfig(testConfig, {
      logger: new DefaultLogger({ level: LogLevel.Debug }),
      plugins: [CustomerManagedGroupsPlugin],
      paymentOptions: {
        paymentMethodHandlers: [testPaymentMethod],
      },
      // Test if we can retrieve custom fields on an order
      customFields: {
        Order: [
          {
            name: 'testing',
            type: 'string',
            defaultValue: 'just a test',
            public: true,
          },
        ],
        Customer: [
          {
            name: 'birthday',
            type: 'string',
            defaultValue: '',
            public: false,
          },
        ],
      },
    });

    ({ server, adminClient, shopClient } = createTestEnvironment(config));
    await server.init({
      initialData: {
        ...initialData,
        paymentMethods: [
          {
            name: testPaymentMethod.code,
            handler: { code: testPaymentMethod.code, arguments: [] },
          },
        ],
      },
      productsCsvPath: '../test/src/products-import.csv',
      customerCount: 5,
    });
  }, 60000);

  async function authorizeAsGroupAdmin(): Promise<void> {
    await shopClient.asUserWithCredentials(
      'hayden.zieme12@hotmail.com',
      'test',
    );
  }

  async function authorizeAsGroupParticipant(): Promise<void> {
    await shopClient.asUserWithCredentials('eliezer56@yahoo.com', 'test');
  }

  it('Should start successfully', async () => {
    expect(server.app.getHttpServer).toBeDefined;
  });

  it('Fails for unauthenticated calls', async () => {
    expect.assertions(1);
    try {
      await shopClient.query(addCustomerToGroupMutation, {
        input: {
          emailAddress: 'marques.sawayn@hotmail.com',
        },
      });
    } catch (e) {
      expect((e as any).response.errors[0].message).toBe(
        'You are not currently authorized to perform this action',
      );
    }
  });

  it('Returns undefined for myCustomerManagedGroup when not in a group', async () => {
    await authorizeAsGroupAdmin();
    const { myCustomerManagedGroup: group } = await shopClient.query(
      myCustomerManagedGroupQuery,
    );
    expect(group).toBe(null);
  });

  it('Returns undefined for activeCustomerManagedGroupMember when not in a group', async () => {
    await authorizeAsGroupAdmin();
    const { activeCustomerManagedGroupMember: member } = await shopClient.query(
      activeCustomerManagedGroupMemberQuery,
    );
    expect(member).toBe(null);
  });

  it('Adds a customer to my group', async () => {
    await authorizeAsGroupAdmin();
    const { addCustomerToMyCustomerManagedGroup: group } =
      await shopClient.query(addCustomerToGroupMutation, {
        input: {
          emailAddress: 'marques.sawayn@hotmail.com',
        },
      });
    const hayden = group.customers.find(
      (c: any) => c.emailAddress === 'hayden.zieme12@hotmail.com',
    );
    const marques = group.customers.find(
      (c: any) => c.emailAddress === 'marques.sawayn@hotmail.com',
    );
    expect(group.name).toBe("Zieme's Group");
    expect(hayden.isGroupAdministrator).toBe(true);
    expect(marques.isGroupAdministrator).toBe(false);
  });

  it('Returns active member when in a group', async () => {
    await authorizeAsGroupAdmin();
    const { activeCustomerManagedGroupMember: member } = await shopClient.query(
      activeCustomerManagedGroupMemberQuery,
    );
    expect(member.isGroupAdministrator).toBe(true);
  });

  it('Returns my group', async () => {
    await authorizeAsGroupAdmin();
    const { myCustomerManagedGroup: group } = await shopClient.query(
      myCustomerManagedGroupQuery,
    );
    expect(group.name).toBe("Zieme's Group");
  });

  it('Adds another customer to my group', async () => {
    await authorizeAsGroupAdmin();
    const { addCustomerToMyCustomerManagedGroup: group } =
      await shopClient.query(addCustomerToGroupMutation, {
        input: {
          emailAddress: 'eliezer56@yahoo.com',
        },
      });
    const marques = group.customers.find(
      (c: any) => c.emailAddress === 'marques.sawayn@hotmail.com',
    );
    const eliezer = group.customers.find(
      (c: any) => c.emailAddress === 'eliezer56@yahoo.com',
    );
    expect(marques.isGroupAdministrator).toBe(false);
    expect(eliezer.isGroupAdministrator).toBe(false);
  });

  it('Fails to create a group if user is already in a group', async () => {
    expect.assertions(1);
    await authorizeAsGroupAdmin();
    try {
      await shopClient.query(createCustomerManagedGroupMutation);
    } catch (e) {
      expect((e as any).response.errors[0].message).toBe(
        'You are already in a customer managed group',
      );
    }
  });

  it('Fails when a participant tries to add customers', async () => {
    expect.assertions(1);
    await authorizeAsGroupParticipant();
    try {
      await shopClient.query(addCustomerToGroupMutation, {
        input: {
          emailAddress: 'marques.sawayn@hotmail.com',
        },
      });
    } catch (e) {
      expect((e as any).response.errors[0].message).toBe(
        'You are not administrator of your group',
      );
    }
  });

  it('Places an order for the group participant', async () => {
    await authorizeAsGroupParticipant();
    const order = await createSettledOrder(shopClient, 1, false);
    expect(order.code).toBeDefined();
  });

  it('Places an order for the group admin', async () => {
    await authorizeAsGroupAdmin();
    const order = await createSettledOrder(shopClient, 1, false);
    expect(order.code).toBeDefined();
  });

  it('Fails to fetch orders when unauthenticated', async () => {
    expect.assertions(1);
    await shopClient.asAnonymousUser();
    try {
      await shopClient.query(getOrdersForMyCustomerManagedGroup);
    } catch (e) {
      expect((e as any).response.errors[0].message).toBe(
        'You are not currently authorized to perform this action',
      );
    }
  });

  it('Fetches 2 orders for the group admin', async () => {
    await authorizeAsGroupAdmin();
    const orders = await shopClient.query(getOrdersForMyCustomerManagedGroup);
    expect(orders.ordersForMyCustomerManagedGroup.totalItems).toBe(2);
    expect(orders.ordersForMyCustomerManagedGroup.items[0].code).toBeDefined();
    expect(orders.ordersForMyCustomerManagedGroup.items[1].code).toBeDefined();
    expect(
      orders.ordersForMyCustomerManagedGroup.items[1].lines.length,
    ).toBeGreaterThan(0);
    expect(
      orders.ordersForMyCustomerManagedGroup.items[1].payments.length,
    ).toBeGreaterThan(0);
    expect(
      orders.ordersForMyCustomerManagedGroup.items[1].customFields.testing,
    ).toBe('just a test');
  });

  it('Fetches 1 order for the group participant', async () => {
    await authorizeAsGroupParticipant();
    const orders = await shopClient.query(getOrdersForMyCustomerManagedGroup);
    expect(orders.ordersForMyCustomerManagedGroup.totalItems).toBe(1);
  });

  it('Fails to remove as group participant', async () => {
    expect.assertions(1);
    await authorizeAsGroupParticipant();
    try {
      await shopClient.query(removeCustomerFromGroupMutation, {
        customerId: '3', // marques.sawayn@hotmail.com
      });
    } catch (e) {
      expect((e as any).response.errors[0].message).toBe(
        'You are not administrator of your group',
      );
    }
  });

  it('Removes customer ', async () => {
    await authorizeAsGroupAdmin();
    const { removeCustomerFromMyCustomerManagedGroup: group } =
      await shopClient.query(removeCustomerFromGroupMutation, {
        customerId: '3', // marques.sawayn@hotmail.com
      });
    const marques = group.customers.find(
      (c: any) => c.emailAddress === 'marques.sawayn@hotmail.com',
    );
    expect(marques).toBeUndefined();
  });

  it('Adds another group admin to my group', async () => {
    await authorizeAsGroupAdmin();
    const { addCustomerToMyCustomerManagedGroup: group } =
      await shopClient.query(addCustomerToGroupMutation, {
        input: {
          emailAddress: 'marques.sawayn@hotmail.com',
          isGroupAdmin: true,
        },
      });
    const marques = group.customers.find(
      (c: any) => c.emailAddress === 'marques.sawayn@hotmail.com',
    );
    expect(marques.isGroupAdministrator).toBe(true);
  });

  it('Removes an admin from the group', async () => {
    await authorizeAsGroupAdmin();
    const { removeCustomerFromMyCustomerManagedGroup: group } =
      await shopClient.query(removeCustomerFromGroupMutation, {
        customerId: '3', // marques.sawayn@hotmail.com
      });
    const marques = group.customers.find(
      (c: any) => c.emailAddress === 'marques.sawayn@hotmail.com',
    );
    expect(marques).toBeUndefined();
  });

  it('Members can update their own profiles with this query', async () => {
    await authorizeAsGroupParticipant();
    const { myCustomerManagedGroup: group } = await shopClient.query(
      myCustomerManagedGroupQuery,
    );
    const authorizedCustomer = group.customers.find(
      (c: any) => c.emailAddress === 'eliezer56@yahoo.com',
    );
    const { updateCustomerManagedGroupMember: newGroup } =
      await shopClient.query(updateCustomerManagedGroupMemberMutation, {
        input: {
          lastName: 'Teklu',
          customerId: authorizedCustomer.customerId,
        },
      });
    const authorizedCustomerUpdated = newGroup.customers.find(
      (c: any) => c.emailAddress === 'eliezer56@yahoo.com',
    );
    expect(authorizedCustomerUpdated.lastName).toBe('Teklu');
  });

  it('Members can not update any other profiles ', async () => {
    await authorizeAsGroupParticipant();
    const { myCustomerManagedGroup: group } = await shopClient.query(
      myCustomerManagedGroupQuery,
    );
    const unAuthorizedCustomer = group.customers.find(
      (c: any) => c.emailAddress === 'hayden.zieme12@hotmail.com',
    );
    try {
      const { updateCustomerManagedGroupMember: newGroup } =
        await shopClient.query(updateCustomerManagedGroupMemberMutation, {
          input: {
            lastName: 'Teklu',
            customerId: unAuthorizedCustomer.customerId,
          },
        });
    } catch (e) {
      expect((e as any).response.errors[0].message).toBe(
        `You are not allowed to update other member's details`,
      );
    }
  });
  it('Unauthenticated users can not update any profiles', async () => {
    await shopClient.asAnonymousUser();
    try {
      const { updateCustomerManagedGroupMember: newGroup } =
        await shopClient.query(updateCustomerManagedGroupMemberMutation, {
          input: {
            lastName: 'Teklu',
            customerId: 1,
          },
        });
    } catch (e) {
      expect((e as any).response.errors[0].message).toBe(
        `You are not currently authorized to perform this action`,
      );
    }
  });

  it('Administrators can update their own profiles ', async () => {
    await authorizeAsGroupAdmin();
    const { myCustomerManagedGroup: group } = await shopClient.query(
      myCustomerManagedGroupQuery,
    );
    const groupAdmin = group.customers.find((c: any) => c.isGroupAdministrator);
    const { updateCustomerManagedGroupMember: newGroup } =
      await shopClient.query(updateCustomerManagedGroupMemberMutation, {
        input: {
          firstName: 'Semahegn',
          customerId: groupAdmin.customerId,
        },
      });
    const authorizedCustomerUpdated = newGroup.customers.find(
      (c: any) => c.isGroupAdministrator,
    );
    expect(authorizedCustomerUpdated.firstName).toBe('Semahegn');
  });

  it('Administrators can update members of their group ', async () => {
    await authorizeAsGroupAdmin();
    const { myCustomerManagedGroup: group } = await shopClient.query(
      myCustomerManagedGroupQuery,
    );
    const groupMember = group.customers.find(
      (c: any) => c.emailAddress === 'eliezer56@yahoo.com',
    );
    const { updateCustomerManagedGroupMember: newGroup } =
      await shopClient.query(updateCustomerManagedGroupMemberMutation, {
        input: {
          emailAddress: 'mohammed.salah@gmail.com',
          customerId: groupMember.customerId,
        },
      });
    const updatedGroupMember = newGroup.customers.find(
      (c: any) => c.customerId === groupMember.customerId,
    );
    expect(updatedGroupMember.emailAddress).toBe('mohammed.salah@gmail.com');
  });

  it('Administrators can not update members of other groups ', async () => {
    await shopClient.asUserWithCredentials(
      'stewart.lindgren@gmail.com',
      'test',
    );
    const { createCustomerManagedGroup: groupData } = await shopClient.query(
      createCustomerManagedGroupMutation,
    );
    try {
      const { updateCustomerManagedGroupMember: newGroup } =
        await shopClient.query(updateCustomerManagedGroupMemberMutation, {
          input: {
            lastName: 'Teklu',
            customerId: 1,
          },
        });
    } catch (e) {
      expect((e as any).response.errors[0].message).toBe(
        `No customer with id 1 exists in '${groupData.name}' customer managed group`,
      );
    }
  });

  it('Administrators can assign other members as administrators ', async () => {
    await authorizeAsGroupAdmin();
    const { myCustomerManagedGroup: group } = await shopClient.query(
      myCustomerManagedGroupQuery,
    );
    const { makeCustomerAdminOfCustomerManagedGroup: updatedGroup } =
      await shopClient.query(makeCustomerAdminOfCustomerManagedGroupMutation, {
        groupId: group.id,
        customerId: 4,
      });
    const updatedCustomer = updatedGroup.customers.find(
      (c: any) => c.customerId === 'T_4',
    );
    expect(updatedCustomer.isGroupAdministrator).toBe(true);
  });

  it('Administrators can also update other administrators in their group ', async () => {
    await authorizeAsGroupAdmin();
    const { myCustomerManagedGroup: group } = await shopClient.query(
      myCustomerManagedGroupQuery,
    );
    const updatedCustomer = group.customers.find(
      (c: any) => c.customerId === 'T_4',
    );
    expect(updatedCustomer.isGroupAdministrator).toBe(true);
    const { updateCustomerManagedGroupMember: newGroup } =
      await shopClient.query(updateCustomerManagedGroupMemberMutation, {
        input: {
          emailAddress: 'selam.lalem@gmail.com',
          customerId: updatedCustomer.customerId,
        },
      });
    const updatedGroupMember = newGroup.customers.find(
      (c: any) => c.customerId === updatedCustomer.customerId,
    );
    expect(updatedGroupMember.emailAddress).toBe('selam.lalem@gmail.com');
  });

  it('Administrators can create new addresses for themselves', async () => {
    await authorizeAsGroupAdmin();
    const { myCustomerManagedGroup: group } = await shopClient.query(
      myCustomerManagedGroupQuery,
    );
    const groupAdmin = group.customers.find((c: any) => c.isGroupAdministrator);
    const { updateCustomerManagedGroupMember: newGroup } =
      await shopClient.query(updateCustomerManagedGroupMemberMutation, {
        input: {
          addresses: [
            {
              streetLine1: 'Selam Street',
              countryCode: 'US',
            },
          ],
          customerId: groupAdmin.customerId,
        },
      });
    const authorizedCustomerUpdated = newGroup.customers.find(
      (c: any) => c.isGroupAdministrator,
    );
    expect(authorizedCustomerUpdated.addresses).toBeDefined();
    expect(
      authorizedCustomerUpdated.addresses.find(
        (a: Address) =>
          a.streetLine1 === 'Selam Street' && a.country.code === 'US',
      ),
    ).toBeDefined();
  });

  it('Administrators can update their addresses', async () => {
    await authorizeAsGroupAdmin();
    const { myCustomerManagedGroup: group } = await shopClient.query(
      myCustomerManagedGroupQuery,
    );
    const groupAdmin = group.customers.find((c: any) => c.isGroupAdministrator);
    const addressTobeUpdated: Address = groupAdmin.addresses[0];
    const { updateCustomerManagedGroupMember: newGroup } =
      await shopClient.query(updateCustomerManagedGroupMemberMutation, {
        input: {
          addresses: [
            {
              id: addressTobeUpdated.id,
              streetLine2: 'Melkam Menged',
              phoneNumber: '+251963215487',
            },
          ],
          customerId: groupAdmin.customerId,
        },
      });
    const authorizedCustomerUpdated = newGroup.customers.find(
      (c: any) => c.isGroupAdministrator,
    );
    expect(authorizedCustomerUpdated.addresses?.length).toBe(2);
    expect(
      authorizedCustomerUpdated.addresses.find(
        (a: Address) =>
          a.id === addressTobeUpdated.id &&
          a.streetLine2 === 'Melkam Menged' &&
          a.phoneNumber === '+251963215487' &&
          a.fullName === addressTobeUpdated.fullName &&
          a.company === addressTobeUpdated.company &&
          a.streetLine1 === addressTobeUpdated.streetLine1 &&
          a.city === addressTobeUpdated.city &&
          a.province === addressTobeUpdated.province &&
          a.postalCode === addressTobeUpdated.postalCode &&
          a.defaultBillingAddress ===
            addressTobeUpdated.defaultBillingAddress &&
          a.defaultShippingAddress ===
            addressTobeUpdated.defaultShippingAddress,
      ),
    ).toBeDefined();
  });
  it('Administrators can update custom fields', async () => {
    await authorizeAsGroupAdmin();
    const { myCustomerManagedGroup: group } = await shopClient.query(
      myCustomerManagedGroupQuery,
    );
    const groupAdmin = group.customers.find((c: any) => c.isGroupAdministrator);
    const adminBirthDay = new Date().toISOString();
    const { updateCustomerManagedGroupMember: newGroup } =
      await shopClient.query(updateCustomerManagedGroupMemberMutation, {
        input: {
          customerId: groupAdmin.customerId,
          customFields: {
            birthday: adminBirthDay,
          },
        },
      });
    const authorizedCustomerUpdated = newGroup.customers.find(
      (c: any) => c.isGroupAdministrator,
    );
    expect(authorizedCustomerUpdated.customFields.birthday).toBe(adminBirthDay);
  });

  afterAll(async () => {
    await server.destroy();
  }, 100000);
});
