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
var _a;
Object.defineProperty(exports, '__esModule', { value: true });
exports.InvoiceConfigEntity = void 0;
const core_1 = require('@vendure/core');
const typeorm_1 = require('typeorm');
const constants_1 = require('../constants');
let InvoiceConfigEntity = class InvoiceConfigEntity extends core_1.VendureEntity {
  constructor(input) {
    super(input);
    this.enabled = false;
    this.createCreditInvoices = true;
  }
};
exports.InvoiceConfigEntity = InvoiceConfigEntity;
__decorate(
  [(0, typeorm_1.Column)(), __metadata('design:type', String)],
  InvoiceConfigEntity.prototype,
  'channelId',
  void 0
);
__decorate(
  [
    (0, typeorm_1.Column)({ default: false }),
    __metadata('design:type', Boolean),
  ],
  InvoiceConfigEntity.prototype,
  'enabled',
  void 0
);
__decorate(
  [
    (0, typeorm_1.Column)({ default: true }),
    __metadata('design:type', Boolean),
  ],
  InvoiceConfigEntity.prototype,
  'createCreditInvoices',
  void 0
);
__decorate(
  [
    (0, typeorm_1.Column)({
      type: resolveTemplateColumnType(),
      nullable: true,
    }),
    __metadata('design:type', String),
  ],
  InvoiceConfigEntity.prototype,
  'templateString',
  void 0
);
exports.InvoiceConfigEntity = InvoiceConfigEntity = __decorate(
  [
    (0, typeorm_1.Entity)('invoice_config'),
    __metadata('design:paramtypes', [
      typeof (_a =
        typeof core_1.DeepPartial !== 'undefined' && core_1.DeepPartial) ===
      'function'
        ? _a
        : Object,
    ]),
  ],
  InvoiceConfigEntity
);
/**
 * Resolve column type based on the DB engine
 */
function resolveTemplateColumnType() {
  const dbEngine = process.env.INVOICES_PLUGIN_DB_ENGINE;
  if (!dbEngine) {
    return 'text';
  } else if (dbEngine === 'mysql' || dbEngine === 'mariadb') {
    return 'longtext'; // up to 4GB
  } else if (dbEngine === 'postgres') {
    return 'text'; // Up to 1GB
  } else if (dbEngine === 'cockroachdb') {
    return 'string';
  } else if (dbEngine === 'mssql') {
    return 'text';
  } else if (dbEngine === 'sqlite') {
    return 'text';
  } else if (dbEngine === 'oracle') {
    return 'clob';
  } else {
    core_1.Logger.warn(
      `No large-text column type available for DB engine "${dbEngine}", using "text". ( Contributions welcome )`,
      constants_1.loggerCtx
    );
  }
  return 'text';
}
