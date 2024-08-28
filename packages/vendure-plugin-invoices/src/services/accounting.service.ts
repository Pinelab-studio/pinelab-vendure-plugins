import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import {
  EntityRelationPaths,
  ID,
  JobQueue,
  JobQueueService,
  Logger,
  Order,
  OrderService,
  Product,
  RequestContext,
  SerializedRequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { AccountingExportStrategy } from '../strategies/accounting/accounting-export-strategy';
import { InvoicePluginConfig } from '../invoice.plugin';
import util from 'util';
import { InvoiceEntity } from '../entities/invoice.entity';

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
            `Failed to export invoice to accounting platform for '${job.data.orderCode}': ${error?.message}`,
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
      const reference = await strategy.exportInvoice(
        ctx,
        invoice,
        order,
        invoice.isCreditInvoiceFor
      );
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
          errorMessage: (e as Error)?.message,
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
