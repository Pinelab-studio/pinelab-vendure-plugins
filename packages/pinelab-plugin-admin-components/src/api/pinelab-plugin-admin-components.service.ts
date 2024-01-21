import { Injectable, Inject } from '@nestjs/common';
import {
  Injector,
  JobQueue,
  Order,
  OrderService,
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';

import { InvoiceConfigInput } from '../ui/generated/graphql';
import { ModuleRef } from '@nestjs/core';
import Handlebars from 'handlebars';
import { defaultTemplate } from './default-template';
import { InvoiceConfigEntity } from './invoice-config.entity';
import { createReadStream, ReadStream } from 'fs';
import { PLUGIN_INIT_OPTIONS } from '../constants';
import { PinelabAdminComponentsPluginConfig } from '../plugin';
import { InvoiceData } from './strategies/data-strategy';
import { createTempFile } from './file.util';

@Injectable()
export class PinelabPluginAdminComponentsService {
  jobQueue: JobQueue<{ channelToken: string; orderCode: string }> | undefined;
  retries = 10;

  constructor(
    private readonly connection: TransactionalConnection,
    private readonly orderService: OrderService,
    private readonly moduleRef: ModuleRef,
    @Inject(PLUGIN_INIT_OPTIONS)
    private readonly config: PinelabAdminComponentsPluginConfig
  ) {
    Handlebars.registerHelper('formatMoney', (amount?: number) => {
      if (amount == null) {
        return amount;
      }
      return (amount / 100).toFixed(2);
    });
  }

  async upsertConfig(
    ctx: RequestContext,
    input: InvoiceConfigInput
  ): Promise<InvoiceConfigEntity> {
    const configRepo = this.connection.getRepository(ctx, InvoiceConfigEntity);
    const existing = await configRepo.findOne({
      where: { channelId: ctx.channelId as string },
    });
    if (existing) {
      await configRepo.update(existing.id, input);
    } else {
      await configRepo.insert({
        ...input,
        channelId: ctx.channelId as string,
      });
    }
    return await configRepo.findOneOrFail({
      where: { channelId: ctx.channelId as string },
    });
  }

  async getConfig(
    ctx: RequestContext
  ): Promise<InvoiceConfigEntity | undefined> {
    const configRepo = this.connection.getRepository(ctx, InvoiceConfigEntity);
    let config = await configRepo.findOne({
      where: { channelId: ctx.channelId as string },
    });
    if (!config) {
      // sample config for display
      config = {
        id: ctx.channelId,
        channelId: ctx.channelId as string,
        createdAt: new Date(),
        updatedAt: new Date(),
        enabled: false,
      };
    }
    if (!config.templateString || !config.templateString.trim()) {
      config.templateString = defaultTemplate;
    }
    return config;
  }

  /**
   * Generates an invoice for the latest placed order and the given template
   */
  async testTemplate(
    ctx: RequestContext,
    template: string
  ): Promise<ReadStream> {
    const {
      items: [latestOrder],
    } = await this.orderService.findAll(ctx, {
      sort: { orderPlacedAt: 'DESC' as any },
      take: 1,
    });
    const config = await this.getConfig(ctx);
    if (!config) {
      throw Error(`No config found for channel ${ctx.channel.token}`);
    }
    const { tmpFileName } = await this.generateInvoice(
      ctx,
      template,
      latestOrder
    );
    return createReadStream(tmpFileName);
  }

  /**
   * Just generates PDF, no storing in DB
   */
  async generateInvoice(
    ctx: RequestContext,
    templateString: string,
    order: Order
  ): Promise<{ tmpFileName: string } & InvoiceData> {
    const pdf = require('pdf-creator-node');
    const data = await this.config.dataStrategy.getData({
      ctx,
      injector: new Injector(this.moduleRef),
      order,
      latestInvoiceNumber: undefined,
    });
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
      tmpFileName: tmpFilePath,
      invoiceNumber: data.invoiceNumber,
      customerEmail: data.customerEmail,
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
    const { tmpFileName } = await this.generateInvoice(ctx, template, order);
    return createReadStream(tmpFileName);
  }
}
