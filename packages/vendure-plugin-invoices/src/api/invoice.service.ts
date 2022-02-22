import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import { Connection, Repository } from 'typeorm';
import {
  Channel,
  ChannelService,
  EventBus,
  JobQueue,
  JobQueueService,
  JsonCompatible,
  Logger,
  Order,
  OrderPlacedEvent,
  OrderService,
  RequestContext,
} from '@vendure/core';

import {
  InvoiceConfigInput,
  InvoiceList,
  InvoicesListInput,
} from '../ui/generated/graphql';
// @ts-ignore
import * as pdf from 'pdf-creator-node';
import Handlebars from 'handlebars';
import { defaultTemplate } from './default-template';
import { InvoicePluginConfig } from '../invoice.plugin';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { InvoiceConfigEntity } from './entities/invoice-config.entity';
import { InvoiceEntity } from './entities/invoice.entity';
import { InvoiceData } from './strategies/data-strategy';
import { ReadStream } from 'fs';
import {
  LocalStorageStrategy,
  RemoteStorageStrategy,
} from './strategies/storage-strategy';
import { Response } from 'express';
import { createTempFile } from './file.util';

interface DownloadInput {
  channelToken: string;
  customerEmail: string;
  orderCode: string;
  res: Response;
}

@Injectable()
export class InvoiceService implements OnModuleInit, OnApplicationBootstrap {
  jobQueue: JobQueue<{ channelId: string; orderCode: string }> | undefined;
  invoiceRepo: Repository<InvoiceEntity>;
  configRepo: Repository<InvoiceConfigEntity>;
  retries = 10;

  constructor(
    private eventBus: EventBus,
    private jobService: JobQueueService,
    private orderService: OrderService,
    private channelService: ChannelService,
    connection: Connection,
    @Inject(PLUGIN_INIT_OPTIONS) private config: InvoicePluginConfig
  ) {
    this.invoiceRepo = connection.getRepository(InvoiceEntity);
    this.configRepo = connection.getRepository(InvoiceConfigEntity);
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
        this.createAndSaveInvoice(job.data.channelId, job.data.orderCode).catch(
          async (error) => {
            if (job.attempts >= this.retries) {
              Logger.error(
                `Failed to generate invoice for ${job.data.orderCode}. This was the final attempt.`,
                loggerCtx,
                error
              );
            }
            Logger.warn(
              `Failed to generate invoice for ${job.data.orderCode}: ${error?.message}`,
              loggerCtx
            );
            throw error;
          }
        ),
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
      const enabled = await this.isInvoicePluginEnabled(
        ctx.channelId as string
      );
      if (!enabled) {
        return Logger.debug(
          `Invoice generation not enabled for order ${order.code}`,
          loggerCtx
        );
      }
      await this.jobQueue.add(
        {
          channelId: ctx.channelId as string,
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
   * Checks if an invoice has already been created for this order
   */
  async createAndSaveInvoice(channelId: string, orderCode: string) {
    let [order, existingInvoice, config] = await Promise.all([
      this.orderService.findOneByCode(await this.createCtx(), orderCode),
      this.getInvoice(orderCode),
      this.getConfig(channelId),
    ]);
    if (!config) {
      throw Error(
        `Cannot generate invoice for ${orderCode}, because no config was found`
      );
    } else if (!config.enabled) {
      return Logger.warn(
        `Not generating invoice for ${orderCode}, because plugin is disabled. This message should not be in the queue!`,
        loggerCtx
      );
    } else if (!order) {
      throw Error(`No order found with code ${orderCode}`);
    }
    if (existingInvoice) {
      throw Error(
        `An invoice with number ${existingInvoice.invoiceNumber} was already created for order ${orderCode}`
      );
    }
    const { invoiceNumber, customerEmail, tmpFileName } =
      await this.generateInvoice(channelId, config, order);
    const storageReference = await this.config.storageStrategy.save(
      tmpFileName,
      invoiceNumber
    );
    return this.saveInvoice({
      channelId,
      invoiceNumber,
      orderCode,
      customerEmail,
      orderId: order.id as string,
      storageReference,
    });
  }

  /**
   * Just generates PDF, no storing in DB
   */
  async generateInvoice(
    channelId: string,
    config: InvoiceConfigEntity,
    order: Order
  ): Promise<{ tmpFileName: string } & InvoiceData> {
    const latestInvoiceNumber = await this.getLatestInvoiceNumber(channelId);
    const data = await this.config.dataStrategy.getData(
      latestInvoiceNumber,
      order
    );
    const tmpFilePath = await createTempFile('.pdf');
    const html = config.templateString;
    const options = {
      format: 'A4',
      orientation: 'portrait',
      border: '10mm',
      timeout: 1000 * 60 * 5, // 5 min
    };
    const document = {
      html,
      data,
      path: tmpFilePath,
      type: '',
    };
    await pdf.create(document, options);
    return {
      tmpFileName: tmpFilePath,
      invoiceNumber: data.invoiceNumber,
      customerEmail: data.customerEmail,
    };
  }

  /**
   * Returns a redirect if a publicUrl is created
   * otherwise returns a ReadStream from a file
   */
  async downloadInvoice(input: DownloadInput): Promise<ReadStream | string> {
    const channel = await this.channelService.getChannelFromToken(
      input.channelToken
    );
    const invoice = await this.invoiceRepo.findOne({
      orderCode: input.orderCode,
    });
    if (channel.token != input.channelToken) {
      throw Error(`Channel ${input.channelToken} doesn't exist`);
    } else if (!invoice) {
      throw Error(`No invoice exists for ${input.orderCode}`);
    } else if (invoice.customerEmail !== input.customerEmail) {
      throw Error(
        `This invoice doesnt belong to customer ${input.customerEmail}`
      );
    } else if (invoice.channelId != channel.id) {
      throw Error(
        `This invoice doesnt belong to channel ${input.channelToken}`
      );
    }
    const strategy = this.config.storageStrategy;
    if ((strategy as RemoteStorageStrategy).getPublicUrl) {
      return (strategy as RemoteStorageStrategy).getPublicUrl(invoice);
    } else {
      return (strategy as LocalStorageStrategy).streamFile(invoice, input.res);
    }
  }

  async downloadMultiple(
    channelId: string,
    invoiceNumbers: string[],
    res: Response
  ): Promise<ReadStream> {
    const nrSelectors = invoiceNumbers.map((i) => ({
      invoiceNumber: i,
      channelId,
    }));
    const invoices = await this.invoiceRepo.find({
      where: nrSelectors,
    });
    if (!invoices) {
      throw Error(
        `No invoices found for channel ${channelId} and invoiceNumbers ${invoiceNumbers}`
      );
    }
    return this.config.storageStrategy.streamMultiple(invoices, res);
  }

  async upsertConfig(
    channelId: string,
    input: InvoiceConfigInput
  ): Promise<InvoiceConfigEntity> {
    const existing = await this.configRepo.findOne({ channelId });
    if (existing) {
      await this.configRepo.update(existing.id, input);
    } else {
      await this.configRepo.insert({ ...input, channelId });
    }
    return this.configRepo.findOneOrFail({ channelId });
  }

  async getConfig(channelId: string): Promise<InvoiceConfigEntity | undefined> {
    const config = await this.configRepo.findOne({ channelId });
    if (!config) {
      return undefined;
    }
    if (!config.templateString || !config.templateString.trim()) {
      config.templateString = defaultTemplate;
    }
    return config;
  }

  async isInvoicePluginEnabled(channelId: string): Promise<boolean> {
    const result = await this.configRepo.findOne({
      select: ['enabled'],
      where: { channelId },
    });
    return !!result?.enabled;
  }

  async getInvoice(orderCode: string): Promise<InvoiceEntity | undefined> {
    return this.invoiceRepo.findOne({ orderCode });
  }

  /**
   * Get most recent invoice for this channel
   */
  async getLatestInvoiceNumber(channelId: string): Promise<number | undefined> {
    const result = await this.invoiceRepo.findOne({
      where: [{ channelId }],
      select: ['invoiceNumber'],
      order: { invoiceNumber: 'DESC' },
      cache: false,
    });
    return result?.invoiceNumber;
  }

  async getAllInvoices(
    channel: Channel,
    input?: InvoicesListInput
  ): Promise<InvoiceList> {
    let skip = 0;
    let take = 25;
    if (input) {
      take = input.itemsPerPage;
      skip = input.page > 1 ? take * input.page : 0;
    }
    const [invoices, totalItems] = await this.invoiceRepo.findAndCount({
      where: [{ channelId: channel.id }],
      order: { invoiceNumber: 'DESC' },
      skip,
      take,
    });
    const invoicesWithUrl = invoices.map((invoice) => ({
      ...invoice,
      id: invoice.id as string,
      downloadUrl: `${this.config.downloadHost}/invoices/${channel.token}/${invoice.orderCode}?email=${invoice.customerEmail}`,
    }));
    return {
      items: invoicesWithUrl,
      totalItems,
    };
  }

  private async saveInvoice(
    invoice: Omit<InvoiceEntity, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<InvoiceEntity | undefined> {
    return this.invoiceRepo.save(invoice);
  }

  async createCtx(): Promise<RequestContext> {
    const channel = await this.channelService.getDefaultChannel();
    return new RequestContext({
      apiType: 'admin',
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
      channel,
    });
  }
}
