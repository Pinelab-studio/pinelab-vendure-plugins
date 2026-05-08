'use strict';
var __decorate =
  (this && this.__decorate) ||
  function (decorators, target, key, desc) {
    var c = arguments.length,
      r =
        c < 3
          ? target
          : desc === null
          ? (desc = Object.getOwnPropertyDescriptor(target, key))
          : desc,
      d;
    if (typeof Reflect === 'object' && typeof Reflect.decorate === 'function')
      r = Reflect.decorate(decorators, target, key, desc);
    else
      for (var i = decorators.length - 1; i >= 0; i--)
        if ((d = decorators[i]))
          r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
  };
var __metadata =
  (this && this.__metadata) ||
  function (k, v) {
    if (typeof Reflect === 'object' && typeof Reflect.metadata === 'function')
      return Reflect.metadata(k, v);
  };
var __param =
  (this && this.__param) ||
  function (paramIndex, decorator) {
    return function (target, key) {
      decorator(target, key, paramIndex);
    };
  };
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
var _a, _b, _c, _d, _e, _f, _g, _h, _j;
Object.defineProperty(exports, '__esModule', { value: true });
exports.InvoiceService = void 0;
const common_1 = require('@nestjs/common');
const core_1 = require('@nestjs/core');
const generated_shop_types_1 = require('@vendure/common/lib/generated-shop-types');
const core_2 = require('@vendure/core');
const fs_1 = require('fs');
const handlebars_1 = __importDefault(require('handlebars'));
const puppeteer_1 = __importDefault(require('puppeteer'));
const constants_1 = require('../constants');
const invoice_config_entity_1 = require('../entities/invoice-config.entity');
const invoice_entity_1 = require('../entities/invoice.entity');
const invoice_plugin_1 = require('../invoice.plugin');
const default_template_1 = require('../util/default-template');
const file_util_1 = require('../util/file.util');
const order_calculations_1 = require('../util/order-calculations');
const invoice_created_event_1 = require('./invoice-created-event');
const rxjs_1 = require('rxjs');
const typeorm_1 = require('typeorm');
const parse_filter_params_1 = require('@vendure/core/dist/service/helpers/list-query-builder/parse-filter-params');
const util_1 = __importDefault(require('util'));
const accounting_service_1 = require('./accounting.service');
let InvoiceService = class InvoiceService {
  constructor(
    eventBus,
    jobQueueService,
    orderService,
    channelService,
    listQueryBuilder,
    moduleRef,
    connection,
    accountingService,
    config
  ) {
    this.eventBus = eventBus;
    this.jobQueueService = jobQueueService;
    this.orderService = orderService;
    this.channelService = channelService;
    this.listQueryBuilder = listQueryBuilder;
    this.moduleRef = moduleRef;
    this.connection = connection;
    this.accountingService = accountingService;
    this.config = config;
    this.orderRelations = [
      'lines.productVariant.product',
      'shippingLines.shippingMethod',
      'payments',
      'surcharges',
      'customer',
    ];
    handlebars_1.default.registerHelper('formatMoney', (amount) => {
      if (amount == null) {
        return amount;
      }
      return (amount / 100).toFixed(2);
    });
  }
  async onModuleInit() {
    // Init Invoice job queue
    this.generateInvoiceQueue = await this.jobQueueService.createQueue({
      name: 'generate-invoice',
      process: async (job) => {
        await this.createInvoicesForOrder(
          job.data.channelToken,
          job.data.orderCode,
          job.data.creditInvoiceOnly
        ).catch((error) => {
          core_2.Logger.warn(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            `Failed to generate invoice for ${job.data.orderCode}: ${error?.message}`,
            constants_1.loggerCtx
          );
          throw error;
        });
      },
    });
  }
  /**
   * Listen for OrderPlacedEvents. When an event occures, place generate-invoice job in queue
   */
  onApplicationBootstrap() {
    this.eventBus
      .ofType(core_2.OrderPlacedEvent)
      .subscribe(({ ctx, order }) => {
        this.createInvoiceGenerationJobs(ctx, order.code, 'order-placed').catch(
          (e) =>
            core_2.Logger.error(
              `Failed to create invoice jobs for 'order-placed': ${e?.message}`,
              constants_1.loggerCtx,
              JSON.stringify(e)
            )
        );
      });
    this.eventBus
      .ofType(core_2.OrderStateTransitionEvent)
      .pipe((0, rxjs_1.filter)((event) => event.toState === 'Cancelled'))
      .subscribe(({ ctx, order }) => {
        if (!order.orderPlacedAt) {
          // Non-placed orders don't have invoices
          return;
        }
        this.createInvoiceGenerationJobs(
          ctx,
          order.code,
          'order-cancelled'
        ).catch((e) =>
          core_2.Logger.error(
            `Failed to create invoice jobs for 'order-cancelled': ${e?.message}`,
            constants_1.loggerCtx,
            JSON.stringify(e)
          )
        );
      });
  }
  async findAll(ctx, options) {
    const entityOptions = {
      ...options,
      ...(options?.filter?.invoiceNumber
        ? // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          { filter: { invoiceNumber: options?.filter?.invoiceNumber } }
        : // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          { filter: {} }),
      sort: { updatedAt: generated_shop_types_1.SortOrder.DESC },
    };
    const qb = this.listQueryBuilder.build(
      invoice_entity_1.InvoiceEntity,
      entityOptions,
      {
        ctx,
        where: {
          channelId: ctx.channelId.toString(),
        },
        entityAlias: 'invoice',
      }
    );
    if (options?.filter?.orderCode) {
      // Order join needed for order code filtering
      qb.innerJoin(core_2.Order, 'order', 'order.id = invoice.orderId');
      qb.addSelect(['order.id', 'order.code']);
      const filter = (0, parse_filter_params_1.parseFilterParams)({
        connection: qb.connection,
        entity: core_2.Order,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        filterParams: { code: { ...options?.filter?.orderCode } },
        customPropertyMap: undefined,
        originalCustomPropertyMap: undefined,
        entityAlias: 'order',
      });
      const condition = filter[0];
      //since the call to parseFilterParams returns arg params starting from arg1, we need to replace it with a 'unique' argX
      //so that it doesn't conflict by the param args generated by the above this.listQueryBuilder.build call
      condition.clause = condition.clause.replace('arg1', 'argX');
      const parameters = { argX: condition.parameters['arg1'] };
      if (
        options.filterOperator === generated_shop_types_1.LogicalOperator.AND
      ) {
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
    const items = [];
    for (const invoice of invoices) {
      const order = orders.items.find((o) =>
        (0, core_2.idsAreEqual)(o.id, invoice.orderId)
      );
      if (!order) {
        core_2.Logger.error(
          `No order with id '${invoice.orderId}' found for invoice '${invoice.invoiceNumber}'. Omitting this invoice from the results`,
          constants_1.loggerCtx
        );
        continue;
      }
      if (!order.customer?.emailAddress) {
        core_2.Logger.error(
          `Order '${order.id}' for invoice '${invoice.invoiceNumber}' has no customer. Omitting this invoice from the results`,
          constants_1.loggerCtx
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
  async downloadMultiple(ctx, invoiceNumbers, res) {
    if (invoiceNumbers.length > 10) {
      // For performance reasons
      throw new core_2.UserInputError(
        `You can only download 10 invoices at a time`
      );
    }
    const invoiceRepo = this.connection.getRepository(
      ctx,
      invoice_entity_1.InvoiceEntity
    );
    const invoices = await invoiceRepo.find({
      where: {
        channelId: String(ctx.channelId),
        invoiceNumber: (0, typeorm_1.In)(invoiceNumbers),
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
    channelToken,
    orderCode,
    createCreditInvoiceOnly
  ) {
    const ctx = await this.createCtx(channelToken);
    const [order, previousInvoiceForOrder, config] = await Promise.all([
      this.orderService.findOneByCode(ctx, orderCode, this.orderRelations),
      this.getMostRecentInvoiceForOrder(ctx, orderCode),
      this.getConfig(ctx),
    ]);
    if (!config) {
      core_2.Logger.warn(
        `Cannot generate invoice for ${orderCode}, because no config was found`,
        constants_1.loggerCtx
      );
      return;
    }
    if (!config.enabled) {
      core_2.Logger.info(
        `Not generating invoice for ${orderCode} for channel ${channelToken}, because invoice generation is disabled in the config.`,
        constants_1.loggerCtx
      );
      return;
    }
    if (!order) {
      throw new core_2.UserInputError(`No order found with code ${orderCode}`);
    }
    if (createCreditInvoiceOnly && !config?.createCreditInvoices) {
      core_2.Logger.info(
        `Cannot generate credit invoice only with "createCreditInvoiceOnly=true" for order ${orderCode}, because credit invoices are disabled in the config.`,
        constants_1.loggerCtx
      );
      return;
    }
    if (createCreditInvoiceOnly && !previousInvoiceForOrder) {
      core_2.Logger.info(
        `"createCreditInvoiceOnly=true" was supplied, but no previous invoice exists for order ${orderCode}, so we can not generate a credit invoice.`,
        constants_1.loggerCtx
      );
      return;
    }
    const shouldCreateCreditInvoiceOnly =
      createCreditInvoiceOnly && order.totalWithTax <= 0;
    if (createCreditInvoiceOnly && !shouldCreateCreditInvoiceOnly) {
      core_2.Logger.info(
        `Order ${orderCode} still has a remaining amount (${order.totalWithTax}). Creating credit invoice and new invoice instead of credit-only.`,
        constants_1.loggerCtx
      );
    } else if (shouldCreateCreditInvoiceOnly) {
      core_2.Logger.info(
        `Creating credit invoice only for order ${orderCode}`,
        constants_1.loggerCtx
      );
    } else if (previousInvoiceForOrder && config.createCreditInvoices) {
      core_2.Logger.info(
        `Creating invoice and credit invoice for order ${orderCode}`,
        constants_1.loggerCtx
      );
    } else {
      core_2.Logger.info(
        `Creating invoice for order ${orderCode}`,
        constants_1.loggerCtx
      );
    }
    let creditInvoice;
    if (previousInvoiceForOrder && config.createCreditInvoices) {
      // Create a credit invoice first
      creditInvoice = await this.createAndSaveInvoice(
        ctx,
        order,
        config.templateString,
        previousInvoiceForOrder
      );
      if (shouldCreateCreditInvoiceOnly) {
        // Don't generate normal invoice, so we emit an event now and return
        await this.eventBus.publish(
          new invoice_created_event_1.InvoiceCreatedEvent({
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
      config.templateString
    );
    await this.eventBus.publish(
      new invoice_created_event_1.InvoiceCreatedEvent({
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
  async createAccountingExportJob(ctx, invoiceNumber, orderCode) {
    await this.accountingService
      .createAccountingExportJob(ctx, invoiceNumber, orderCode)
      .catch((e) => {
        core_2.Logger.error(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `Failed to create accounting export job: ${e?.message}`,
          constants_1.loggerCtx,
          util_1.default.inspect(e, false, 5)
        );
      });
  }
  /**
   * Create jobs to generate invoices for orders
   */
  async createInvoiceGenerationJobs(ctx, orderCode, event) {
    if (!this.generateInvoiceQueue) {
      return core_2.Logger.error(
        `Invoice jobQueue not initialized`,
        constants_1.loggerCtx
      );
    }
    try {
      const enabled = await this.isInvoicePluginEnabled(ctx);
      if (!enabled) {
        return core_2.Logger.debug(
          `Invoice generation not enabled for order ${orderCode} in channel ${ctx.channel.token}`,
          constants_1.loggerCtx
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
      return core_2.Logger.info(
        `Added invoice job to queue for order ${orderCode}`,
        constants_1.loggerCtx
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error) {
      core_2.Logger.error(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Failed to add invoice job to queue: ${error?.message}`,
        constants_1.loggerCtx
      );
    }
  }
  /**
   * Create an invoice and save it's reference on an order in the database.
   * Passing a `previousInvoice` will generate a credit invoice.
   */
  async createAndSaveInvoice(ctx, order, templateString, isCreditInvoiceFor) {
    let orderTotals = {
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
      orderTotals = (0, order_calculations_1.reverseOrderTotals)(
        isCreditInvoiceFor.orderTotals
      );
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
      orderId: order.id,
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
    const invoiceRepo = this.connection.getRepository(
      ctx,
      invoice_entity_1.InvoiceEntity
    );
    await invoiceRepo.update(invoiceRowId, { storageReference });
    core_2.Logger.info(
      `Created ${
        isCreditInvoiceFor ? 'credit ' : ' '
      }invoice ${invoiceNumber} for order ${order.code}`,
      constants_1.loggerCtx
    );
    return await invoiceRepo.findOneOrFail({ where: { id: invoiceRowId } });
  }
  /**
   * Just generates PDF, doesn't store or save anything
   */
  async generatePdfFile(
    ctx,
    htmlTemplateString,
    order,
    shouldGenerateCreditInvoice
  ) {
    const latestInvoiceNumber = await this.getLatestInvoiceNumber(ctx);
    const data = await this.config.loadDataFn(
      ctx,
      new core_2.Injector(this.moduleRef),
      order,
      latestInvoiceNumber ?? this.config.startInvoiceNumber,
      shouldGenerateCreditInvoice
    );
    const tmpFilePath = await (0, file_util_1.createTempFile)('.pdf');
    let browser;
    try {
      const compiledHtml =
        handlebars_1.default.compile(htmlTemplateString)(data);
      browser = await puppeteer_1.default.launch({
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
      core_2.Logger.warn(
        `Failed to generate invoice: ${JSON.stringify(e?.message)}`,
        constants_1.loggerCtx
      );
      throw e;
    } finally {
      if (browser) {
        // Prevent memory leaks
        browser.close().catch((e) => {
          core_2.Logger.error(
            `Failed to close puppeteer browser: ${e?.message}`,
            constants_1.loggerCtx
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
  async previewInvoiceWithTemplate(ctx, template, orderCode) {
    let order;
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
            sort: { createdAt: generated_shop_types_1.SortOrder.DESC },
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
      throw new core_2.UserInputError(`No order found with code ${orderCode}`);
    }
    const config = await this.getConfig(ctx);
    if (!config) {
      throw Error(`No config found for channel ${ctx.channel.token}`);
    }
    const { invoiceTmpFile } = await this.generatePdfFile(ctx, template, order);
    return (0, fs_1.createReadStream)(invoiceTmpFile);
  }
  /**
   * Returns a redirect if a publicUrl is created
   * otherwise returns a ReadStream from the invoice
   */
  async downloadInvoice(ctx, input) {
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
        throw new core_2.UserInputError(
          `No invoice found with number ${input.invoiceNumber}`
        );
      }
      invoice = invoiceWithNumber;
    }
    const strategy = this.config.storageStrategy;
    if (strategy.getPublicUrl) {
      return await strategy.getPublicUrl(invoice);
    } else {
      return await strategy.streamFile(invoice, input.res);
    }
  }
  /**
   * Return all invoices for order, sorted by createdAt
   */
  async getInvoicesForOrder(ctx, orderId) {
    const invoiceRepo = this.connection.getRepository(
      ctx,
      invoice_entity_1.InvoiceEntity
    );
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
  async getMostRecentInvoiceForOrder(ctx, orderCode) {
    const order = await this.orderService.findOneByCode(ctx, orderCode);
    if (!order) {
      throw Error(`No order found with code ${orderCode}`);
    }
    const invoices = await this.getInvoicesForOrder(ctx, order.id);
    if (!invoices.length) {
      return undefined;
    }
    return invoices[0];
  }
  /**
   * Get last generated invoice number for this channel
   */
  async getLatestInvoiceNumber(ctx) {
    const invoiceRepo = this.connection.getRepository(
      ctx,
      invoice_entity_1.InvoiceEntity
    );
    const result = await invoiceRepo.findOne({
      where: [{ channelId: ctx.channelId }],
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
  getDownloadUrl(ctx, invoiceNumber, orderCode, customerEmail) {
    const emailAddress = encodeURIComponent(customerEmail);
    return `${this.config.vendureHost}/invoices/${ctx.channel.token}/${orderCode}/${invoiceNumber}?email=${emailAddress}`;
  }
  async upsertConfig(ctx, input) {
    const configRepo = this.connection.getRepository(
      ctx,
      invoice_config_entity_1.InvoiceConfigEntity
    );
    const existing = await configRepo.findOne({
      where: { channelId: String(ctx.channelId) },
    });
    if (existing) {
      await configRepo.update(existing.id, input);
    } else {
      await configRepo.insert({
        ...input,
        channelId: String(ctx.channelId),
      });
    }
    return configRepo.findOneOrFail({
      where: { channelId: String(ctx.channelId) },
    });
  }
  async getConfig(ctx) {
    const configRepo = this.connection.getRepository(
      ctx,
      invoice_config_entity_1.InvoiceConfigEntity
    );
    let config = await configRepo.findOne({
      where: { channelId: String(ctx.channelId) },
    });
    if (!config) {
      // Create disabled sample config
      config = await this.upsertConfig(ctx, {
        enabled: false,
        createCreditInvoices: true,
        templateString: default_template_1.defaultTemplate,
      });
    }
    // If no template saved, return the default template as suggestion
    if (!config.templateString || !config.templateString.trim()) {
      config.templateString = default_template_1.defaultTemplate;
    }
    return config;
  }
  async isInvoicePluginEnabled(ctx) {
    const configRepo = this.connection.getRepository(
      ctx,
      invoice_config_entity_1.InvoiceConfigEntity
    );
    const result = await configRepo.findOne({
      select: ['enabled'],
      where: { channelId: ctx.channelId },
    });
    return !!result?.enabled;
  }
  /**
   * Creates a new invoice row in the database, so we can be sure that we have reserved the given invoiceNumber.
   */
  async createInvoiceRow(ctx, invoice) {
    const invoiceRepo = this.connection.getRepository(
      ctx,
      invoice_entity_1.InvoiceEntity
    );
    const entity = await invoiceRepo.save({
      ...invoice,
      channelId: ctx.channelId,
      storageReference: '', // This will be updated when the invoice is saved
    });
    return entity.id;
  }
  async createCtx(channelToken) {
    const channel = await this.channelService.getChannelFromToken(channelToken);
    return new core_2.RequestContext({
      apiType: 'admin',
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
      channel,
    });
  }
};
exports.InvoiceService = InvoiceService;
exports.InvoiceService = InvoiceService = __decorate(
  [
    (0, common_1.Injectable)(),
    __param(8, (0, common_1.Inject)(constants_1.PLUGIN_INIT_OPTIONS)),
    __metadata('design:paramtypes', [
      typeof (_a =
        typeof core_2.EventBus !== 'undefined' && core_2.EventBus) ===
      'function'
        ? _a
        : Object,
      typeof (_b =
        typeof core_2.JobQueueService !== 'undefined' &&
        core_2.JobQueueService) === 'function'
        ? _b
        : Object,
      typeof (_c =
        typeof core_2.OrderService !== 'undefined' && core_2.OrderService) ===
      'function'
        ? _c
        : Object,
      typeof (_d =
        typeof core_2.ChannelService !== 'undefined' &&
        core_2.ChannelService) === 'function'
        ? _d
        : Object,
      typeof (_e =
        typeof core_2.ListQueryBuilder !== 'undefined' &&
        core_2.ListQueryBuilder) === 'function'
        ? _e
        : Object,
      typeof (_f =
        typeof core_1.ModuleRef !== 'undefined' && core_1.ModuleRef) ===
      'function'
        ? _f
        : Object,
      typeof (_g =
        typeof core_2.TransactionalConnection !== 'undefined' &&
        core_2.TransactionalConnection) === 'function'
        ? _g
        : Object,
      typeof (_h =
        typeof accounting_service_1.AccountingService !== 'undefined' &&
        accounting_service_1.AccountingService) === 'function'
        ? _h
        : Object,
      typeof (_j =
        typeof invoice_plugin_1.InvoicePluginConfig !== 'undefined' &&
        invoice_plugin_1.InvoicePluginConfig) === 'function'
        ? _j
        : Object,
    ]),
  ],
  InvoiceService
);
