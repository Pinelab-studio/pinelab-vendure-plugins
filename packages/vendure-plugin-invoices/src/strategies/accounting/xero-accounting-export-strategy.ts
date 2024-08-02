import {
  RequestContext,
  createSelfRefreshingCache,
  SelfRefreshingCache,
  Logger,
  Order,
  Customer,
} from '@vendure/core';
import {
  AccountingExportStrategy,
  ExternalReference,
} from './accounting-export-strategy';
import { InvoiceEntity } from '../../entities/invoice.entity';
import { loggerCtx } from '../../constants';
import util from 'util';

interface Config {
  clientId: string;
  clientSecret: string;
  channelToken?: string;
}

export class XeroAccountingExportStrategy implements AccountingExportStrategy {
  readonly channelToken?: string;
  private xero!: import('xero-node').XeroClient;
  private tokenCache!: SelfRefreshingCache<import('xero-node').TokenSet, []>;
  // For custom connections tenantId needs to be an empty string
  readonly tenantId = '';

  constructor(private config: Config) {
    this.channelToken = config.channelToken;
  }

  async init(): Promise<void> {
    try {
      // Test if package is installed
      await import('xero-node');
    } catch (e: any) {
      throw Error(
        `Could not find the "xero-node" package. Make sure it is installed: ${e?.message}`
      );
    }
    const XeroNode = await import('xero-node');
    this.xero = new XeroNode.XeroClient({
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      grantType: 'client_credentials',
    });
    this.tokenCache = await this.createCache();
  }

  async exportInvoice(
    ctx: RequestContext,
    invoice: InvoiceEntity,
    order: Order
  ): Promise<ExternalReference> {
    if (!order.customer) {
      throw Error(
        `Cannot export invoice of order '${order.code}' to Xero without a customer`
      );
    }
    await this.tokenCache.value(); // Always get a token before making a request
    const contact = await this.getOrCreateContact(order.customer);

    // TODO Create Contact

    // const lineItem: import('xero-node').LineItem = {
    //     description: "Foobar",
    //     quantity: 1.0,
    //     unitAmount: 20.0,
    //     accountCode: "000",
    // };
    // const lineItems = [lineItem];

    // const invoice: import('xero-node').Invoice = {
    //     type: Invoice.TypeEnum.ACCREC,
    //     contact: {
    //             contactID: "00000000-0000-0000-0000-000000000000"
    //     },
    //     date: this.toDate(new Date()), // FIXME,
    //     lineItems: lineItems,
    //     reference: "Website Design",
    //     status: Invoice.StatusEnum.DRAFT
    // };

    // const invoices = {
    //     invoices: [invoice]
    // };

    // try {
    //     // const response = await this.xero.accountingApi.createInvoices(this.tenantId, invoices, summarizeErrors, unitdp, idempotencyKey);
    // } catch (err: any) {
    //     const error = JSON.stringify(err.response.body, null, 2)
    //     console.log(`Status Code: ${err.response.statusCode} => ${error}`);
    // }
    return 'test' as any;
  }

  async getOrCreateContact(
    customer: Customer
  ): Promise<import('xero-node').Contact> {
    await this.tokenCache.value(); // Always get a token before making a request
    const contacts = await this.xero.accountingApi.getContacts(
      this.tenantId,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      customer.emailAddress
    );
    if ((contacts.body?.contacts?.length ?? 0) > 1) {
      const contact = contacts.body!.contacts![0];
      Logger.info(
        `Found multiple contacts in Xero with email address "${customer.emailAddress}". Using ${contact.contactID}`,
        loggerCtx
      );
      return contact;
    } else if ((contacts.body?.contacts?.length ?? 0) === 1) {
      // Return only contact
      return contacts.body!.contacts![0];
    }
    // Else, create a new contact
    const createdContacts = await this.xero.accountingApi.createContacts(
      this.tenantId,
      {
        contacts: [
          {
            name: `${customer.firstName} ${customer.lastName}`,
            emailAddress: customer.emailAddress,
            firstName: customer.firstName,
            lastName: customer.lastName,
          },
        ],
      }
    );
    const createdContact = createdContacts.body.contacts?.[0];
    Logger.info(
      `Created new contact in Xero with email address "${createdContact?.emailAddress}" (${createdContact?.contactID})`,
      loggerCtx
    );
    return createdContacts.body.contacts![0];
  }

  private toDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Create a cache to store accesss_tokens
   */
  private async createCache(): Promise<
    SelfRefreshingCache<import('xero-node').TokenSet, []>
  > {
    return createSelfRefreshingCache({
      name: 'Xero Token Cache',
      ttl: 1200000, // 20 minutes
      refresh: {
        fn: async () => {
          try {
            return await this.xero.getClientCredentialsToken();
          } catch (e: any) {
            Logger.error(
              `Failed to get access_token for Xero: ${e?.message}`,
              loggerCtx,
              util.inspect(e, false, 5)
            );
            throw Error(
              `Failed to get access_token for Xero: ${
                e?.message
              }: ${JSON.stringify(e?.response?.data)}`
            );
          }
        },
        defaultArgs: [],
      },
    });
  }
}
