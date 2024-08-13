import { XeroAccountingExportStrategy } from '../src';

(async () => {
  require('dotenv').config();

  const xero = new XeroAccountingExportStrategy({
    clientId: process.env.XERO_CLIENT_ID!,
    clientSecret: process.env.XERO_CLIENT_SECRET!,
  });
  await xero.init();

  await xero.exportInvoice(null as any, null as any);
})();
