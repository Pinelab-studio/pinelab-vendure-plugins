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
  ListQueryOptions,
  Injector,
  JobQueue,
  JobQueueService,
  ListQueryBuilder,
  Logger,
  Order,
  OrderPlacedEvent,
  OrderService,
  OrderStateTransitionEvent,
  PaginatedList,
  RequestContext,
  TransactionalConnection,
  UserInputError,
  EntityRelationPaths,
  idsAreEqual,
} from '@vendure/core';
import {
  Invoice,
  InvoiceConfigInput,
  InvoiceListFilter,
  InvoiceListOptions,
} from '../ui/generated/graphql';
import { ModuleRef } from '@nestjs/core';
import { Response } from 'express';
import { createReadStream, ReadStream } from 'fs';
import Handlebars from 'handlebars';
// @ts-ignore
import * as pdf from 'pdf-creator-node';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { InvoiceConfigEntity } from '../entities/invoice-config.entity';
import { InvoiceEntity, InvoiceOrderTotals } from '../entities/invoice.entity';
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
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
  SortOrder,
  LogicalOperator,
} from '@vendure/common/lib/generated-shop-types';

import { In, Brackets } from 'typeorm';
import { filter } from 'rxjs';

import { parseFilterParams } from '@vendure/core/dist/service/helpers/list-query-builder/parse-filter-params';

interface DownloadInput {
  customerEmail: string;
  orderCode: string;
  invoiceNumber: string | number | undefined;
  res: Response;
}

@Injectable()
export class InvoiceService implements OnModuleInit, OnApplicationBootstrap {
  jobQueue:
    | JobQueue<{
        channelToken: string;
        orderCode: string;
        creditInvoiceOnly: boolean;
      }>
    | undefined;
  retries = 10;
  orderRelations: EntityRelationPaths<Order>[] = [
    'lines.productVariant.product',
    'shippingLines.shippingMethod',
    'payments',
    'customer',
  ];

  constructor(
    private eventBus: EventBus,
    private jobService: JobQueueService,
    private orderService: OrderService,
    private channelService: ChannelService,
    private listQueryBuilder: ListQueryBuilder,
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
      process: async (job) => {
        await this.createInvoicesForOrder(
          job.data.channelToken,
          job.data.orderCode,
          job.data.creditInvoiceOnly
        ).catch(async (error) => {
          Logger.warn(
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
    this.eventBus.ofType(OrderPlacedEvent).subscribe(async ({ ctx, order }) => {
      this.createInvoiceGenerationJobs(ctx, order.code, 'order-placed');
    });
    this.eventBus
      .ofType(OrderStateTransitionEvent)
      .pipe(filter((event) => event.toState === 'Cancelled'))
      .subscribe(async ({ ctx, order }) => {
        await this.createInvoiceGenerationJobs(
          ctx,
          order.code,
          'order-cancelled'
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
    if (!this.jobQueue) {
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
      await this.jobQueue.add(
        {
          channelToken: ctx.channel.token,
          orderCode: orderCode,
          creditInvoiceOnly,
        },
        { retries: this.retries }
      );
      return Logger.info(
        `Added invoice job to queue for order ${orderCode}`,
        loggerCtx
      );
    } catch (error) {
      Logger.error(
        `Failed to add invoice job to queue: ${(error as any)?.message}`,
        loggerCtx
      );
    }
  }

  async findAll(
    ctx: RequestContext,
    options?: InvoiceListOptions
  ): Promise<PaginatedList<Invoice>> {
    const entityOptions: ListQueryOptions<InvoiceEntity> = {
      ...options,
      ...(options?.filter?.invoiceNumber
        ? { filter: { invoiceNumber: options?.filter?.invoiceNumber } }
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
      const filter = parseFilterParams(
        qb.connection,
        Order,
        { code: { ...options?.filter?.orderCode } },
        undefined,
        'order'
      );
      const condition = filter[0];
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
    for (let invoice of invoices) {
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
        invoiceNumber: filter?.invoiceNumber,
      };
    }
    if (filter?.orderCode) {
      filterInput = {
        ...filterInput,
        order: {
          code: filter?.orderCode,
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
        `No invoices found for channel ${ctx.channelId} and invoiceNumbers ${invoiceNumbers}`
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
    let [order, previousInvoiceForOrder, config] = await Promise.all([
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
    } else {
      Logger.info(
        `Creating invoice (and possibly credit invoice) for order ${orderCode}`,
        loggerCtx
      );
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
        this.eventBus.publish(
          new InvoiceCreatedEvent(
            ctx,
            order,
            creditInvoice,
            previousInvoiceForOrder
          )
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
   * Create an invoice and save it's reference on an order in the database.
   * Passing a `previousInvoice` will generate a credit invoice.
   */
  private async createAndSaveInvoice(
    ctx: RequestContext,
    order: Order,
    templatString: string,
    previousInvoice?: InvoiceEntity
  ): Promise<InvoiceEntity> {
    const isCreditInvoice = !!previousInvoice; // If previous invoice, this is a credit invoice
    let orderTotals = {
      taxSummaries: order.taxSummary,
      total: order.total,
      totalWithTax: order.totalWithTax,
    };
    if (isCreditInvoice) {
      orderTotals = reverseOrderTotals(previousInvoice.orderTotals);
    }
    const { invoiceNumber, invoiceTmpFile } = await this.generatePdfFile(
      ctx,
      templatString,
      order,
      // Pass reverse order totals and previous invoice if we are creating a credit invoice
      previousInvoice
        ? {
            previousInvoice,
            reversedOrderTotals: orderTotals,
          }
        : undefined
    );

    // First create row in the DB, then save the file, then save the storageReference in the created row
    const invoiceRowId = await this.createInvoiceRow(ctx, {
      invoiceNumber,
      orderId: order.id as string,
      isCreditInvoice,
      orderTotals,
    });
    const storageReference = await this.config.storageStrategy.save(
      invoiceTmpFile,
      invoiceNumber,
      ctx.channel.token,
      isCreditInvoice
    );
    return await this.saveStorageReference(ctx, invoiceRowId, storageReference);
  }

  /**
   * Just generates PDF, doesn't store or save anything
   */
  async generatePdfFile(
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
      latestInvoiceNumber ?? this.config.startInvoiceNumber,
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
    try {
      await pdf.create(document, options);
    } catch (e: any) {
      // Warning, because this will be retried, or is returned to the user
      Logger.warn(`Failed to generate invoice: ${e?.message}`, loggerCtx);
      throw e;
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
      where: { channelId: String(ctx!.channelId) },
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

  throwIfInvalidLicense(): void {
    if (this.config.hasValidLicense) {
      return;
    }
    const message = `Invalid license key. Viewing invoices is disabled. Invoice generation will continue as usual.`;
    Logger.error(message, loggerCtx);
    if (process.env.NODE_ENV === 'test') {
      // Only log in test, don't throw
      return;
    }
    throw Error(message);
  }

  /**
   * Creates a new invoice row in the database, so we can be sure that we have reserved the given invoiceNumber.
   */
  private async createInvoiceRow(
    ctx: RequestContext,
    invoice: Omit<
      InvoiceEntity,
      'id' | 'channelId' | 'createdAt' | 'updatedAt' | 'storageReference'
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

  /**
   * Save storage reference on the invoice entity in the DB
   */
  private async saveStorageReference(
    ctx: RequestContext,
    id: ID,
    storageReference: string
  ): Promise<InvoiceEntity> {
    const invoiceRepo = this.connection.getRepository(ctx, InvoiceEntity);
    await invoiceRepo.update(id, { storageReference });
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
