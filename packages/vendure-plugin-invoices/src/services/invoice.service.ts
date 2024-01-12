import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import {
  ChannelService,
  EventBus,
  ID,
  Injector,
  JobQueue,
  JobQueueService,
  Logger,
  Order,
  OrderPlacedEvent,
  OrderService,
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import { InvoiceConfigInput } from '../ui/generated/graphql';
import { ModuleRef } from '@nestjs/core';
import { Response } from 'express';
import { createReadStream, ReadStream } from 'fs';
import Handlebars from 'handlebars';
// @ts-ignore
import * as pdf from 'pdf-creator-node';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { InvoiceConfigEntity } from '../entities/invoice-config.entity';
import { InvoiceEntity } from '../entities/invoice.entity';
import { InvoicePluginConfig } from '../invoice.plugin';
import { CreditInvoiceInput } from '../strategies/load-data-fn';
import {
  LocalStorageStrategy,
  RemoteStorageStrategy,
} from '../strategies/storage-strategy';
import { defaultTemplate } from '../util/default-template';
import { createTempFile } from '../util/file.util';
import { reverseOrderTotals } from '../util/order-calculations';
import { InvoiceCreatedEvent } from './invoice-created-event';

interface DownloadInput {
  customerEmail: string;
  orderCode: string;
  invoiceNumber: string | number | undefined;
  res: Response;
}

@Injectable()
export class InvoiceService implements OnModuleInit, OnApplicationBootstrap {
  jobQueue: JobQueue<{ channelToken: string; orderCode: string }> | undefined;
  retries = 10;

  constructor(
    private eventBus: EventBus,
    private jobService: JobQueueService,
    private orderService: OrderService,
    private channelService: ChannelService,
    private moduleRef: ModuleRef,
    private connection: TransactionalConnection,
    @Inject(PLUGIN_INIT_OPTIONS) private config: InvoicePluginConfig
  ) {
    Handlebars.registerHelper('formatMoney', (amount?: number) => {
      if (amount == null) {
        return amount;
      }
      return (amount / 100).toFixed(2);
    });
  }

  async onModuleInit(): Promise<void> {
    // Init jobQueue
    this.jobQueue = await this.jobService.createQueue({
      name: 'generate-invoice',
      process: async (job) =>
        this.createAndSaveInvoice(
          job.data.channelToken,
          job.data.orderCode
        ).catch(async (error) => {
          Logger.warn(
            `Failed to generate invoice for ${job.data.orderCode}: ${error?.message}`,
            loggerCtx
          );
          throw error;
        }),
    });
  }

  /**
   * Listen for OrderPlacedEvents. When an event occures, place generate-invoice job in queue
   */
  onApplicationBootstrap(): void {
    this.eventBus.ofType(OrderPlacedEvent).subscribe(async ({ ctx, order }) => {
      if (!this.jobQueue) {
        return Logger.error(`Invoice jobQueue not initialized`, loggerCtx);
      }
      const enabled = await this.isInvoicePluginEnabled(ctx);
      if (!enabled) {
        return Logger.debug(
          `Invoice generation not enabled for order ${order.code} in channel ${ctx.channel.token}`,
          loggerCtx
        );
      }
      await this.jobQueue.add(
        {
          channelToken: ctx.channel.token,
          orderCode: order.code,
        },
        { retries: this.retries }
      );
      return Logger.info(
        `Added invoice job to queue for order ${order.code}`,
        loggerCtx
      );
    });
  }

  /**
   * Creates an invoice and save it to DB
   * This method can also be used for re-generating an invoice.
   * Re-generating an invoice will also create a credit invoice, if createCreditInvoices is enabled
   */
  async createAndSaveInvoice(
    channelToken: string,
    orderCode: string
  ): Promise<InvoiceEntity> {
    const ctx = await this.createCtx(channelToken);
    let [order, previousInvoiceForOrder, config] = await Promise.all([
      this.orderService.findOneByCode(ctx, orderCode),
      this.getMostRecentInvoiceForOrder(ctx, orderCode),
      this.getConfig(ctx),
    ]);
    if (!config) {
      throw Error(
        `Cannot generate invoice for ${orderCode}, because no config was found`
      );
    } else if (!config.enabled) {
      throw Error(
        `Not generating invoice for ${orderCode} for channel ${channelToken}, because invoice generation is disabled in the config.`
      );
    } else if (!order) {
      throw Error(`No order found with code ${orderCode}`);
    }
    // Create a credit invoice first, if an invoice already exists and config.createCreditInvoices is true
    let creditInvoice: InvoiceEntity | undefined;
    if (previousInvoiceForOrder && config.createCreditInvoices) {
      // Reverse order totals of previous invoice, because creditInvoice
      const reversedOrderTotals = reverseOrderTotals(
        previousInvoiceForOrder.orderTotals
      );
      const { invoiceNumber, invoiceTmpFile } = await this.generateInvoice(
        ctx,
        config.templateString!,
        order,
        {
          previousInvoice: previousInvoiceForOrder,
          reversedOrderTotals,
        }
      );
      const storageReference = await this.config.storageStrategy.save(
        invoiceTmpFile,
        invoiceNumber,
        channelToken,
        true
      );
      creditInvoice = await this.saveInvoice(ctx, {
        channelId: ctx.channelId as string,
        invoiceNumber,
        orderId: order.id as string,
        storageReference,
        orderTotals: reversedOrderTotals,
      });
    }
    // Generate normal/debit invoice
    const { invoiceNumber, invoiceTmpFile } = await this.generateInvoice(
      ctx,
      config.templateString!,
      order
    );
    const storageReference = await this.config.storageStrategy.save(
      invoiceTmpFile,
      invoiceNumber,
      channelToken,
      false
    );
    const newInvoice = await this.saveInvoice(ctx, {
      channelId: ctx.channelId as string,
      invoiceNumber,
      orderId: order.id as string,
      storageReference,
      orderTotals: {
        taxSummaries: order.taxSummary,
        total: order.total,
        totalWithTax: order.totalWithTax,
      },
    });
    this.eventBus.publish(
      new InvoiceCreatedEvent(
        ctx,
        order,
        newInvoice,
        previousInvoiceForOrder,
        creditInvoice
      )
    );
    return newInvoice;
  }

  /**
   * Just generates PDF, no storing in DB
   */
  async generateInvoice(
    ctx: RequestContext,
    templateString: string,
    order: Order,
    shouldGenerateCreditInvoice?: CreditInvoiceInput
  ): Promise<{ invoiceTmpFile: string; invoiceNumber: number }> {
    const latestInvoiceNumber = await this.getLatestInvoiceNumber(ctx);
    const data = await this.config.loadDataFn(
      ctx,
      new Injector(this.moduleRef),
      order,
      latestInvoiceNumber,
      shouldGenerateCreditInvoice
    );
    const tmpFilePath = await createTempFile('.pdf');
    const html = templateString;
    const options = {
      format: 'A4',
      orientation: 'portrait',
      border: '10mm',
      timeout: 1000 * 60 * 5, // 5 min
      childProcessOptions: {
        env: {
          OPENSSL_CONF: '/dev/null',
        },
      },
    };
    const document = {
      html,
      data,
      path: tmpFilePath,
      type: '',
    };
    await pdf.create(document, options);
    return {
      invoiceTmpFile: tmpFilePath,
      invoiceNumber: data.invoiceNumber,
    };
  }

  /**
   * Generates an invoice for the latest placed order and the given template
   */
  async previewInvoiceWithTemplate(
    ctx: RequestContext,
    template: string,
    orderCode: string
  ): Promise<ReadStream> {
    const order = await this.orderService.findOneByCode(ctx, orderCode);
    if (!order) {
      throw new UserInputError(`No order found with code ${orderCode}`);
    }
    const config = await this.getConfig(ctx);
    if (!config) {
      throw Error(`No config found for channel ${ctx.channel.token}`);
    }
    const { invoiceTmpFile } = await this.generateInvoice(ctx, template, order);
    return createReadStream(invoiceTmpFile);
  }

  /**
   * Returns a redirect if a publicUrl is created
   * otherwise returns a ReadStream from the invoice
   */
  async downloadInvoice(
    ctx: RequestContext,
    input: DownloadInput
  ): Promise<ReadStream | string> {
    const order = await this.orderService.findOneByCode(ctx, input.orderCode, [
      'customer',
    ]);
    if (!order) {
      throw Error(`No order found with code ${input.orderCode}`);
    }
    if (order.customer?.emailAddress !== input.customerEmail) {
      throw Error(
        `This order doesn't belong to customer ${input.customerEmail}`
      );
    }
    const invoices = await this.getInvoicesForOrder(ctx, order.id);
    if (!invoices.length) {
      throw Error(`No invoices exists for ${input.orderCode}`);
    }
    let invoice = invoices[0]; // First invoice, because sorted by createdAt
    // If an invoiceNumber is given, we need to find the invoice with that number
    if (input.invoiceNumber) {
      const invoiceWithNumber = invoices.find(
        (i) => i.invoiceNumber == input.invoiceNumber
      );
      if (!invoiceWithNumber) {
        throw new UserInputError(
          `No invoice found with number ${input.invoiceNumber}`
        );
      }
      invoice = invoiceWithNumber;
    }
    const strategy = this.config.storageStrategy;
    if ((strategy as RemoteStorageStrategy).getPublicUrl) {
      return await (strategy as RemoteStorageStrategy).getPublicUrl(invoice);
    } else {
      return await (strategy as LocalStorageStrategy).streamFile(
        invoice,
        input.res
      );
    }
  }

  /**
   * Return all invoices for order, sorted by createdAt
   */
  async getInvoicesForOrder(
    ctx: RequestContext,
    orderId: ID
  ): Promise<InvoiceEntity[]> {
    const invoiceRepo = this.connection.getRepository(ctx, InvoiceEntity);
    return await invoiceRepo.find({
      where: {
        orderId: String(orderId),
      },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get the most recent invoice for this order
   */
  async getMostRecentInvoiceForOrder(
    ctx: RequestContext,
    orderCode: string
  ): Promise<InvoiceEntity | undefined> {
    const order = await this.orderService.findOneByCode(ctx, orderCode);
    if (!order) {
      throw Error(`No order found with code ${orderCode}`);
    }
    const invoices = await this.getInvoicesForOrder(ctx, order.id);
    if (!invoices.length) {
      return undefined;
    }
    return invoices[invoices.length - 1];
  }

  /**
   * Get last generated invoice number for this channel
   */
  async getLatestInvoiceNumber(
    ctx: RequestContext
  ): Promise<number | undefined> {
    const invoiceRepo = this.connection.getRepository(ctx, InvoiceEntity);
    const result = await invoiceRepo.findOne({
      where: [{ channelId: ctx.channelId as string }],
      select: ['invoiceNumber'],
      order: { invoiceNumber: 'DESC' },
      cache: false,
    });
    return result?.invoiceNumber;
  }

  /**
   * Construct the download url for an invoice.
   * @Example
   * `/invoices/default-channel/DJSLHJ238390/123?email=customer@example.com`
   */
  getDownloadUrl(
    ctx: RequestContext,
    invoice: InvoiceEntity,
    orderCode: string,
    customerEmail: string
  ): string {
    const emailAddress = encodeURIComponent(customerEmail);
    return `${this.config.vendureHost}/invoices/${ctx.channel.token}/${orderCode}/${invoice.invoiceNumber}?email=${emailAddress}`;
  }

  async upsertConfig(
    ctx: RequestContext,
    input: InvoiceConfigInput
  ): Promise<InvoiceConfigEntity> {
    const configRepo = this.connection.getRepository(ctx, InvoiceConfigEntity);
    const existing = await configRepo.findOne({
      where: { channelId: String(ctx!.channelId) },
    });
    if (existing) {
      await configRepo.update(existing.id, input);
    } else {
      await configRepo.insert({
        ...input,
        channelId: String(ctx.channelId),
      });
    }
    return configRepo.findOneOrFail({
      where: { channelId: String(ctx.channelId) },
    });
  }

  async getConfig(
    ctx: RequestContext
  ): Promise<InvoiceConfigEntity | undefined> {
    const configRepo = this.connection.getRepository(ctx, InvoiceConfigEntity);
    let config = await configRepo.findOne({
      where: { channelId: String(ctx.channelId) },
    });
    if (!config) {
      // Create disabled sample config
      config = await this.upsertConfig(ctx, {
        enabled: false,
        createCreditInvoices: true,
        templateString: defaultTemplate,
      });
    }
    // If no template saved, return the default template as suggestion
    if (!config.templateString || !config.templateString.trim()) {
      config.templateString = defaultTemplate;
    }
    return config;
  }

  async isInvoicePluginEnabled(ctx: RequestContext): Promise<boolean> {
    const configRepo = this.connection.getRepository(ctx, InvoiceConfigEntity);
    const result = await configRepo.findOne({
      select: ['enabled'],
      where: { channelId: ctx.channelId as string },
    });
    return !!result?.enabled;
  }

  private async saveInvoice(
    ctx: RequestContext,
    invoice: Omit<
      InvoiceEntity,
      'id' | 'createdAt' | 'updatedAt' | 'isCreditInvoice'
    >
  ): Promise<InvoiceEntity> {
    const invoiceRepo = this.connection.getRepository(ctx, InvoiceEntity);
    const { id } = await invoiceRepo.save(invoice);
    return invoiceRepo.findOneOrFail({ where: { id } });
  }

  private async createCtx(channelToken: string): Promise<RequestContext> {
    const channel = await this.channelService.getChannelFromToken(channelToken);
    return new RequestContext({
      apiType: 'admin',
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
      channel,
    });
  }
}
