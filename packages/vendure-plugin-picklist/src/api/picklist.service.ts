import { Injectable } from '@nestjs/common';
import {
  JobQueue,
  Order,
  OrderService,
  RequestContext,
  TransactionalConnection,
  translateEntity,
  UserInputError,
} from '@vendure/core';

import { InvoiceConfigInput } from '../ui/generated/graphql';
import Handlebars from 'handlebars';
import { defaultTemplate } from './default-template';
import { InvoiceConfigEntity } from './invoice-config.entity';
import { createReadStream, ReadStream } from 'fs';
import { createTempFile, zipFiles, ZippableFile } from './file.util';
import { SortOrder } from '@vendure/common/lib/generated-shop-types';
import { InvoiceData } from './types';

@Injectable()
export class PicklistService {
  jobQueue: JobQueue<{ channelToken: string; orderCode: string }> | undefined;
  retries = 10;

  constructor(
    private readonly connection: TransactionalConnection,
    private readonly orderService: OrderService
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
  async downloadPicklist(
    ctx: RequestContext,
    orders: Order[]
  ): Promise<ReadStream> {
    const config = await this.getConfig(ctx);
    if (!config) {
      throw Error(`No config found for channel ${ctx.channel.token}`);
    }
    const { tempFilePath } = await this.generateInvoice(
      ctx,
      config.templateString ?? defaultTemplate,
      orders
    );
    return createReadStream(tempFilePath);
  }

  /**
   * Just generates PDF, no storing in DB
   */
  async generateInvoice(
    ctx: RequestContext,
    templateString: string,
    orders: Order[]
  ): Promise<{ tempFilePath: string; orderCode: string }> {
    const pdf = require('pdf-creator-node');
    const data = await this.getData(ctx, orders);
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
    return { tempFilePath: tmpFilePath, orderCode: orders[0].code };
  }

  /**
   * Generates an invoice for the latest placed order and the given template
   */
  async previewInvoiceWithTemplate(
    ctx: RequestContext,
    template: string,
    orderCode?: string
  ): Promise<ReadStream> {
    let order: Order | undefined;
    if (orderCode) {
      order = await this.orderService.findOneByCode(ctx, orderCode);
    } else {
      const orderId = (
        await this.orderService.findAll(
          ctx,
          {
            take: 1,
            sort: { createdAt: SortOrder.DESC },
          },
          []
        )
      )?.items[0].id;
      order = await this.orderService.findOne(ctx, orderId);
    }
    if (!order) {
      throw new UserInputError(`No order found with code ${orderCode}`);
    }
    const config = await this.getConfig(ctx);
    if (!config) {
      throw Error(`No config found for channel ${ctx.channel.token}`);
    }
    const { tempFilePath } = await this.generateInvoice(ctx, template, [order]);
    return createReadStream(tempFilePath);
  }

  async getData(
    ctx: RequestContext,
    orders: Order[],
    latestInvoiceNumber?: number
  ): Promise<InvoiceData> {
    for (let order of orders) {
      order.lines.forEach((line) => {
        line.productVariant = translateEntity(
          line.productVariant,
          ctx.languageCode
        );
      });
      if (!order.customer?.emailAddress) {
        throw Error(`Order doesnt have a customer.email set!`);
      }
    }
    let nr = latestInvoiceNumber;
    if (nr) {
      nr += 1;
    } else {
      nr = Math.floor(Math.random() * 90000) + 10000;
    }
    return {
      invoiceNumber: nr,
      customerEmail: orders[0].customer?.emailAddress,
      orders,
    };
  }
}
