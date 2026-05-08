'use strict';
var __decorate =
  (this && this.__decorate) ||
  function (decorators, target, key, desc) {
    var c = arguments.length,
      r =
        c < 3
          ? target
          : desc === null
          ? (desc = Object.getOwnPropertyDescriptor(target, key))
          : desc,
      d;
    if (typeof Reflect === 'object' && typeof Reflect.decorate === 'function')
      r = Reflect.decorate(decorators, target, key, desc);
    else
      for (var i = decorators.length - 1; i >= 0; i--)
        if ((d = decorators[i]))
          r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
  };
var __metadata =
  (this && this.__metadata) ||
  function (k, v) {
    if (typeof Reflect === 'object' && typeof Reflect.metadata === 'function')
      return Reflect.metadata(k, v);
  };
var __param =
  (this && this.__param) ||
  function (paramIndex, decorator) {
    return function (target, key) {
      decorator(target, key, paramIndex);
    };
  };
var _a, _b, _c, _d;
Object.defineProperty(exports, '__esModule', { value: true });
exports.AccountingService = void 0;
const common_1 = require('@nestjs/common');
const core_1 = require('@vendure/core');
const constants_1 = require('../constants');
const invoice_entity_1 = require('../entities/invoice.entity');
const invoice_plugin_1 = require('../invoice.plugin');
let AccountingService = class AccountingService {
  constructor(connection, jobQueueService, orderService, config) {
    this.connection = connection;
    this.jobQueueService = jobQueueService;
    this.orderService = orderService;
    this.config = config;
    this.orderRelations = [
      'lines.productVariant.product',
      'shippingLines.shippingMethod',
      'payments',
      'customer',
      'surcharges',
    ];
  }
  async onModuleInit() {
    // Init Accounting Export job queue
    this.accountingExportQueue = await this.jobQueueService.createQueue({
      name: 'export-invoice-to-accounting',
      process: async (job) => {
        await this.handleAccountingExportJob(
          core_1.RequestContext.deserialize(job.data.ctx),
          job.data.invoiceNumber,
          job.data.orderCode
        ).catch((error) => {
          core_1.Logger.warn(
            `Failed to export invoice '${job.data.invoiceNumber}' to accounting platform for '${job.data.orderCode}': ${error?.message}`,
            constants_1.loggerCtx
          );
          throw error;
        });
      },
    });
  }
  /**
   * Find strategy for channel. If strategy.channelToken is undefined, it can be used for all channels
   */
  findAccountingExportStrategyForChannel(ctx) {
    return (this.config.accountingExports || []).find(
      (s) => s.channelToken === ctx.channel.token || !s.channelToken
    );
  }
  async exportInvoiceToAccountingPlatform(ctx, invoiceNumber) {
    if (!this.findAccountingExportStrategyForChannel(ctx)) {
      throw new core_1.UserInputError(
        `No account exports configured for channel '${ctx.channel.token}'`
      );
    }
    const invoice = await this.getInvoiceByNumber(ctx, invoiceNumber);
    const order = await this.orderService.findOne(ctx, invoice.orderId, []);
    if (!order) {
      throw new core_1.UserInputError(
        `No order found with id '${invoice.orderId}'. Can not export invoice without order`
      );
    }
    await this.createAccountingExportJob(
      ctx,
      invoice.invoiceNumber,
      order.code
    );
  }
  async handleAccountingExportJob(ctx, invoiceNumber, orderCode) {
    const strategy = this.findAccountingExportStrategyForChannel(ctx);
    if (!strategy) {
      core_1.Logger.warn(
        `No accounting export strategy found for channel ${ctx.channel.token}. Not exporting invoice '${invoiceNumber}' for order '${orderCode}'`,
        constants_1.loggerCtx
      );
      return;
    }
    const [order, invoice] = await Promise.all([
      this.orderService.findOneByCode(ctx, orderCode, this.orderRelations),
      this.getInvoiceByNumber(ctx, invoiceNumber),
    ]);
    if (!order) {
      throw Error(
        `[${constants_1.loggerCtx}] No order found with code ${orderCode}`
      );
    }
    const invoiceRepository = this.connection.getRepository(
      ctx,
      invoice_entity_1.InvoiceEntity
    );
    try {
      if (
        !this.orderMatchesInvoice(order, invoice) &&
        !invoice.isCreditInvoice
      ) {
        // Throw an error when order totals don't match to prevent re-exporting wrong data.
        // Credit invoices are allowed, because they use the reversed invoice.orderTotals instead of the order data itself
        throw Error(
          `Order '${order.code}' has changed compared to the invoice. Can not export this invoice again!`
        );
      }
      let reference;
      if (invoice.isCreditInvoice) {
        reference = await strategy.exportCreditInvoice(
          ctx,
          invoice,
          invoice.isCreditInvoiceFor, // this is always defined when it's a creditInvoice
          order
        );
      } else {
        reference = await strategy.exportInvoice(ctx, invoice, order);
      }
      await invoiceRepository.update(invoice.id, {
        accountingReference: reference,
      });
      core_1.Logger.info(
        `Exported invoice '${invoiceNumber}' for order '${orderCode}' to accounting system '${strategy.constructor.name}' with reference '${reference.reference}'`,
        constants_1.loggerCtx
      );
    } catch (e) {
      await invoiceRepository.update(invoice.id, {
        accountingReference: {
          errorMessage:
            e?.message ||
            `Unknown error occured at ${new Date().toISOString()}`,
        },
      });
      throw e;
    }
  }
  async createAccountingExportJob(ctx, invoiceNumber, orderCode) {
    if (!this.findAccountingExportStrategyForChannel(ctx)) {
      core_1.Logger.debug(
        `No accounting export strategies configured`,
        constants_1.loggerCtx
      );
      return;
    }
    await this.accountingExportQueue.add(
      {
        ctx: ctx.serialize(),
        invoiceNumber,
        orderCode,
      },
      {
        retries: 10,
      }
    );
    core_1.Logger.info(
      `Added accounting export job for invoice '${invoiceNumber}' for order '${orderCode}'`,
      constants_1.loggerCtx
    );
  }
  /**
   * Checks if the total and tax rates of the order still match the ones from the invoice.
   * When they differ, it means the order changed compared to the invoice.
   *
   * This should not be used with credit invoices, as their totals will mostly differ from the order,
   * because a new invoice is created immediately
   */
  orderMatchesInvoice(order, invoice) {
    if (
      order.total !== invoice.orderTotals.total ||
      order.totalWithTax !== invoice.orderTotals.totalWithTax
    ) {
      // Totals don't match anymore
      return false;
    }
    // All order tax summaries should have a matching invoice tax summary
    return order.taxSummary.every((orderSummary) => {
      const matchingInvoiceSummary = invoice.orderTotals.taxSummaries.find(
        (invoiceSummary) =>
          invoiceSummary.taxRate === orderSummary.taxRate &&
          invoiceSummary.taxBase === orderSummary.taxBase
      );
      // If no matching tax summary is found, the order doesn't match the invoice
      return !!matchingInvoiceSummary;
    });
  }
  async getInvoiceByNumber(ctx, invoiceNumber) {
    const invoice = await this.connection
      .getRepository(ctx, invoice_entity_1.InvoiceEntity)
      .findOne({
        where: { invoiceNumber, channelId: String(ctx.channelId) },
        relations: ['isCreditInvoiceFor'],
      });
    if (!invoice) {
      throw Error(
        `[${constants_1.loggerCtx}] No invoice found with code ${invoiceNumber}`
      );
    }
    return invoice;
  }
};
exports.AccountingService = AccountingService;
exports.AccountingService = AccountingService = __decorate(
  [
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(constants_1.PLUGIN_INIT_OPTIONS)),
    __metadata('design:paramtypes', [
      typeof (_a =
        typeof core_1.TransactionalConnection !== 'undefined' &&
        core_1.TransactionalConnection) === 'function'
        ? _a
        : Object,
      typeof (_b =
        typeof core_1.JobQueueService !== 'undefined' &&
        core_1.JobQueueService) === 'function'
        ? _b
        : Object,
      typeof (_c =
        typeof core_1.OrderService !== 'undefined' && core_1.OrderService) ===
      'function'
        ? _c
        : Object,
      typeof (_d =
        typeof invoice_plugin_1.InvoicePluginConfig !== 'undefined' &&
        invoice_plugin_1.InvoicePluginConfig) === 'function'
        ? _d
        : Object,
    ]),
  ],
  AccountingService
);
