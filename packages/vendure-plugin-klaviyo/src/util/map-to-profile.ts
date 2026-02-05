import { Customer, RequestContext } from '@vendure/core';

/**
 * Map a Vendure customer to a Klaviyo profile
 */
export function mapToProfile(ctx: RequestContext, customer: Customer) {
  return {
    emailAddress: customer.emailAddress,
    externalId: customer.id.toString(),
    firstName: customer.firstName,
    lastName: customer.lastName,
    phoneNumber: customer.phoneNumber,
    customProperties: {
      language: ctx.languageCode,
    },
  };
}
