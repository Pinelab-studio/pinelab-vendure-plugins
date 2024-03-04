import { Injectable, Inject } from '@nestjs/common';
import { SortOrder } from '@vendure/common/lib/generated-shop-types';
import { ModuleRef } from '@nestjs/core';
import {
  Injector,
  Order,
  OrderService,
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import { createReadStream, ReadStream } from 'fs';
import Handlebars from 'handlebars';
import { defaultTemplate } from './default-template';
import {
  createTempFile,
  safeRemoveFile,
  zipFiles,
  ZippableFile,
} from './file.util';
import { PicklistConfigEntity } from './picklist-config.entity';
import { PLUGIN_INIT_OPTIONS } from '../constants';
import { PicklistPluginConfig } from '../plugin';

@Injectable()
export class PicklistService {
  constructor(
    private readonly connection: TransactionalConnection,
    private readonly orderService: OrderService,
    private moduleRef: ModuleRef,
    @Inject(PLUGIN_INIT_OPTIONS) private pluginInitOptions: PicklistPluginConfig
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
    templateString: string
  ): Promise<PicklistConfigEntity> {
    const configRepo = this.connection.getRepository(ctx, PicklistConfigEntity);
    const existing = await configRepo.findOne({
      where: { channelId: ctx.channelId as string },
    });
    if (existing) {
      await configRepo.update(existing.id, { templateString });
    } else {
      await configRepo.insert({
        templateString,
        channelId: ctx.channelId as string,
      });
    }
    return await configRepo.findOneOrFail({
      where: { channelId: ctx.channelId as string },
    });
  }

  async getConfig(
    ctx: RequestContext
  ): Promise<PicklistConfigEntity | undefined> {
    const configRepo = this.connection.getRepository(ctx, PicklistConfigEntity);
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
   * Generates an picklist for the latest placed order and the given template
   */
  async downloadPicklist(
    ctx: RequestContext,
    order: Order
  ): Promise<ReadStream> {
    const config = await this.getConfig(ctx);
    if (!config) {
      throw Error(`No config found for channel ${ctx.channel.token}`);
    }
    const { tempFilePath } = await this.generatePicklist(
      ctx,
      config.templateString ?? defaultTemplate,
      order
    );
    const stream = createReadStream(tempFilePath);
    stream.on('finish', () => safeRemoveFile(tempFilePath));
    return stream;
  }

  async downloadMultiplePicklists(ctx: RequestContext, orders: Order[]) {
    // This is currently done in main thread, so a max of 10 orders is allowed
    if (orders.length > 10) {
      throw new UserInputError(`Max 10 orders allowed`);
    }
    const config = await this.getConfig(ctx);
    if (!config) {
      throw Error(`No config found for channel ${ctx.channel.token}`);
    }
    const picklistData = await Promise.all(
      orders.map(async (order) => {
        const hydratedOrder = await this.orderService.findOne(ctx, order.id);
        if (!hydratedOrder) {
          throw new UserInputError(`No Order with code ${order.code} found`);
        }
        return await this.generatePicklist(
          ctx,
          config.templateString ?? defaultTemplate,
          hydratedOrder
        );
      })
    );
    const zippableFiles: ZippableFile[] = picklistData.map((picklist) => ({
      path: picklist.tempFilePath,
      name: picklist.orderCode + '.pdf',
    }));
    const zipFile = await zipFiles(zippableFiles);
    const stream = createReadStream(zipFile);
    stream.on('finish', () => safeRemoveFile(zipFile));
    return stream;
  }

  /**
   * Just generates PDF, no storing in DB
   */
  async generatePicklist(
    ctx: RequestContext,
    templateString: string,
    order: Order
  ): Promise<{ tempFilePath: string; orderCode: string }> {
    const pdf = require('pdf-creator-node');
    const data = await this.pluginInitOptions.loadDataFn!(
      ctx,
      new Injector(this.moduleRef),
      order
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
    return { tempFilePath: tmpFilePath, orderCode: order.code };
  }

  /**
   * Generates an picklist for the latest placed order and the given template
   */
  async previewPicklistWithTemplate(
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
      // Refetch needed for relations to work
      order = await this.orderService.findOne(ctx, orderId);
    }
    if (!order) {
      throw new UserInputError(`No order found with code ${orderCode}`);
    }
    const config = await this.getConfig(ctx);
    if (!config) {
      throw Error(`No config found for channel ${ctx.channel.token}`);
    }
    const { tempFilePath } = await this.generatePicklist(ctx, template, order);
    const stream = createReadStream(tempFilePath);
    stream.on('finish', () => safeRemoveFile(tempFilePath));
    return stream;
  }
}
