import { SimpleGraphQLClient } from '@vendure/testing';
import { CREATE_PROMOTION } from './queries';
import { LanguageCode } from '@vendure/core';

export async function createPromotionMutation(
  name: string,
  adminClient: SimpleGraphQLClient
): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/return-await
  return await adminClient.query(CREATE_PROMOTION, {
    input: {
      enabled: true,
      conditions: [
        {
          code: 'minimum_order_amount',
          arguments: [
            {
              amount: 0,
            },
          ],
        },
      ],
      actions: [
        {
          code: 'order_fixed_discount',
          arguments: [
            {
              discount: 100,
            },
          ],
        },
      ],
      couponCode: name,
      translations: [
        {
          languageCode: LanguageCode.en_US,
          name: 'Discount by 1',
          description: 'Discounts the order by $1',
        },
      ],
    },
  });
}
