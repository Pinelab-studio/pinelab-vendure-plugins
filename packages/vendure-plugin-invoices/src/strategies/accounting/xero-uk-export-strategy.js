'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.XeroUKExportStrategy = void 0;
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
const core_1 = require('@vendure/core');
const util_1 = __importDefault(require('util'));
const loggerCtx = 'XeroUKAccountingExport';
let injector;
/**
 * This class is responsible for exporting invoices as Draft to Xero UK.
 */
class XeroUKExportStrategy {
  constructor(config) {
    this.config = config;
    /**
     * Available tax rates in Xero
     */
    this.taxRates = [];
    // For custom connections tenantId needs to be an empty string
    this.tenantId = '';
    this.channelToken = config.channelToken;
  }
  async init(_injector) {
    injector = _injector;
    try {
      // Test if package is installed
      await Promise.resolve().then(() => __importStar(require('xero-node')));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e) {
      throw Error(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Could not find the "xero-node" package. Make sure it is installed: ${e?.message}`
      );
    }
    const XeroNode = await Promise.resolve().then(() =>
      __importStar(require('xero-node'))
    );
    this.xero = new XeroNode.XeroClient({
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      grantType: 'client_credentials',
    });
    this.tokenCache = await this.createCache();
    try {
      this.taxRates = await this.getTaxRates();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e) {
      core_1.Logger.error(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Failed initialize: Could not get tax rates from Xero: ${e?.message}`,
        loggerCtx,
        util_1.default.inspect(e, false, 5)
      );
    }
  }
  /**
   * Export the invoice to Xero
   */
  async exportInvoice(ctx, invoice, order) {
    await injector.get(core_1.EntityHydrator).hydrate(ctx, order, {
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
      const xeroInvoice = {
        invoiceNumber: String(invoice.invoiceNumber),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        type: 'ACCREC',
        contact: {
          contactID: contact.contactID,
        },
        dueDate: this.toDate(dueDate),
        brandingThemeID: this.config.invoiceBrandingThemeId,
        date: this.toDate(order.orderPlacedAt ?? order.updatedAt),
        lineItems: this.getLineItems(ctx, order),
        reference,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        status: 'DRAFT',
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
      core_1.Logger.info(
        `Created invoice '${invoice.invoiceNumber}' for order '${order.code}' in Xero with ID '${createdInvoice?.invoiceID}' with a total Incl. Tax of ${createdInvoice?.total}`,
        loggerCtx
      );
      return {
        reference: createdInvoice?.invoiceID,
        link: `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${createdInvoice?.invoiceID}`,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err) {
      const errorMessage = this.getErrorMessage(err);
      core_1.Logger.warn(
        `Failed to export invoice to Xero for order '${order.code}': ${errorMessage}`,
        loggerCtx
      );
      throw Error(errorMessage);
    }
  }
  async exportCreditInvoice(ctx, invoice, isCreditInvoiceFor, order) {
    await this.tokenCache.value(); // Always get a token before making a request
    await injector
      .get(core_1.EntityHydrator)
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
      const creditNote = {
        creditNoteNumber: `${invoice.invoiceNumber} (CN)`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: 'ACCRECCREDIT',
        contact: {
          contactID: contact.contactID,
        },
        date: this.toDate(order.updatedAt),
        brandingThemeID: this.config.invoiceBrandingThemeId,
        lineItems: this.getCreditLineItems(invoice),
        reference,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: 'DRAFT',
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
      core_1.Logger.info(
        `Created credit note '${invoice.invoiceNumber}' for order '${order.code}' in Xero with ID '${creditNoteResponse?.creditNoteID}' with a total Incl. Tax of ${creditNoteResponse?.total}`,
        loggerCtx
      );
      return {
        reference: creditNoteResponse?.creditNoteID,
        link: `https://go.xero.com/AccountsReceivable/EditCreditNote.aspx?creditNoteID=${creditNoteResponse?.creditNoteID}`,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err) {
      const errorMessage = this.getErrorMessage(err);
      core_1.Logger.warn(
        `Failed to export Credit Invoice to Xero for order '${order.code}': ${errorMessage}`,
        loggerCtx
      );
      throw Error(errorMessage);
    }
  }
  async getOrCreateContact(customer, companyName) {
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
      const contact = contacts.body.contacts[0];
      core_1.Logger.info(
        `Found multiple contacts in Xero with email address "${customer.emailAddress}". Using ${contact.contactID}`,
        loggerCtx
      );
      return contact;
    } else if ((contacts.body?.contacts?.length ?? 0) === 1) {
      // Return only contact
      return contacts.body.contacts[0];
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
    core_1.Logger.info(
      `No contact found with name '${contactName}' or email '${customer.emailAddress}'. Created new contact with email "${createdContact?.emailAddress}" (${createdContact?.contactID})`,
      loggerCtx
    );
    return createdContacts.body.contacts[0];
  }
  /**
   * Get tax rates applicable to Revenue
   */
  async getTaxRates() {
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
  getErrorMessage(err) {
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
  getLineItems(ctx, order) {
    // Map line items
    const lineItems = order.lines.map((line) => {
      return {
        description: (0, core_1.translateDeep)(
          line.productVariant,
          ctx.channel.defaultLanguageCode
        ).name,
        quantity: line.quantity,
        unitAmount: this.toMoney(line.proratedUnitPrice),
        accountCode: this.config.salesAccountCode,
        taxType: this.getTaxType(line.taxRate, order.code),
      };
    });
    // Map shipping lines
    lineItems.push(
      ...order.shippingLines.map((shippingLine) => {
        return {
          description: (0, core_1.translateDeep)(
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
  getCreditLineItems(invoice) {
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
  getNormalizedContactName(customer, companyName) {
    const contactName =
      companyName ||
      [customer.firstName, customer.lastName].filter(Boolean).join(' ');
    return contactName.trim().replace(/\s\s+/g, ' ').substring(0, 50);
  }
  getTaxType(rate, orderOrInvoice) {
    const taxType = this.taxRates.find(
      (xeroRate) => xeroRate.rate == rate
    )?.type;
    if (taxType) {
      return taxType;
    }
    core_1.Logger.error(
      `No tax rate found in Xero with tax rate '${rate}'. No rate set for '${orderOrInvoice}'`,
      loggerCtx,
      `Available tax rates: ${this.taxRates
        .map((r) => `${r.type}=${r.rate}`)
        .join(', ')}`
    );
  }
  toDate(date) {
    return date.toISOString().split('T')[0];
  }
  toMoney(value) {
    return value / 100;
  }
  /**
   * Create a cache to store accesss_tokens
   */
  async createCache() {
    return (0, core_1.createSelfRefreshingCache)({
      name: 'Xero Token Cache',
      ttl: 1200000, // 20 minutes
      refresh: {
        fn: async () => {
          try {
            return await this.xero.getClientCredentialsToken();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (e) {
            core_1.Logger.error(
              `Failed to get access_token for Xero: ${e?.message}`,
              loggerCtx,
              util_1.default.inspect(e, false, 5)
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
exports.XeroUKExportStrategy = XeroUKExportStrategy;
