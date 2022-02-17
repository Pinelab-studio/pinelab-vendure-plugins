import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import {
  ChannelService,
  EventBus,
  JobQueue,
  JobQueueService,
  Logger,
  OrderPlacedEvent,
  OrderService,
  RequestContext,
} from '@vendure/core';
import { loggerCtx } from '../../../vendure-plugin-goedgepickt/src/constants';
import { Invoice } from '../ui/generated/graphql';
import fs from 'fs';
// @ts-ignore
import * as pdf from 'pdf-creator-node';
import * as tmp from 'tmp';
import Handlebars from 'handlebars';
import path from 'path';

@Injectable()
export class InvoiceService implements OnModuleInit, OnApplicationBootstrap {
  jobQueue: JobQueue<{ orderCode: string }> | undefined;
  config = {
    templatePath: path.join(__dirname, './default-template.html'),
  };

  constructor(
    private eventBus: EventBus,
    private jobService: JobQueueService,
    private orderService: OrderService,
    private channelService: ChannelService
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
        await this.generateInvoice(job.data.orderCode).catch((error) => {
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
      await this.jobQueue.add({ orderCode: event.order.code }, { retries: 3 });
      return Logger.info(
        `Added invoice job to queue for order ${event.order.code}`,
        loggerCtx
      );
    });
  }

  async generateInvoice(orderCode: string): Promise<Invoice> {
    // TODO check if invoice is already generated for this order
    // TODO invoiceNUmber
    // TODO channel address
    // TODO channelName
    // TODO logo as base64
    const order = await this.orderService.findOneByCode(
      await this.createCtx(),
      orderCode
    );
    if (!order) {
      throw Error(`No order found with code ${orderCode}`);
    }
    const address = order.billingAddress?.company
      ? order.billingAddress
      : order.shippingAddress;
    if (!order.customer?.emailAddress) {
      throw Error(`No customerEmail set for order ${orderCode}`);
    }
    const tmpFile = tmp.fileSync({ postfix: '.pdf' });
    const html = fs.readFileSync(this.config.templatePath, 'utf8');
    const options = {
      format: 'A4',
      orientation: 'portrait',
      border: '10mm',
      timeout: 1000 * 60 * 5, // 5 min
    };

    const document = {
      html: html,
      data: {
        order,
        address,
      },
      path: tmpFile.name,
      type: '',
    };
    await pdf.create(document, options);
    return {
      id: orderCode,
      orderCode,
      createdAt: new Date(),
      customerEmail: order!.customer!.emailAddress,
      downloadUrl: tmpFile.name,
    };
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
