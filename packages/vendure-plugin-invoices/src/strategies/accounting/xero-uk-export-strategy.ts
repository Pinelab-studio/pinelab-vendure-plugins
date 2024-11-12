/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  createSelfRefreshingCache,
  Customer,
  EntityHydrator,
  Injector,
  Logger,
  Order,
  RequestContext,
  SelfRefreshingCache,
  translateDeep,
} from '@vendure/core';
import util from 'util';
import { InvoiceEntity } from '../../entities/invoice.entity';
import {
  AccountingExportStrategy,
  ExternalReference,
} from './accounting-export-strategy';

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
   * See https://central.xero.com/s/article/Add-edit-or-delete-custom-invoice-quote-templates
   */
  invoiceBrandingThemeId?: string;
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
  getVendureUrl?(order: Order, invoice: InvoiceEntity): string;
  /**
   * Get the due date for an invoice. Defaults to 30 days from now
   */
  getDueDate?(ctx: RequestContext, order: Order, invoice: InvoiceEntity): Date;
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
    order: Order
  ): Promise<ExternalReference> {
    await injector.get(EntityHydrator).hydrate(ctx, order, {
      relations: [
        'customer',
        'surcharges',
        'lines.productVariant',
        'lines.productVariant.translations',
        'shippingLines.shippingMethod',
      ],
    });
    if (!order.customer) {
      throw Error(
        `Cannot export invoice of order '${order.code}' to Xero without a customer`
      );
    }
    try {
      const contact = await this.getOrCreateContact(
        order.customer,
        order.billingAddress?.company
      );
      const reference =
        this.config.getReference?.(order, invoice) || order.code;
      const oneMonthLater = new Date();
      oneMonthLater.setDate(oneMonthLater.getDate() + 30);
      const dueDate = this.config.getDueDate
        ? this.config.getDueDate(ctx, order, invoice)
        : oneMonthLater;
      const xeroInvoice: import('xero-node').Invoice = {
        invoiceNumber: String(invoice.invoiceNumber),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        type: 'ACCREC' as any,
        contact: {
          contactID: contact.contactID,
        },
        dueDate: this.toDate(dueDate),
        brandingThemeID: this.config.invoiceBrandingThemeId,
        date: this.toDate(order.orderPlacedAt ?? order.updatedAt),
        lineItems: this.getLineItems(ctx, order),
        reference,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        status: 'DRAFT' as any,
        url: this.config.getVendureUrl?.(order, invoice),
      };
      const idempotencyKey = `${ctx.channel.token}-${
        invoice.invoiceNumber
      }-${order.updatedAt.toISOString()}`;
      const response = await this.xero.accountingApi.createInvoices(
        this.tenantId,
        { invoices: [xeroInvoice] },
        true,
        undefined,
        idempotencyKey
      );
      const createdInvoice = response.body.invoices?.[0];
      Logger.info(
        `Created invoice '${invoice.invoiceNumber}' for order '${order.code}' in Xero with ID '${createdInvoice?.invoiceID}' with a total Incl. Tax of ${createdInvoice?.total}`,
        loggerCtx
      );
      return {
        reference: createdInvoice?.invoiceID,
        link: `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${createdInvoice?.invoiceID}`,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const errorMessage = this.getErrorMessage(err);
      Logger.warn(
        `Failed to export invoice to Xero for order '${order.code}': ${errorMessage}`,
        loggerCtx
      );
      throw Error(errorMessage);
    }
  }

  async exportCreditInvoice(
    ctx: RequestContext,
    invoice: InvoiceEntity,
    isCreditInvoiceFor: InvoiceEntity,
    order: Order
  ): Promise<ExternalReference> {
    await this.tokenCache.value(); // Always get a token before making a request
    await injector
      .get(EntityHydrator)
      .hydrate(ctx, order, { relations: ['customer'] });
    if (!order.customer) {
      throw Error(
        `Cannot export credit invoice of order '${order.code}' to Xero without a customer`
      );
    }
    try {
      const contact = await this.getOrCreateContact(
        order.customer,
        order.billingAddress?.company
      );
      const reference =
        this.config.getReference?.(
          order,
          invoice,
          isCreditInvoiceFor.invoiceNumber
        ) || `Credit note for ${isCreditInvoiceFor.invoiceNumber}`;
      const creditNote: import('xero-node').CreditNote = {
        creditNoteNumber: `${invoice.invoiceNumber} (CN)`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: 'ACCRECCREDIT' as any,
        contact: {
          contactID: contact.contactID,
        },
        date: this.toDate(order.updatedAt),
        brandingThemeID: this.config.invoiceBrandingThemeId,
        lineItems: this.getCreditLineItems(invoice),
        reference,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: 'DRAFT' as any,
      };
      const idempotencyKey = `${ctx.channel.token}-${
        invoice.invoiceNumber
      }-${order.updatedAt.toISOString()}`;
      const response = await this.xero.accountingApi.createCreditNotes(
        this.tenantId,
        { creditNotes: [creditNote] },
        true,
        undefined,
        idempotencyKey
      );
      const creditNoteResponse = response.body.creditNotes?.[0];
      Logger.info(
        `Created credit note '${invoice.invoiceNumber}' for order '${order.code}' in Xero with ID '${creditNoteResponse?.creditNoteID}' with a total Incl. Tax of ${creditNoteResponse?.total}`,
        loggerCtx
      );
      return {
        reference: creditNoteResponse?.creditNoteID,
        link: `https://go.xero.com/AccountsReceivable/EditCreditNote.aspx?creditNoteID=${creditNoteResponse?.creditNoteID}`,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const errorMessage = this.getErrorMessage(err);
      Logger.warn(
        `Failed to export Credit Invoice to Xero for order '${order.code}': ${errorMessage}`,
        loggerCtx
      );
      throw Error(errorMessage);
    }
  }

  async getOrCreateContact(
    customer: Customer,
    companyName?: string
  ): Promise<import('xero-node').Contact> {
    await this.tokenCache.value(); // Always get a token before making a request
    // Find by contact name first
    const contactName = this.getNormalizedContactName(customer, companyName);
    let contacts = await this.xero.accountingApi.getContacts(
      this.tenantId,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      contactName
    );
    if (!contacts.body.contacts?.length) {
      // If no contacts, try to find by email
      contacts = await this.xero.accountingApi.getContacts(
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
    }
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
      `No contact found with name '${contactName}' or email '${customer.emailAddress}'. Created new contact with email "${createdContact?.emailAddress}" (${createdContact?.contactID})`,
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
   * Get the readable error message from the Xero response
   */
  private getErrorMessage(err: string): string {
    const errorObj = JSON.parse(err);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return (
      errorObj?.response?.body?.Elements?.[0]?.ValidationErrors?.[0]?.Message ||
      errorObj?.response?.body?.Message ||
      errorObj?.response?.body ||
      errorObj?.body
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
    lineItems.push(
      ...order.shippingLines.map((shippingLine) => {
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

  /**
   * Get the normalized contact name. Uses company or other wise customers full name.
   * Trims and replaces duplicate spaces/tabs/newlines.
   * Shortens to max 50 characters, because that is the max allowed for the Xero API
   */
  private getNormalizedContactName(
    customer: Customer,
    companyName?: string
  ): string {
    const contactName =
      companyName ||
      [customer.firstName, customer.lastName].filter(Boolean).join(' ');
    return contactName.trim().replace(/\s\s+/g, ' ').substring(0, 50);
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
