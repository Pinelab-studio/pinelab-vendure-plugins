import crypto from 'node:crypto';

export function createMockWebhook() {
  return {
    event: 'transaction',
    type: 'succeeded',
    subType: 'charge',
    id: 'wztdU5XTEQe4Y1bU56aW81FyZ8CI8N2K',
    timestamp: '2024-09-23T01:20:10.281Z',
    data: {
      version: '2.0.0',
      status: 'Approved',
      status_code: 'A',
      card_type: 'Visa',
      last_4: '1118',
      auth_code: 'TAS068',
      auth_amount: 1234,
      transaction: {
        id: 458095,
        created_at: '2024-09-23T01:20:00.000Z',
        settled_date: null,
        card_details: {
          name: 'Hayden Zieme',
          last4: '1118',
          expiry_month: 1,
          expiry_year: 2025,
          card_type: 'Visa',
          avs_street: 'Testing address',
          avs_zip: '12345',
          auth_code: 'TAS068',
          avs_result: 'Address: No Match & 5 Digit Zip: No Match',
          cvv_result: 'No CVV2/CVC data available for transaction.',
          bin: '476153',
          bin_details: { type: 'C' },
          avs_result_code: 'NNN',
          cvv_result_code: null,
          cavv_result: 'N/A',
          cavv_result_code: null,
        },
        amount_details: {
          amount: 1234,
          original_requested_amount: 1234,
          original_authorized_amount: 1234,
          tax: 0,
          surcharge: 0,
          shipping: 0,
          tip: 0,
          discount: 0,
          subtotal: 1234,
        },
        transaction_details: {
          batch_id: 26750,
          description: 'Test Subscription Laptop 13 inch 16GB',
          clerk: null,
          terminal: null,
          invoice_number: null,
          po_number: null,
          order_number: null,
          source: 'Recurring',
          type: 'charge',
          reference_number: null,
          schedule_id: 8429,
        },
        customer: {
          identifier: 'hayden.zieme12@hotmail.com',
          email: 'hayden.zieme12@hotmail.com',
          fax: null,
          customer_id: 181937,
        },
        status_details: { status: 'captured' },
        custom_fields: {},
        billing_info: {
          first_name: null,
          last_name: null,
          street: null,
          street2: null,
          city: null,
          state: null,
          zip: null,
          country: 'US',
          phone: null,
        },
        shipping_info: {
          first_name: null,
          last_name: null,
          street: null,
          street2: null,
          city: null,
          state: null,
          zip: null,
          country: 'US',
          phone: null,
        },
      },
      reference_number: 458095,
    },
  };
}

/**
 * Create a valid signature for your mock webhook
 */
export function createSignature(webhookSecret: string, body: Object): string {
  return crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(body))
    .digest('hex');
}
