import {
  CustomerService,
  ID,
  Injector,
  LanguageCode,
  PaymentMethodEligibilityChecker,
  TtlCache,
  idsAreEqual,
} from '@vendure/core';

const fiveMinutes = 5 * 60 * 1000;
const groupsPerCustomerCache = new TtlCache<ID, ID[]>({ ttl: fiveMinutes });
let injector: Injector | undefined;

/**
 * This checker checks if the logged in customer is in a given group.
 */
export const isCustomerInGroupPaymentChecker =
  new PaymentMethodEligibilityChecker({
    code: 'is-customer-in-group-payment-checker',
    description: [
      {
        languageCode: LanguageCode.en,
        value:
          'Checks if the Customer connected to the Order is in the given group',
      },
    ],
    args: {
      customerGroupId: {
        type: 'ID',
        ui: { component: 'customer-group-form-input' },
        label: [{ languageCode: LanguageCode.en, value: 'Customer group' }],
      },
    },
    init(_injector) {
      injector = _injector;
    },
    check: async (ctx, order, args) => {
      if (!order.customer) {
        return 'Only orders with a customer can use this payment method';
      }
      const customerId = order.customer.id;
      let groupIds = groupsPerCustomerCache.get(customerId);
      if (!groupIds) {
        const groups =
          (await injector
            ?.get(CustomerService)
            .getCustomerGroups(ctx, customerId)) ?? [];
        groupIds = groups.map((g) => g.id);
        groupsPerCustomerCache.set(customerId, groupIds);
      }
      const isEligible = groupIds.some((id) =>
        idsAreEqual(id, args.customerGroupId)
      );
      if (!isEligible) {
        return 'You are not in the required customer group';
      }
      return isEligible;
    },
  });
