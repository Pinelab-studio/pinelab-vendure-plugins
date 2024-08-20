/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  RequestContext,
  createSelfRefreshingCache,
  SelfRefreshingCache,
  Logger,
  Order,
  Customer,
  Injector,
  EntityHydrator,
  translateDeep,
} from '@vendure/core';
import {
  AccountingExportStrategy,
  ExternalReference,
} from './accounting-export-strategy';
import { InvoiceEntity } from '../../entities/invoice.entity';
import util from 'util';

const loggerCtx = 'XeroUKAccountingExport';

interface Config {
  clientId: string;
  clientSecret: string;
  /**
   * The account code in Xero for shipping costs
   */
  shippingAccountCode: string;
  /**
   * The account code in Xero for sold products
   */
  salesAccountCode: string;
  channelToken?: string;
  /**
   * Construct a reference based on the given order object
   */
  getReference?: (
    order: Order,
    invoice: InvoiceEntity,
    isCreditInvoiceFor?: number
  ) => string;
  /**
   * Construct a URL that links to the order in Vendure Admin
   */
  getVendureUrl?: (order: Order, invoice: InvoiceEntity) => string;
}

interface TaxRate {
  rate?: number;
  type?: string;
}

let injector: Injector;

/**
 * This class is responsible for exporting invoices as Draft to Xero UK.
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      throw Error(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      Logger.error(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Failed initialize: Could not get tax rates from Xero: ${e?.message}`,
        loggerCtx,
        util.inspect(e, false, 5)
      );
    }
  }

  /**
   * Export the invoice to Xero
   */
  async exportInvoice(
    ctx: RequestContext,
    invoice: InvoiceEntity,
    order: Order,
    isCreditInvoiceFor?: InvoiceEntity
  ): Promise<ExternalReference> {
    await injector.get(EntityHydrator).hydrate(ctx, order, {
      relations: [
        'customer',
        'surcharges',
        'lines.productVariant',
        'lines.productVariant.translations',
        'shippingLines.shippingMethod',
        'payments',
      ],
    });
    if (!order.customer) {
      throw Error(
        `Cannot export invoice of order '${order.code}' to Xero without a customer`
      );
    }
    try {
      const contact = await this.getOrCreateContact(order.customer);
      if (!invoice.isCreditInvoice) {
        return await this.createInvoice(ctx, order, invoice, contact.contactID);
      } else {
        return await this.createCreditNote(
          ctx,
          order,
          invoice,
          isCreditInvoiceFor?.invoiceNumber,
          contact.contactID
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const errorMessage =
        JSON.parse(err)?.response?.body?.Elements?.[0]?.ValidationErrors?.[0]
          ?.Message || JSON.parse(err)?.response?.body?.Message;
      Logger.warn(
        `Failed to export to Xero for order '${order.code}': ${errorMessage}`,
        loggerCtx
      );
      throw Error(errorMessage);
    }
  }

  /**
   * Create normal invoice in Xero
   */
  async createInvoice(
    ctx: RequestContext,
    order: Order,
    invoice: InvoiceEntity,
    contactId?: string
  ): Promise<ExternalReference> {
    await this.tokenCache.value(); // Always get a token before making a request
    const reference = this.config.getReference?.(order, invoice) || order.code;
    const xeroInvoice: import('xero-node').Invoice = {
      invoiceNumber: String(invoice.invoiceNumber),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      type: 'ACCREC' as any,
      contact: {
        contactID: contactId,
      },
      date: this.toDate(order.orderPlacedAt ?? order.updatedAt),
      lineItems: this.getLineItems(ctx, order),
      reference,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      status: 'DRAFT' as any,
      url: this.config.getVendureUrl?.(order, invoice),
    };
    const idempotencyKey = `${ctx.channel.token}-${order.code}-${invoice.invoiceNumber}`;
    const response = await this.xero.accountingApi.createInvoices(
      this.tenantId,
      { invoices: [xeroInvoice] },
      true,
      undefined,
      idempotencyKey
    );
    const invoiceId = response.body.invoices?.[0].invoiceID;
    Logger.info(
      `Created invoice '${invoice.invoiceNumber}' for order '${order.code}' in Xero with ID (${invoiceId})`,
      loggerCtx
    );
    return {
      reference: invoiceId!,
      link: `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${invoiceId}`,
    };
  }

  /**
   * Credit notes are a separate entity in Xero, so we have a separate method for them
   */
  async createCreditNote(
    ctx: RequestContext,
    order: Order,
    invoice: InvoiceEntity,
    isCreditInvoiceFor?: number,
    contactId?: string
  ): Promise<ExternalReference> {
    await this.tokenCache.value(); // Always get a token before making a request
    const reference =
      this.config.getReference?.(order, invoice, isCreditInvoiceFor) ||
      `Credit note for ${isCreditInvoiceFor}`;
    const creditNote: import('xero-node').CreditNote = {
      creditNoteNumber: `${invoice.invoiceNumber} (CN)`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: 'ACCRECCREDIT' as any,
      contact: {
        contactID: contactId,
      },
      date: this.toDate(order.orderPlacedAt ?? order.updatedAt),
      lineItems: this.getCreditLineItems(invoice),
      reference,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: 'DRAFT' as any,
    };
    const idempotencyKey = `${ctx.channel.token}-${order.code}-${invoice.invoiceNumber}`;
    const response = await this.xero.accountingApi.createCreditNotes(
      this.tenantId,
      { creditNotes: [creditNote] },
      true,
      undefined,
      idempotencyKey
    );
    const creditNoteID = response.body.creditNotes?.[0].creditNoteID;
    Logger.info(
      `Created credit note '${invoice.invoiceNumber}' for order '${order.code}' in Xero with ID (${creditNoteID})`,
      loggerCtx
    );
    return {
      reference: creditNoteID!,
      link: `https://go.xero.com/AccountsReceivable/EditCreditNote.aspx?creditNoteID=${creditNoteID}`,
    };
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
      const contact = contacts.body.contacts![0];
      Logger.info(
        `Found multiple contacts in Xero with email address "${customer.emailAddress}". Using ${contact.contactID}`,
        loggerCtx
      );
      return contact;
    } else if ((contacts.body?.contacts?.length ?? 0) === 1) {
      // Return only contact
      return contacts.body.contacts![0];
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
   * Get tax rates applicable to Revenue
   */
  async getTaxRates(): Promise<TaxRate[]> {
    const rates = await this.xero.accountingApi.getTaxRates(this.tenantId);
    return (
      rates.body.taxRates
        ?.filter((rate) => rate.canApplyToRevenue)
        .map((rate) => ({
          rate: rate.effectiveRate,
          type: rate.taxType,
        })) || []
    );
  }

  /**
   * Construct line items from the order.
   * Also includes shipping lines and surcharges
   */
  private getLineItems(
    ctx: RequestContext,
    order: Order
  ): import('xero-node').LineItem[] {
    // Map line items
    const lineItems: import('xero-node').LineItem[] = order.lines.map(
      (line) => {
        return {
          description: translateDeep(
            line.productVariant,
            ctx.channel.defaultLanguageCode
          ).name,
          quantity: line.quantity,
          unitAmount: this.toMoney(line.proratedUnitPrice),
          accountCode: this.config.salesAccountCode,
          taxType: this.getTaxType(line.taxRate, order.code),
        };
      }
    );
    // Map shipping lines
    console.log(
      JSON.stringify(order.shippingLines.map((s) => s.shippingMethod))
    );
    lineItems.push(
      ...order.shippingLines.map((shippingLine) => {
        console.log(
          '==================',
          translateDeep(
            shippingLine.shippingMethod,
            ctx.channel.defaultLanguageCode
          ).name
        );
        return {
          description: translateDeep(
            shippingLine.shippingMethod,
            ctx.channel.defaultLanguageCode
          ).name,
          quantity: 1,
          unitAmount: this.toMoney(shippingLine.discountedPrice),
          accountCode: this.config.shippingAccountCode,
          taxType: this.getTaxType(shippingLine.taxRate, order.code),
        };
      })
    );
    // Map surcharges
    lineItems.push(
      ...order.surcharges.map((surcharge) => {
        return {
          description: surcharge.description,
          quantity: 1,
          unitAmount: this.toMoney(surcharge.price),
          accountCode: this.config.salesAccountCode,
          taxType: this.getTaxType(surcharge.taxRate, order.code),
        };
      })
    );
    return lineItems;
  }

  private getCreditLineItems(
    invoice: InvoiceEntity
  ): import('xero-node').LineItem[] {
    if (!invoice.isCreditInvoice) {
      throw Error(
        `Cannot create credit line items for non-credit invoice '${invoice.invoiceNumber}'`
      );
    }
    return invoice.orderTotals.taxSummaries.map((taxSummary) => {
      return {
        description: `Credit of all line items with '${taxSummary.description}'`,
        quantity: 1,
        unitAmount: this.toMoney(Math.abs(taxSummary.taxBase)), // Make positive number for Xero
        accountCode: this.config.salesAccountCode,
        taxType: this.getTaxType(taxSummary.taxRate, invoice.invoiceNumber),
      };
    });
  }

  private getTaxType(
    rate: number,
    orderOrInvoice: string | number
  ): string | undefined {
    const taxType = this.taxRates.find(
      (xeroRate) => xeroRate.rate == rate
    )?.type;
    if (taxType) {
      return taxType;
    }
    Logger.error(
      `No tax rate found in Xero with tax rate '${rate}'. No rate set for '${orderOrInvoice}'`,
      loggerCtx,
      `Available tax rates: ${this.taxRates
        .map((r) => `${r.type}=${r.rate}`)
        .join(', ')}`
    );
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
