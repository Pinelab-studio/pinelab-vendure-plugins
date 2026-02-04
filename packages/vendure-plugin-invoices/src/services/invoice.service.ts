import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  ChannelService,
  EntityRelationPaths,
  EventBus,
  ID,
  idsAreEqual,
  Injector,
  JobQueue,
  JobQueueService,
  ListQueryBuilder,
  ListQueryOptions,
  Logger,
  Order,
  OrderPlacedEvent,
  OrderService,
  OrderStateTransitionEvent,
  PaginatedList,
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import { Response } from 'express';
import { createReadStream, ReadStream } from 'fs';
import Handlebars from 'handlebars';
import {
  Invoice,
  InvoiceConfigInput,
  InvoiceListFilter,
  InvoiceListOptions,
  InvoiceOrderTotals,
} from '../ui/generated/graphql';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {
  LogicalOperator,
  SortOrder,
} from '@vendure/common/lib/generated-shop-types';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { InvoiceConfigEntity } from '../entities/invoice-config.entity';
import { InvoiceEntity } from '../entities/invoice.entity';
import { InvoicePluginConfig } from '../invoice.plugin';
import { CreditInvoiceInput } from '../strategies/load-data-fn';
import {
  LocalStorageStrategy,
  RemoteStorageStrategy,
} from '../strategies/storage/storage-strategy';
import { defaultTemplate } from '../util/default-template';
import { createTempFile } from '../util/file.util';
import { reverseOrderTotals } from '../util/order-calculations';
import { InvoiceCreatedEvent } from './invoice-created-event';
import puppeteer from 'puppeteer';
import { Browser } from 'puppeteer';

import { filter } from 'rxjs';
import { In } from 'typeorm';

import {
  parseFilterParams,
  WhereCondition,
} from '@vendure/core/dist/service/helpers/list-query-builder/parse-filter-params';
import { AccountingService } from './accounting.service';
import util from 'util';

interface DownloadInput {
  customerEmail: string;
  orderCode: string;
  invoiceNumber: string | number | undefined;
  res: Response;
}

@Injectable()
export class InvoiceService implements OnModuleInit, OnApplicationBootstrap {
  /**
   * JobQueue for generating invoices
   */
  generateInvoiceQueue!: JobQueue<{
    channelToken: string;
    orderCode: string;
    creditInvoiceOnly: boolean;
  }>;

  orderRelations: EntityRelationPaths<Order>[] = [
    'lines.productVariant.product',
    'shippingLines.shippingMethod',
    'payments',
    'surcharges',
    'customer',
  ];

  constructor(
    private eventBus: EventBus,
    private jobQueueService: JobQueueService,
    private orderService: OrderService,
    private channelService: ChannelService,
    private listQueryBuilder: ListQueryBuilder,
    private moduleRef: ModuleRef,
    private connection: TransactionalConnection,
    private accountingService: AccountingService,
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
    // Init Invoice job queue
    this.generateInvoiceQueue = await this.jobQueueService.createQueue({
      name: 'generate-invoice',
      process: async (job) => {
        await this.createInvoicesForOrder(
          job.data.channelToken,
          job.data.orderCode,
          job.data.creditInvoiceOnly
        ).catch((error) => {
          Logger.warn(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            `Failed to generate invoice for ${job.data.orderCode}: ${error?.message}`,
            loggerCtx
          );
          throw error;
        });
      },
    });
  }

  /**
   * Listen for OrderPlacedEvents. When an event occures, place generate-invoice job in queue
   */
  onApplicationBootstrap(): void {
    this.eventBus.ofType(OrderPlacedEvent).subscribe(({ ctx, order }) => {
      this.createInvoiceGenerationJobs(ctx, order.code, 'order-placed').catch(
        (e: Error) =>
          Logger.error(
            `Failed to create invoice jobs for 'order-placed': ${e?.message}`,
            loggerCtx,
            JSON.stringify(e)
          )
      );
    });
    this.eventBus
      .ofType(OrderStateTransitionEvent)
      .pipe(filter((event) => event.toState === 'Cancelled'))
      .subscribe(({ ctx, order }) => {
        if (!order.orderPlacedAt) {
          // Non-placed orders don't have invoices
          return;
        }
        this.createInvoiceGenerationJobs(
          ctx,
          order.code,
          'order-cancelled'
        ).catch((e: Error) =>
          Logger.error(
            `Failed to create invoice jobs for 'order-cancelled': ${e?.message}`,
            loggerCtx,
            JSON.stringify(e)
          )
        );
      });
  }

  async findAll(
    ctx: RequestContext,
    options?: InvoiceListOptions
  ): Promise<PaginatedList<Invoice>> {
    const entityOptions: ListQueryOptions<InvoiceEntity> = {
      ...options,
      ...(options?.filter?.invoiceNumber
        ? // eslint-disable-next-line  @typescript-eslint/no-unsafe-assignment
          { filter: { invoiceNumber: options?.filter?.invoiceNumber } }
        : { filter: {} }),
      sort: { updatedAt: SortOrder.DESC },
    };
    const qb = this.listQueryBuilder.build(InvoiceEntity, entityOptions, {
      ctx,
      where: {
        channelId: ctx.channelId.toString(),
      },
      entityAlias: 'invoice',
    });
    if (options?.filter?.orderCode) {
      // Order join needed for order code filtering
      qb.innerJoin(Order, 'order', 'order.id = invoice.orderId');
      qb.addSelect(['order.id', 'order.code']);
      const filter = parseFilterParams<Order>({
        connection: qb.connection,
        entity: Order,
        filterParams: { code: { ...options?.filter?.orderCode } },
        customPropertyMap: undefined,
        originalCustomPropertyMap: undefined,
        entityAlias: 'order',
      });
      const condition = filter[0] as WhereCondition;
      //since the call to parseFilterParams returns arg params starting from arg1, we need to replace it with a 'unique' argX
      //so that it doesn't conflict by the param args generated by the above this.listQueryBuilder.build call
      condition.clause = condition.clause.replace('arg1', 'argX');
      const parameters = { argX: condition.parameters['arg1'] };
      if (options.filterOperator === LogicalOperator.AND) {
        qb.andWhere(condition.clause, parameters);
      } else {
        qb.orWhere(condition.clause, parameters);
      }
    }
    const [invoices, totalItems] = await qb.getManyAndCount();
    // We now fetch the orders + customers for the results in a separate query.
    // We do this because we wan't to avoid getRawMany and the performance hit it brings
    const orderIds = invoices.map((i) => i.orderId);
    const orders = await this.orderService.findAll(
      ctx,
      { filter: { id: { in: orderIds } } },
      ['customer']
    );
    const items: Invoice[] = [];
    for (const invoice of invoices) {
      const order = orders.items.find((o) =>
        idsAreEqual(o.id, invoice.orderId)
      );
      if (!order) {
        Logger.error(
          `No order with id '${invoice.orderId}' found for invoice '${invoice.invoiceNumber}'. Omitting this invoice from the results`,
          loggerCtx
        );
        continue;
      }
      if (!order.customer?.emailAddress) {
        Logger.error(
          `Order '${order.id}' for invoice '${invoice.invoiceNumber}' has no customer. Omitting this invoice from the results`,
          loggerCtx
        );
        continue;
      }

      items.push({
        ...invoice,
        orderCode: order.code,
        orderId: order.id,
        isCreditInvoice: invoice.isCreditInvoice,
        downloadUrl: this.getDownloadUrl(
          ctx,
          invoice.invoiceNumber,
          order.code,
          order.customer.emailAddress
        ),
      });
    }
    return { items, totalItems };
  }

  parseFilter(filter: InvoiceListFilter | undefined) {
    let filterInput = {};
    if (filter?.invoiceNumber) {
      filterInput = {
        invoiceNumber: String(filter?.invoiceNumber),
      };
    }
    if (filter?.orderCode) {
      filterInput = {
        ...filterInput,
        order: {
          code: String(filter?.orderCode),
        },
      };
    }
    return filterInput;
  }

  async downloadMultiple(
    ctx: RequestContext,
    invoiceNumbers: string[],
    res: Response
  ): Promise<ReadStream> {
    if (invoiceNumbers.length > 10) {
      // For performance reasons
      throw new UserInputError(`You can only download 10 invoices at a time`);
    }
    const invoiceRepo = this.connection.getRepository(ctx, InvoiceEntity);
    const invoices = await invoiceRepo.find({
      where: {
        channelId: String(ctx.channelId),
        invoiceNumber: In(invoiceNumbers),
      },
    });
    if (!invoices) {
      throw Error(
        `No invoices found for channel ${
          ctx.channelId
        } and invoiceNumbers ${JSON.stringify(invoiceNumbers)}`
      );
    }
    return this.config.storageStrategy.streamMultiple(invoices, res);
  }

  /**
   * Creates an invoice and credit invoice (if enabled) for the given order
   * This will also generate a credit invoice if a previous invoice is available and credit invoices are enabled.
   * Specifying `createCreditInvoiceOnly` will only generate a credit invoice and no new debit invoice.
   */
  async createInvoicesForOrder(
    channelToken: string,
    orderCode: string,
    createCreditInvoiceOnly: boolean
  ): Promise<InvoiceEntity | undefined> {
    const ctx = await this.createCtx(channelToken);
    const [order, previousInvoiceForOrder, config] = await Promise.all([
      this.orderService.findOneByCode(ctx, orderCode, this.orderRelations),
      this.getMostRecentInvoiceForOrder(ctx, orderCode),
      this.getConfig(ctx),
    ]);
    if (!config) {
      Logger.warn(
        `Cannot generate invoice for ${orderCode}, because no config was found`,
        loggerCtx
      );
      return;
    }
    if (!config.enabled) {
      Logger.info(
        `Not generating invoice for ${orderCode} for channel ${channelToken}, because invoice generation is disabled in the config.`,
        loggerCtx
      );
      return;
    }
    if (!order) {
      throw new UserInputError(`No order found with code ${orderCode}`);
    }
    if (createCreditInvoiceOnly && !config?.createCreditInvoices) {
      Logger.info(
        `Cannot generate credit invoice only with "createCreditInvoiceOnly=true" for order ${orderCode}, because credit invoices are disabled in the config.`,
        loggerCtx
      );
      return;
    }
    if (createCreditInvoiceOnly && !previousInvoiceForOrder) {
      Logger.info(
        `"createCreditInvoiceOnly=true" was supplied, but no previous invoice exists for order ${orderCode}, so we can not generate a credit invoice.`,
        loggerCtx
      );
      return;
    }
    if (createCreditInvoiceOnly) {
      Logger.info(
        `Creating credit invoice only for order ${orderCode}`,
        loggerCtx
      );
    } else if (previousInvoiceForOrder && config.createCreditInvoices) {
      Logger.info(
        `Creating invoice and credit invoice for order ${orderCode}`,
        loggerCtx
      );
    } else {
      Logger.info(`Creating invoice for order ${orderCode}`, loggerCtx);
    }
    let creditInvoice: InvoiceEntity | undefined;
    if (previousInvoiceForOrder && config.createCreditInvoices) {
      // Create a credit invoice first
      creditInvoice = await this.createAndSaveInvoice(
        ctx,
        order,
        config.templateString!,
        previousInvoiceForOrder
      );
      if (createCreditInvoiceOnly) {
        // Don't generate normal invoice, so we emit an event now and return
        await this.eventBus.publish(
          new InvoiceCreatedEvent({
            ctx,
            order,
            newInvoice: creditInvoice,
            previousInvoice: previousInvoiceForOrder,
          })
        );
        await this.createAccountingExportJob(
          ctx,
          creditInvoice.invoiceNumber,
          orderCode
        );
        return creditInvoice;
      }
    }
    // Generate normal/debit invoice
    const newInvoice = await this.createAndSaveInvoice(
      ctx,
      order,
      config.templateString!
    );
    await this.eventBus.publish(
      new InvoiceCreatedEvent({
        ctx,
        order,
        newInvoice,
        previousInvoice: previousInvoiceForOrder,
        creditInvoice,
      })
    );
    if (creditInvoice) {
      // Create a job to export the credit invoice to the accounting system first
      await this.createAccountingExportJob(
        ctx,
        creditInvoice.invoiceNumber,
        orderCode
      );
    }
    await this.createAccountingExportJob(
      ctx,
      newInvoice.invoiceNumber,
      orderCode
    );
    return newInvoice;
  }

  /**
   * Create accounting export jobs without throwing, to prevent retries of the JobQueue
   */
  private async createAccountingExportJob(
    ctx: RequestContext,
    invoiceNumber: number,
    orderCode: string
  ) {
    await this.accountingService
      .createAccountingExportJob(ctx, invoiceNumber, orderCode)
      .catch((e) => {
        Logger.error(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `Failed to create accounting export job: ${e?.message}`,
          loggerCtx,
          util.inspect(e, false, 5)
        );
      });
  }

  /**
   * Create jobs to generate invoices for orders
   */
  private async createInvoiceGenerationJobs(
    ctx: RequestContext,
    orderCode: string,
    event: 'order-cancelled' | 'order-placed'
  ) {
    if (!this.generateInvoiceQueue) {
      return Logger.error(`Invoice jobQueue not initialized`, loggerCtx);
    }
    try {
      const enabled = await this.isInvoicePluginEnabled(ctx);
      if (!enabled) {
        return Logger.debug(
          `Invoice generation not enabled for order ${orderCode} in channel ${ctx.channel.token}`,
          loggerCtx
        );
      }
      const creditInvoiceOnly = event === 'order-cancelled'; // Only create credit invoice when an order is cancelled
      await this.generateInvoiceQueue.add(
        {
          channelToken: ctx.channel.token,
          orderCode: orderCode,
          creditInvoiceOnly,
        },
        { retries: 10 }
      );
      return Logger.info(
        `Added invoice job to queue for order ${orderCode}`,
        loggerCtx
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      Logger.error(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Failed to add invoice job to queue: ${error?.message}`,
        loggerCtx
      );
    }
  }

  /**
   * Create an invoice and save it's reference on an order in the database.
   * Passing a `previousInvoice` will generate a credit invoice.
   */
  private async createAndSaveInvoice(
    ctx: RequestContext,
    order: Order,
    templateString: string,
    isCreditInvoiceFor?: InvoiceEntity
  ): Promise<InvoiceEntity> {
    let orderTotals: InvoiceOrderTotals = {
      taxSummaries: order.taxSummary.map((t) => ({
        description: t.description,
        taxRate: t.taxRate,
        taxBase: t.taxBase,
        taxTotal: t.taxTotal,
      })),
      total: order.total,
      totalWithTax: order.totalWithTax,
    };
    if (isCreditInvoiceFor) {
      orderTotals = reverseOrderTotals(isCreditInvoiceFor.orderTotals);
    }
    const { invoiceNumber, invoiceTmpFile } = await this.generatePdfFile(
      ctx,
      templateString,
      order,
      // Pass reverse order totals and previous invoice if we are creating a credit invoice
      isCreditInvoiceFor
        ? {
            previousInvoice: isCreditInvoiceFor,
            reversedOrderTotals: orderTotals,
          }
        : undefined
    );

    // First create row in the DB, then save the file, then save the storageReference in the created row
    const invoiceRowId = await this.createInvoiceRow(ctx, {
      invoiceNumber,
      orderId: order.id as string,
      isCreditInvoice: !!isCreditInvoiceFor,
      orderTotals,
      isCreditInvoiceFor,
    });
    const storageReference = await this.config.storageStrategy.save(
      invoiceTmpFile,
      invoiceNumber,
      ctx.channel.token,
      !!isCreditInvoiceFor
    );
    // Save storage reference on the invoice row
    const invoiceRepo = this.connection.getRepository(ctx, InvoiceEntity);
    await invoiceRepo.update(invoiceRowId, { storageReference });
    Logger.info(
      `Created ${
        isCreditInvoiceFor ? 'credit ' : ' '
      }invoice ${invoiceNumber} for order ${order.code}`,
      loggerCtx
    );
    return await invoiceRepo.findOneOrFail({ where: { id: invoiceRowId } });
  }

  /**
   * Just generates PDF, doesn't store or save anything
   */
  async generatePdfFile(
    ctx: RequestContext,
    htmlTemplateString: string,
    order: Order,
    shouldGenerateCreditInvoice?: CreditInvoiceInput
  ): Promise<{ invoiceTmpFile: string; invoiceNumber: number }> {
    const latestInvoiceNumber = await this.getLatestInvoiceNumber(ctx);
    const data = await this.config.loadDataFn(
      ctx,
      new Injector(this.moduleRef),
      order,
      latestInvoiceNumber ?? this.config.startInvoiceNumber,
      shouldGenerateCreditInvoice
    );
    const tmpFilePath = await createTempFile('.pdf');
    let browser: Browser | undefined;
    try {
      const compiledHtml = Handlebars.compile(htmlTemplateString)(data);
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
    orderCode?: string
  ): Promise<ReadStream> {
    let order: Order | undefined;
    if (orderCode) {
      order = await this.orderService.findOneByCode(
        ctx,
        orderCode,
        this.orderRelations
      );
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
      order = await this.orderService.findOne(
        ctx,
        orderId,
        this.orderRelations
      );
    }
    if (!order) {
      throw new UserInputError(`No order found with code ${orderCode}`);
    }
    const config = await this.getConfig(ctx);
    if (!config) {
      throw Error(`No config found for channel ${ctx.channel.token}`);
    }
    const { invoiceTmpFile } = await this.generatePdfFile(ctx, template, order);
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
      order: { invoiceNumber: 'DESC' },
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
    invoiceNumber: number,
    orderCode: string,
    customerEmail: string
  ): string {
    const emailAddress = encodeURIComponent(customerEmail);
    return `${this.config.vendureHost}/invoices/${ctx.channel.token}/${orderCode}/${invoiceNumber}?email=${emailAddress}`;
  }

  async upsertConfig(
    ctx: RequestContext,
    input: InvoiceConfigInput
  ): Promise<InvoiceConfigEntity> {
    const configRepo = this.connection.getRepository(ctx, InvoiceConfigEntity);
    const existing = await configRepo.findOne({
      where: { channelId: String(ctx.channelId) },
    });
    if (existing) {
      await configRepo.update(
        existing.id,
        input as QueryDeepPartialEntity<InvoiceConfigEntity>
      );
    } else {
      await configRepo.insert({
        ...input,
        channelId: String(ctx.channelId),
      } as QueryDeepPartialEntity<InvoiceConfigEntity>);
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

  /**
   * Creates a new invoice row in the database, so we can be sure that we have reserved the given invoiceNumber.
   */
  private async createInvoiceRow(
    ctx: RequestContext,
    invoice: Omit<
      InvoiceEntity,
      | 'id'
      | 'channelId'
      | 'createdAt'
      | 'updatedAt'
      | 'storageReference'
      | 'accountingReference'
    >
  ): Promise<ID> {
    const invoiceRepo = this.connection.getRepository(ctx, InvoiceEntity);
    const entity = await invoiceRepo.save({
      ...invoice,
      channelId: ctx.channelId as string,
      storageReference: '', // This will be updated when the invoice is saved
    });
    return entity.id;
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
