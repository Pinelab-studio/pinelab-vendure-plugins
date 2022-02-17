import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import {
  Channel,
  ChannelService,
  EventBus,
  JobQueue,
  JobQueueService,
  Logger,
  Order,
  OrderPlacedEvent,
  OrderService,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';

import { Invoice, InvoiceConfigInput } from '../ui/generated/graphql';
// @ts-ignore
import * as pdf from 'pdf-creator-node';
import * as tmp from 'tmp';
import Handlebars from 'handlebars';
import { defaultTemplate } from './default-template';
import { InvoicePluginConfig } from '../invoice.plugin';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { InvoiceConfigEntity } from './entities/invoice-config.entity';
import { InvoiceEntity } from './entities/invoice.entity';
import { InvoiceData } from './strategies/data-strategy';

@Injectable()
export class InvoiceService implements OnModuleInit, OnApplicationBootstrap {
  jobQueue: JobQueue<{ channelId: string; orderCode: string }> | undefined;

  constructor(
    private eventBus: EventBus,
    private jobService: JobQueueService,
    private orderService: OrderService,
    private channelService: ChannelService,
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
    this.jobQueue = await this.jobService.createQueue({
      name: 'generate-invoice',
      process: async (job) =>
        await this.createAndSaveInvoice(
          job.data.channelId,
          job.data.orderCode
        ).catch((error) => {
          Logger.error(
            `Failed to generate invoice for  ${job.data.orderCode}`,
            loggerCtx,
            error
          );
          throw error;
        }),
    });
  }

  /**
   * Listen for OrderPlacedEvents. When an event occures, place generate-invoice job in queue
   */
  onApplicationBootstrap(): void {
    this.eventBus.ofType(OrderPlacedEvent).subscribe(async (event) => {
      if (!this.jobQueue) {
        return Logger.error(`Invoice jobQueue not initialized`, loggerCtx);
      }
      await this.jobQueue.add(
        {
          channelId: event.ctx.channelId as string,
          orderCode: event.order.code,
        },
        { retries: 3 }
      );
      return Logger.info(
        `Added invoice job to queue for order ${event.order.code}`,
        loggerCtx
      );
    });
  }

  /**
   * Creates an invoice and save it to DB
   * Checks if an invoice has already been created for this order
   */
  async createAndSaveInvoice(channelId: string, orderCode: string) {
    const [order, invoice] = await Promise.all([
      this.orderService.findOneByCode(await this.createCtx(), orderCode),
      this.getInvoice(orderCode),
    ]);
    if (!order) {
      throw Error(`No order found with code ${orderCode}`);
    }
    if (invoice) {
      throw Error(
        `An invoice with number ${invoice.invoiceNumber} was already created for order ${orderCode}`
      );
    }
    const { invoiceNumber, customerEmail, tmpFileName } =
      await this.generateInvoice(channelId, order);
    const storageReference = await this.config.storageStrategy.save(
      tmpFileName
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

  private async generateInvoice(
    channelId: string,
    order: Order
  ): Promise<{ tmpFileName: string } & InvoiceData> {
    const config = await this.getConfig(channelId);
    if (!config) {
      throw Error(`No invoice config found for channel ${channelId}`);
    }
    // TODO get previous invoice
    const data = await this.config.dataStrategy.getData(undefined, order);
    const tmpFile = tmp.fileSync({ postfix: '.pdf', name: data.invoiceNumber });
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
      path: tmpFile.name,
      type: '',
    };
    await pdf.create(document, options);
    return {
      tmpFileName: tmpFile.name,
      invoiceNumber: data.invoiceNumber,
      customerEmail: data.customerEmail,
    };
  }

  async upsertConfig(
    channelId: string,
    input: InvoiceConfigInput
  ): Promise<InvoiceConfigEntity> {
    const repo = this.connection.getRepository(InvoiceConfigEntity);
    const existing = await repo.findOne({ channelId });
    if (existing) {
      await repo.update(existing.id, input);
    } else {
      await repo.insert({ ...input, channelId });
    }
    return repo.findOneOrFail({ channelId });
  }

  async getConfig(channelId: string): Promise<InvoiceConfigEntity | undefined> {
    const config = await this.connection
      .getRepository(InvoiceConfigEntity)
      .findOne({ channelId });
    if (!config) {
      return undefined;
    }
    if (!config.templateString || !config.templateString.trim()) {
      config.templateString = defaultTemplate;
    }
    return config;
  }

  async getInvoice(orderCode: string): Promise<InvoiceEntity | undefined> {
    return this.connection.getRepository(InvoiceEntity).findOne({ orderCode });
  }

  /**
   * Get most recent invoice for this channel
   */
  async getLatestInvoice(
    channelId: string
  ): Promise<InvoiceEntity | undefined> {
    return this.connection.getRepository(InvoiceEntity).findOne({
      where: [{ channelId }],
      order: { createdAt: 'DESC' },
    });
  }

  async getAllInvoices(channel: Channel, page?: number): Promise<Invoice[]> {
    let skip = 0;
    const take = 50;
    if (page) {
      skip = page * take;
    }
    const invoices = await this.connection.getRepository(InvoiceEntity).find({
      where: [{ channelId: channel.id }],
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return invoices.map((invoice) => ({
      ...invoice,
      id: invoice.id as string,
      downloadUrl: `/invoices/${channel.token}/${invoice.orderCode}?email=${invoice.customerEmail}`,
    }));
  }

  async saveInvoice(
    invoice: Partial<InvoiceEntity>
  ): Promise<InvoiceEntity | undefined> {
    return this.connection.getRepository(InvoiceEntity).save(invoice);
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
