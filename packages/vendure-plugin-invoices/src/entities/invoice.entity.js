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
var _a, _b;
Object.defineProperty(exports, '__esModule', { value: true });
exports.InvoiceEntity = void 0;
const core_1 = require('@vendure/core');
const typeorm_1 = require('typeorm');
const generated_graphql_types_1 = require('../generated-graphql-types');
let InvoiceEntity = class InvoiceEntity extends core_1.VendureEntity {
  constructor(input) {
    super(input);
  }
};
exports.InvoiceEntity = InvoiceEntity;
__decorate(
  [
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata('design:type', String),
  ],
  InvoiceEntity.prototype,
  'channelId',
  void 0
);
__decorate(
  [
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ nullable: false }),
    __metadata('design:type', String),
  ],
  InvoiceEntity.prototype,
  'orderId',
  void 0
);
__decorate(
  [
    (0, typeorm_1.Column)({ nullable: false, type: 'int' }),
    __metadata('design:type', Number),
  ],
  InvoiceEntity.prototype,
  'invoiceNumber',
  void 0
);
__decorate(
  [
    (0, typeorm_1.Column)({ nullable: false }),
    __metadata('design:type', String),
  ],
  InvoiceEntity.prototype,
  'storageReference',
  void 0
);
__decorate(
  [
    (0, typeorm_1.Column)({ nullable: false, default: false }),
    __metadata('design:type', Boolean),
  ],
  InvoiceEntity.prototype,
  'isCreditInvoice',
  void 0
);
__decorate(
  [
    (0, typeorm_1.OneToMany)(
      () => InvoiceEntity,
      (invoice) => invoice.isCreditInvoiceFor
    ),
    __metadata('design:type', Array),
  ],
  InvoiceEntity.prototype,
  'creditInvoices',
  void 0
);
__decorate(
  [
    (0, typeorm_1.ManyToOne)(
      () => InvoiceEntity,
      (invoice) => invoice.creditInvoices
    ),
    __metadata('design:type', InvoiceEntity),
  ],
  InvoiceEntity.prototype,
  'isCreditInvoiceFor',
  void 0
);
__decorate(
  [
    (0, typeorm_1.Column)({ nullable: true, type: 'simple-json' }),
    __metadata(
      'design:type',
      typeof (_b =
        typeof generated_graphql_types_1.InvoiceOrderTotals !== 'undefined' &&
        generated_graphql_types_1.InvoiceOrderTotals) === 'function'
        ? _b
        : Object
    ),
  ],
  InvoiceEntity.prototype,
  'orderTotals',
  void 0
);
__decorate(
  [
    (0, typeorm_1.Column)({ nullable: true, type: 'simple-json' }),
    __metadata('design:type', Object),
  ],
  InvoiceEntity.prototype,
  'accountingReference',
  void 0
);
exports.InvoiceEntity = InvoiceEntity = __decorate(
  [
    (0, typeorm_1.Entity)('invoice'),
    (0, typeorm_1.Unique)(['channelId', 'invoiceNumber']),
    __metadata('design:paramtypes', [
      typeof (_a =
        typeof core_1.DeepPartial !== 'undefined' && core_1.DeepPartial) ===
      'function'
        ? _a
        : Object,
    ]),
  ],
  InvoiceEntity
);
