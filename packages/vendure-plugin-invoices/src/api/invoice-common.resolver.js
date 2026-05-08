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
var _a, _b, _c, _d, _e;
Object.defineProperty(exports, '__esModule', { value: true });
exports.InvoiceCommonResolver = exports.invoicePermission = void 0;
const graphql_1 = require('@nestjs/graphql');
const core_1 = require('@vendure/core');
const invoice_service_1 = require('../services/invoice.service');
exports.invoicePermission = new core_1.PermissionDefinition({
  name: 'AllowInvoicesPermission',
  description: 'Allow this user to enable invoice generation',
});
let InvoiceCommonResolver = class InvoiceCommonResolver {
  constructor(invoiceService, entityHydrator) {
    this.invoiceService = invoiceService;
    this.entityHydrator = entityHydrator;
  }
  async invoices(ctx, order) {
    const invoices = await this.invoiceService.getInvoicesForOrder(
      ctx,
      order.id
    );
    await this.entityHydrator.hydrate(ctx, order, { relations: ['customer'] });
    if (!order.customer?.emailAddress) {
      return [];
    }
    return invoices.map((invoice) => ({
      ...invoice,
      orderCode: order.code,
      orderId: order.id,
      isCreditInvoice: invoice.isCreditInvoice,
      orderTotals: invoice.orderTotals,
      downloadUrl: this.invoiceService.getDownloadUrl(
        ctx,
        invoice.invoiceNumber,
        order.code,
        order.customer.emailAddress
      ),
    }));
  }
};
exports.InvoiceCommonResolver = InvoiceCommonResolver;
__decorate(
  [
    (0, graphql_1.ResolveField)('invoices'),
    (0, graphql_1.Resolver)('Order'),
    (0, core_1.Allow)(exports.invoicePermission.Permission),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Parent)()),
    __metadata('design:type', Function),
    __metadata('design:paramtypes', [
      typeof (_c =
        typeof core_1.RequestContext !== 'undefined' &&
        core_1.RequestContext) === 'function'
        ? _c
        : Object,
      typeof (_d = typeof core_1.Order !== 'undefined' && core_1.Order) ===
      'function'
        ? _d
        : Object,
    ]),
    __metadata(
      'design:returntype',
      typeof (_e = typeof Promise !== 'undefined' && Promise) === 'function'
        ? _e
        : Object
    ),
  ],
  InvoiceCommonResolver.prototype,
  'invoices',
  null
);
exports.InvoiceCommonResolver = InvoiceCommonResolver = __decorate(
  [
    (0, graphql_1.Resolver)(),
    __metadata('design:paramtypes', [
      typeof (_a =
        typeof invoice_service_1.InvoiceService !== 'undefined' &&
        invoice_service_1.InvoiceService) === 'function'
        ? _a
        : Object,
      typeof (_b =
        typeof core_1.EntityHydrator !== 'undefined' &&
        core_1.EntityHydrator) === 'function'
        ? _b
        : Object,
    ]),
  ],
  InvoiceCommonResolver
);
