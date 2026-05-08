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
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
Object.defineProperty(exports, '__esModule', { value: true });
exports.InvoiceAdminResolver = void 0;
const common_1 = require('@nestjs/common');
const graphql_1 = require('@nestjs/graphql');
const core_1 = require('@vendure/core');
const constants_1 = require('../constants');
const index_1 = require('../index');
const invoice_service_1 = require('../services/invoice.service');
const generated_graphql_types_1 = require('../generated-graphql-types');
const invoice_common_resolver_1 = require('./invoice-common.resolver');
const accounting_service_1 = require('../services/accounting.service');
let InvoiceAdminResolver = class InvoiceAdminResolver {
  constructor(invoiceService, accountingService, orderService, config) {
    this.invoiceService = invoiceService;
    this.accountingService = accountingService;
    this.orderService = orderService;
    this.config = config;
  }
  async exportInvoiceToAccountingPlatform(ctx, invoiceNumber) {
    await this.accountingService.exportInvoiceToAccountingPlatform(
      ctx,
      invoiceNumber
    );
    return true;
  }
  async upsertInvoiceConfig(ctx, input) {
    return this.invoiceService.upsertConfig(ctx, input);
  }
  async createInvoice(ctx, orderId) {
    const order = await this.orderService.findOne(ctx, orderId, ['customer']);
    if (!order?.customer?.emailAddress) {
      throw new core_1.UserInputError(
        `Can not generate invoice for an order without 'customer.emailAddress'`
      );
    }
    const invoice = await this.invoiceService.createInvoicesForOrder(
      ctx.channel.token,
      order.code,
      false
    );
    if (!invoice) {
      throw new core_1.UserInputError(
        `Could not generate invoice for order. Please check the logs for more information.`
      );
    }
    return {
      ...invoice,
      isCreditInvoice: invoice.isCreditInvoice,
      orderId: order.id,
      orderCode: order.code,
      downloadUrl: this.invoiceService.getDownloadUrl(
        ctx,
        invoice.invoiceNumber,
        order.code,
        order.customer.emailAddress
      ),
    };
  }
  async invoiceConfig(ctx) {
    return this.invoiceService.getConfig(ctx);
  }
  async invoices(ctx, args) {
    return this.invoiceService.findAll(ctx, args.options || undefined);
  }
};
exports.InvoiceAdminResolver = InvoiceAdminResolver;
__decorate(
  [
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(invoice_common_resolver_1.invoicePermission.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('invoiceNumber')),
    __metadata('design:type', Function),
    __metadata('design:paramtypes', [
      typeof (_e =
        typeof core_1.RequestContext !== 'undefined' &&
        core_1.RequestContext) === 'function'
        ? _e
        : Object,
      Number,
    ]),
    __metadata(
      'design:returntype',
      typeof (_f = typeof Promise !== 'undefined' && Promise) === 'function'
        ? _f
        : Object
    ),
  ],
  InvoiceAdminResolver.prototype,
  'exportInvoiceToAccountingPlatform',
  null
);
__decorate(
  [
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(invoice_common_resolver_1.invoicePermission.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata('design:type', Function),
    __metadata('design:paramtypes', [
      typeof (_g =
        typeof core_1.RequestContext !== 'undefined' &&
        core_1.RequestContext) === 'function'
        ? _g
        : Object,
      typeof (_h =
        typeof generated_graphql_types_1.InvoiceConfigInput !== 'undefined' &&
        generated_graphql_types_1.InvoiceConfigInput) === 'function'
        ? _h
        : Object,
    ]),
    __metadata(
      'design:returntype',
      typeof (_j = typeof Promise !== 'undefined' && Promise) === 'function'
        ? _j
        : Object
    ),
  ],
  InvoiceAdminResolver.prototype,
  'upsertInvoiceConfig',
  null
);
__decorate(
  [
    (0, graphql_1.Mutation)(),
    (0, core_1.Transaction)(),
    (0, core_1.Allow)(invoice_common_resolver_1.invoicePermission.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata('design:type', Function),
    __metadata('design:paramtypes', [
      typeof (_k =
        typeof core_1.RequestContext !== 'undefined' &&
        core_1.RequestContext) === 'function'
        ? _k
        : Object,
      typeof (_l = typeof core_1.ID !== 'undefined' && core_1.ID) === 'function'
        ? _l
        : Object,
    ]),
    __metadata(
      'design:returntype',
      typeof (_m = typeof Promise !== 'undefined' && Promise) === 'function'
        ? _m
        : Object
    ),
  ],
  InvoiceAdminResolver.prototype,
  'createInvoice',
  null
);
__decorate(
  [
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(invoice_common_resolver_1.invoicePermission.Permission),
    __param(0, (0, core_1.Ctx)()),
    __metadata('design:type', Function),
    __metadata('design:paramtypes', [
      typeof (_o =
        typeof core_1.RequestContext !== 'undefined' &&
        core_1.RequestContext) === 'function'
        ? _o
        : Object,
    ]),
    __metadata(
      'design:returntype',
      typeof (_p = typeof Promise !== 'undefined' && Promise) === 'function'
        ? _p
        : Object
    ),
  ],
  InvoiceAdminResolver.prototype,
  'invoiceConfig',
  null
);
__decorate(
  [
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(invoice_common_resolver_1.invoicePermission.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata('design:type', Function),
    __metadata('design:paramtypes', [
      typeof (_q =
        typeof core_1.RequestContext !== 'undefined' &&
        core_1.RequestContext) === 'function'
        ? _q
        : Object,
      typeof (_r =
        typeof generated_graphql_types_1.QueryInvoicesArgs !== 'undefined' &&
        generated_graphql_types_1.QueryInvoicesArgs) === 'function'
        ? _r
        : Object,
    ]),
    __metadata(
      'design:returntype',
      typeof (_s = typeof Promise !== 'undefined' && Promise) === 'function'
        ? _s
        : Object
    ),
  ],
  InvoiceAdminResolver.prototype,
  'invoices',
  null
);
exports.InvoiceAdminResolver = InvoiceAdminResolver = __decorate(
  [
    (0, graphql_1.Resolver)(),
    __param(3, (0, common_1.Inject)(constants_1.PLUGIN_INIT_OPTIONS)),
    __metadata('design:paramtypes', [
      typeof (_a =
        typeof invoice_service_1.InvoiceService !== 'undefined' &&
        invoice_service_1.InvoiceService) === 'function'
        ? _a
        : Object,
      typeof (_b =
        typeof accounting_service_1.AccountingService !== 'undefined' &&
        accounting_service_1.AccountingService) === 'function'
        ? _b
        : Object,
      typeof (_c =
        typeof core_1.OrderService !== 'undefined' && core_1.OrderService) ===
      'function'
        ? _c
        : Object,
      typeof (_d =
        typeof index_1.InvoicePluginConfig !== 'undefined' &&
        index_1.InvoicePluginConfig) === 'function'
        ? _d
        : Object,
    ]),
  ],
  InvoiceAdminResolver
);
