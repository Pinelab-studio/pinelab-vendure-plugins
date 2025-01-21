import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { SortOrder } from '@vendure/common/lib/generated-shop-types';
import {
  ID,
  Injector,
  Order,
  OrderService,
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import { createReadStream, ReadStream } from 'fs';
import Handlebars from 'handlebars';
import { PLUGIN_INIT_OPTIONS } from '../constants';
import { PDFTemplatePluginOptions } from '../pdf-template-plugin';
import { PdfTemplateInput } from '../ui/generated/graphql';
import {
  createTempFile,
  safeRemoveFile,
  zipFiles,
  ZippableFile,
} from './file.util';
import { PDFTemplateEntity } from './pdf-template.entity';

@Injectable()
export class PDFTemplateService {
  constructor(
    private readonly connection: TransactionalConnection,
    private readonly orderService: OrderService,
    private moduleRef: ModuleRef,
    @Inject(PLUGIN_INIT_OPTIONS)
    private pluginInitOptions: PDFTemplatePluginOptions
  ) {
    Handlebars.registerHelper('formatMoney', (amount?: number) => {
      if (amount == null) {
        return amount;
      }
      return (amount / 100).toFixed(2);
    });
  }

  async updateTemplate(
    ctx: RequestContext,
    id: ID,
    input: PdfTemplateInput
  ): Promise<PDFTemplateEntity> {
    const repository = this.connection.getRepository(ctx, PDFTemplateEntity);
    const existing = await repository.findOneOrFail({
      where: { channelId: ctx.channelId as string, id },
    });
    if (existing) {
      await repository.update(existing.id, {
        name: input.name,
        enabled: input.enabled,
        templateString: input.templateString,
      });
    }
    return await repository.findOneOrFail({
      where: { channelId: ctx.channelId as string, id },
    });
  }

  async createPDFTemplate(
    ctx: RequestContext,
    input: PdfTemplateInput
  ): Promise<PDFTemplateEntity> {
    const repository = this.connection.getRepository(ctx, PDFTemplateEntity);
    const existing = await repository.findOne({
      where: { channelId: ctx.channelId as string, name: input.name },
    });
    if (existing) {
      throw new UserInputError(
        `A PDF template with name '${input.name}' already exists`
      );
    }
    const result = await repository.save({
      name: input.name,
      enabled: input.enabled,
      templateString: input.templateString,
      channelId: ctx.channelId as string,
    });
    return await repository.findOneOrFail({
      where: { channelId: ctx.channelId as string, id: result.id },
    });
  }

  async deletePDFTemplate(
    ctx: RequestContext,
    id: ID
  ): Promise<PDFTemplateEntity[]> {
    const repository = this.connection.getRepository(ctx, PDFTemplateEntity);
    const existing = await repository.findOneOrFail({
      where: { channelId: ctx.channelId as string, id },
    });
    if (existing) {
      throw new UserInputError(`No PDF template with id '${id}' exists`);
    }
    const result = await repository.delete({ id });
    return await this.getTemplates(ctx);
  }

  async getTemplates(ctx: RequestContext): Promise<PDFTemplateEntity[]> {
    const repository = this.connection.getRepository(ctx, PDFTemplateEntity);
    return await repository.find({
      where: { channelId: ctx.channelId as string },
    });
  }

  async findTemplate(
    ctx: RequestContext,
    templateName: string
  ): Promise<PDFTemplateEntity | undefined | null> {
    const repository = this.connection.getRepository(ctx, PDFTemplateEntity);
    return await repository.findOne({
      where: { channelId: ctx.channelId as string, name: templateName },
    });
  }

  /**
   * Generates an picklist for the latest placed order and the given template
   */
  async downloadPDF(
    ctx: RequestContext,
    templateName: string,
    _order?: Order
  ): Promise<ReadStream> {
    let order = _order;
    if (!order) {
      order = await this.getLatestPlacedOrder(ctx);
    }
    const template = await this.findTemplate(ctx, templateName);
    if (!template) {
      throw Error(`No template found with name '${templateName}'`);
    }
    const { tempFilePath } = await this.generatePDF(
      ctx,
      template.templateString,
      order
    );
    const stream = createReadStream(tempFilePath);
    stream.on('finish', () => safeRemoveFile(tempFilePath));
    return stream;
  }

  async downloadMultiplePDFs(
    ctx: RequestContext,
    templateName: string,
    orders: Order[]
  ) {
    // This is currently done in main thread, so a max of 10 orders is allowed
    if (orders.length > 10) {
      throw new UserInputError(`Max 10 orders allowed`);
    }
    const template = await this.findTemplate(ctx, templateName);
    if (!template) {
      throw Error(`No template found with name '${templateName}'`);
    }
    const pdfData = await Promise.all(
      orders.map(async (order) => {
        const hydratedOrder = await this.orderService.findOne(ctx, order.id);
        if (!hydratedOrder) {
          throw new UserInputError(`No Order with code ${order.code} found`);
        }
        return await this.generatePDF(
          ctx,
          template.templateString,
          hydratedOrder
        );
      })
    );
    const zippableFiles: ZippableFile[] = pdfData.map((picklist) => ({
      path: picklist.tempFilePath,
      name: picklist.orderCode + '.pdf',
    }));
    const zipFile = await zipFiles(zippableFiles);
    const stream = createReadStream(zipFile);
    stream.on('finish', () => safeRemoveFile(zipFile));
    return stream;
  }

  /**
   * Generate a PDF based on the given template string and order
   */
  async generatePDF(
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

  private async getLatestPlacedOrder(ctx: RequestContext): Promise<Order> {
    const orderId = (
      await this.orderService.findAll(
        ctx,
        {
          take: 1,
          filter: {
            orderPlacedAt: { isNull: false },
          },
          sort: { createdAt: SortOrder.DESC },
        },
        []
      )
    )?.items?.[0]?.id;
    // Refetch needed for relations to work
    const order = await this.orderService.findOne(ctx, orderId);
    if (!order) {
      throw new UserInputError(`No latest placed order found`);
    }
    return order;
  }
}
