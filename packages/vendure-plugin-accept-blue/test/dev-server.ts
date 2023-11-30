import { AcceptBlueClient } from '../src/accept-blue-client';
import dotenv from 'dotenv';

//  https://sandbox.emeraldworldpayments.com/login

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  dotenv.config();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const client = new AcceptBlueClient(process.env.API_KEY!);
  const customer = await client.getOrCreateCustomer('martijn@pinelab.studio');
  console.log('cust', customer);
})();
