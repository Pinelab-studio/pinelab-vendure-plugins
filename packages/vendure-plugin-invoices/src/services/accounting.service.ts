import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  EntityRelationPaths,
  JobQueue,
  JobQueueService,
  Logger,
  Order,
  OrderService,
  RequestContext,
  SerializedRequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { InvoiceEntity } from '../entities/invoice.entity';
import { InvoicePluginConfig } from '../invoice.plugin';
import {
  AccountingExportStrategy,
  ExternalReference,
} from '../strategies/accounting/accounting-export-strategy';

@Injectable()
export class AccountingService implements OnModuleInit {
  constructor(
    private connection: TransactionalConnection,
    private jobQueueService: JobQueueService,
    private orderService: OrderService,
    @Inject(PLUGIN_INIT_OPTIONS) private config: InvoicePluginConfig
  ) {}

  /**
   * JobQueue for exporting invoices to accounting system
   */
  accountingExportQueue!: JobQueue<{
    ctx: SerializedRequestContext;
    orderCode: string;
    invoiceNumber: number;
  }>;

  orderRelations: EntityRelationPaths<Order>[] = [
    'lines.productVariant.product',
    'shippingLines.shippingMethod',
    'payments',
    'customer',
    'surcharges',
  ];

  async onModuleInit(): Promise<void> {
    // Init Accounting Export job queue
    this.accountingExportQueue = await this.jobQueueService.createQueue({
      name: 'export-invoice-to-accounting',
      process: async (job) => {
        await this.handleAccountingExportJob(
          RequestContext.deserialize(job.data.ctx),
          job.data.invoiceNumber,
          job.data.orderCode
        ).catch((error: Error) => {
          Logger.warn(
            `Failed to export invoice '${job.data.invoiceNumber}' to accounting platform for '${job.data.orderCode}': ${error?.message}`,
            loggerCtx
          );
          throw error;
        });
      },
    });
  }

  /**
   * Find strategy for channel. If strategy.channelToken is undefined, it can be used for all channels
   */
  findAccountingExportStrategyForChannel(
    ctx: RequestContext
  ): AccountingExportStrategy | undefined {
    return (this.config.accountingExports || []).find(
      (s) => s.channelToken === ctx.channel.token || !s.channelToken
    );
  }

  async exportInvoiceToAccountingPlatform(
    ctx: RequestContext,
    invoiceNumber: number
  ): Promise<void> {
    if (!this.findAccountingExportStrategyForChannel(ctx)) {
      throw new UserInputError(
        `No account exports configured for channel '${ctx.channel.token}'`
      );
    }
    const invoice = await this.getInvoiceByNumber(ctx, invoiceNumber);
    const order = await this.orderService.findOne(ctx, invoice.orderId, []);
    if (!order) {
      throw new UserInputError(
        `No order found with id '${invoice.orderId}'. Can not export invoice without order`
      );
    }
    await this.createAccountingExportJob(
      ctx,
      invoice.invoiceNumber,
      order.code
    );
  }

  async handleAccountingExportJob(
    ctx: RequestContext,
    invoiceNumber: number,
    orderCode: string
  ): Promise<void> {
    const strategy = this.findAccountingExportStrategyForChannel(ctx);
    if (!strategy) {
      Logger.warn(
        `No accounting export strategy found for channel ${ctx.channel.token}. Not exporting invoice '${invoiceNumber}' for order '${orderCode}'`,
        loggerCtx
      );
      return;
    }
    const [order, invoice] = await Promise.all([
      this.orderService.findOneByCode(ctx, orderCode, this.orderRelations),
      this.getInvoiceByNumber(ctx, invoiceNumber),
    ]);
    if (!order) {
      throw Error(`[${loggerCtx}] No order found with code ${orderCode}`);
    }
    const invoiceRepository = this.connection.getRepository(ctx, InvoiceEntity);
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
      let reference: ExternalReference;
      if (invoice.isCreditInvoice) {
        reference = await strategy.exportCreditInvoice(
          ctx,
          invoice,
          invoice.isCreditInvoiceFor!, // this is always defined when it's a creditInvoice
          order
        );
      } else {
        reference = await strategy.exportInvoice(ctx, invoice, order);
      }
      await invoiceRepository.update(invoice.id, {
        accountingReference: reference,
      });
      Logger.info(
        `Exported invoice '${invoiceNumber}' for order '${orderCode}' to accounting system '${strategy.constructor.name}' with reference '${reference.reference}'`,
        loggerCtx
      );
    } catch (e) {
      await invoiceRepository.update(invoice.id, {
        accountingReference: {
          errorMessage:
            (e as Error)?.message ||
            `Unknown error occured at ${new Date().toISOString()}`,
        },
      });
      throw e;
    }
  }

  async createAccountingExportJob(
    ctx: RequestContext,
    invoiceNumber: number,
    orderCode: string
  ): Promise<void> {
    if (!this.findAccountingExportStrategyForChannel(ctx)) {
      Logger.debug(`No accounting export strategies configured`, loggerCtx);
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
    Logger.info(
      `Added accounting export job for invoice '${invoiceNumber}' for order '${orderCode}'`,
      loggerCtx
    );
  }

  /**
   * Checks if the total and tax rates of the order still match the ones from the invoice.
   * When they differ, it means the order changed compared to the invoice.
   *
   * This should not be used with credit invoices, as their totals will mostly differ from the order,
   * because a new invoice is created immediately
   */
  private orderMatchesInvoice(order: Order, invoice: InvoiceEntity): boolean {
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

  private async getInvoiceByNumber(
    ctx: RequestContext,
    invoiceNumber: number
  ): Promise<InvoiceEntity> {
    const invoice = await this.connection
      .getRepository(ctx, InvoiceEntity)
      .findOne({
        where: { invoiceNumber, channelId: String(ctx.channelId) },
        relations: ['isCreditInvoiceFor'],
      });
    if (!invoice) {
      throw Error(`[${loggerCtx}] No invoice found with code ${invoiceNumber}`);
    }
    return invoice;
  }
}
