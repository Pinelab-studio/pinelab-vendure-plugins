import {
  RequestContext,
  createSelfRefreshingCache,
  SelfRefreshingCache,
  Logger,
  Order,
  Customer,
  Injector,
  EntityHydrator,
  OrderLine,
  translateDeep,
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
  accountCode: string;
  channelToken?: string;
  /**
   * Construct a reference based on the given order object
   */
  getReference?: (order: Order) => string;
}

interface TaxRate {
  rate?: number;
  type?: string;
}

let injector: Injector;

/**
 * This class is responsible for exporting invoices to Xero UK.
 * It's is UK specific, because it uses predefined tax rates
 */
export class XeroUKExportStrategy implements AccountingExportStrategy {
  readonly channelToken?: string;
  /**
   * Available tax rates in Xero
   */
  taxRates: TaxRate[] = [];
  private xero!: import('xero-node').XeroClient;
  private tokenCache!: SelfRefreshingCache<import('xero-node').TokenSet, []>;
  // For custom connections tenantId needs to be an empty string
  readonly tenantId = '';


  constructor(private config: Config) {
    this.channelToken = config.channelToken;
  }

  async init(_injector: Injector): Promise<void> {
    injector = _injector;
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
    try {
      this.taxRates = await this.getTaxRates();
    } catch (e: any) {
      Logger.error(`Failed initialize: Could not get tax rates from Xero: ${e?.message}`, loggerCtx, util.inspect(e, false, 5));
    }
  }

  /**
   * Export the invoice to Xero
   */
  async exportInvoice(
    ctx: RequestContext,
    invoice: InvoiceEntity,
    order: Order
  ): Promise<ExternalReference> {
    await injector.get(EntityHydrator).hydrate(ctx, order, {
      relations: [
        'customer',
        'surcharges',
        'lines.productVariant',
        'lines.productVariant.translations',
        'shippingLines.shippingMethod',
        'payments',
      ]
    });
    if (!order.customer) {
      throw Error(
        `Cannot export invoice of order '${order.code}' to Xero without a customer`
      );
    }
    await this.tokenCache.value(); // Always get a token before making a request
    const contact = await this.getOrCreateContact(order.customer);
    const reference = this.config.getReference?.(order) || order.code;
    const xeroInvoice: import('xero-node').Invoice = {
      invoiceNumber: String(invoice.invoiceNumber),
      type: 'ACCREC' as any,
      contact: {
        contactID: contact.contactID
      },
      date: this.toDate(order.orderPlacedAt ?? order.updatedAt),
      lineItems: this.getLineItems(ctx, order),
      reference,
      payments: order.payments.filter(p => p.state === 'Settled').map((payment) => {
        return {
          amount: this.toMoney(payment.amount),
          date: this.toDate(payment.createdAt),
          reference: payment.transactionId,
        }
      }),
      status: 'DRAFT' as any,
    };
    const idempotencyKey = `${ctx.channel.token}-${order.code}-${invoice.invoiceNumber}`;
    try {
      const response = await this.xero.accountingApi.createInvoices(this.tenantId, { invoices: [xeroInvoice] }, true, undefined, idempotencyKey);
      const invoiceId = response.body.invoices?.[0].invoiceID;
      Logger.info(`Created invoice '${invoice.invoiceNumber}' for order '${order.code}' in Xero with ID (${invoiceId})`, loggerCtx);
      return {
        reference: invoiceId!,
        link: `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${invoiceId}`
      };
    } catch (err: any) {
      const errorMessage = JSON.parse(err)?.response?.body?.Elements?.[0]?.ValidationErrors?.[0]?.Message || JSON.parse(err)?.response?.body?.Message;
      Logger.error(`Failed to create Xero invoice for order '${order.code}': ${errorMessage}`, loggerCtx, util.inspect(err, false, 5));
      throw Error(errorMessage);
    }
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

  /**
   * Construct line items from the order.
   * Also includes shipping lines and surcharges
   */
  getLineItems(ctx: RequestContext, order: Order): import('xero-node').LineItem[] {
    // Map line items
    const lineItems: import('xero-node').LineItem[] = order.lines.map((line) => {
      return {
        description: translateDeep(line.productVariant, ctx.channel.defaultLanguageCode).name,
        quantity: line.quantity,
        unitAmount: this.toMoney(line.proratedUnitPrice),
        accountCode: this.config.accountCode,
        taxType: this.getTaxType(line.taxRate, order.code),
      }
    });
    // Map shipping lines
    lineItems.push(...order.shippingLines.map((shippingLine) => {
      return {
        description: shippingLine.shippingMethod.name,
        quantity: 1,
        unitAmount: this.toMoney(shippingLine.discountedPrice),
        accountCode: this.config.accountCode,
        taxType: this.getTaxType(shippingLine.taxRate, order.code),
      }
    }));
    // Map surcharges
    lineItems.push(...order.surcharges.map((surcharge) => {
      return {
        description: surcharge.description,
        quantity: 1,
        unitAmount: this.toMoney(surcharge.price),
        accountCode: this.config.accountCode,
        taxType: this.getTaxType(surcharge.taxRate, order.code),
      }
    }));
    return lineItems;
  }

  getTaxType(rate: number, orderCode: string): string | undefined{
    const taxType = this.taxRates.find((xeroRate) => xeroRate.rate == rate)?.type;
    console.log('taxType', taxType);
    if (taxType) {
      return taxType;
    }
    Logger.error(`No tax rate found in Xero with tax rate '${rate}'. No rate set for order '${orderCode}'`, loggerCtx,
      `Available tax rates: ${this.taxRates.map(r => `${r.type}=${r.rate}`).join(', ')}`);
  }

  async getTaxRates(): Promise<TaxRate[]> {
    const rates = await this.xero.accountingApi.getTaxRates(this.tenantId);
    return rates.body.taxRates?.map((rate) => ({ rate: rate.effectiveRate, type: rate.taxType })) || [];
  }


  private toDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private toMoney(value: number): number {
    return value / 100;
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
              `Failed to get access_token for Xero: ${e?.message
              }: ${JSON.stringify(e?.response?.data)}`
            );
          }
        },
        defaultArgs: [],
      },
    });
  }
}
