/**
 * Script to fetch a single QLS fulfillment product by ID.
 * Run with: npx ts-node scripts/get-product-by-id.ts
 */
import * as dotenv from 'dotenv';
import { QlsClient } from '../src/lib/qls-client';

dotenv.config();
const PRODUCT_ID = 'd9e6b98d-f183-4715-86ee-64bee5f89d33';

const client = new QlsClient({
  username: process.env.QLS_USERNAME!,
  password: process.env.QLS_PASSWORD!,
  companyId: process.env.QLS_COMPANY_ID!,
  brandId: process.env.QLS_BRAND_ID!,
  url: process.env.QLS_URL, // optional, defaults to 'https://api.pakketdienstqls.nl'
});

async function main() {
  const product = await client.getFulfillmentProductById(PRODUCT_ID);
  console.log(JSON.stringify(product, null, 2));
}

main().catch(console.error);
