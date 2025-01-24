import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { SortOrder } from '@vendure/common/lib/generated-shop-types';
import {
  ID,
  Injector,
  Logger,
  Order,
  OrderService,
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import { createReadStream, ReadStream } from 'fs';
import Handlebars from 'handlebars';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { PDFTemplatePluginOptions } from '../order-pdfs-plugin';
import { PdfTemplateInput } from '../ui/generated/graphql';
import {
  createTempFile,
  safeRemoveFile,
  zipFiles,
  ZippableFile,
} from './file.util';
import { PDFTemplateEntity } from './pdf-template.entity';
import puppeteer, { Browser } from 'puppeteer';

@Injectable()
export class OrderPDFsService {
  constructor(
    private readonly connection: TransactionalConnection,
    private readonly orderService: OrderService,
    private moduleRef: ModuleRef,
    @Inject(PLUGIN_INIT_OPTIONS)
    private options: PDFTemplatePluginOptions
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
        public: input.public,
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
      public: input.public,
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
    if (!existing) {
      throw new UserInputError(`No PDF template with id '${id}' exists`);
    }
    await repository.delete({ id });
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
    id: ID
  ): Promise<PDFTemplateEntity | undefined | null> {
    const repository = this.connection.getRepository(ctx, PDFTemplateEntity);
    return await repository.findOne({
      where: { channelId: ctx.channelId as string, id },
    });
  }

  /**
   * Generates an PDF for the latest placed order and the given template
   */
  async downloadPDF(
    ctx: RequestContext,
    templateId?: ID,
    templateString?: string,
    _order?: Order
  ): Promise<ReadStream> {
    let order = _order;
    if (!order) {
      order = await this.getLatestPlacedOrder(ctx);
    }
    if (!templateString && !templateId) {
      throw new UserInputError(
        `Need a template ID or template string to render PDF`
      );
    }
    if (!templateString) {
      const template = await this.findTemplate(ctx, templateId!);
      if (!template) {
        throw Error(`No template found with id '${templateId}'`);
      }
      templateString = template.templateString;
    }
    const { tempFilePath } = await this.generatePDF(ctx, templateString, order);
    const stream = createReadStream(tempFilePath);
    stream.on('finish', () => safeRemoveFile(tempFilePath));
    return stream;
  }

  async downloadMultiplePDFs(
    ctx: RequestContext,
    templateId: ID,
    orders: Order[]
  ) {
    // This is currently done in main thread, so a max of 10 orders is allowed
    if (orders.length > 10) {
      throw new UserInputError(`Max 10 orders allowed`);
    }
    const template = await this.findTemplate(ctx, templateId);
    if (!template) {
      throw Error(`No template found with name '${templateId}'`);
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
    const zippableFiles: ZippableFile[] = pdfData.map((pdf) => ({
      path: pdf.tempFilePath,
      name: pdf.orderCode + '.pdf',
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
    const data = await this.options.loadDataFn!(
      ctx,
      new Injector(this.moduleRef),
      order
    );
    const tmpFilePath = await createTempFile('.pdf');
    let browser: Browser | undefined;
    try {
      const compiledHtml = Handlebars.compile(templateString)(data);
      browser = await puppeteer.launch({
        headless: true,
        // We are not using puppeteer to fetch any external resources, so we dont care about the security concerns here
        args: ['--no-sandbox'],
      });
      const page = await browser.newPage();
      await page.setContent(compiledHtml);
      await page.pdf({
        path: tmpFilePath,
        format: 'A4',
        margin: { bottom: 100, top: 100, left: 50, right: 50 },
      });
    } catch (e) {
      // Warning, because this will be retried, or is returned to the user
      Logger.warn(
        `Failed to generate invoice: ${JSON.stringify((e as Error)?.message)}`,
        loggerCtx
      );
      throw e;
    } finally {
      if (browser) {
        // Prevent memory leaks
        browser.close().catch((e: Error) => {
          Logger.error(
            `Failed to close puppeteer browser: ${e?.message}`,
            loggerCtx
          );
        });
      }
    }
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
