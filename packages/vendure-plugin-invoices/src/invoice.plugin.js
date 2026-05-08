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
var InvoicePlugin_1;
var _a;
Object.defineProperty(exports, '__esModule', { value: true });
exports.InvoicePlugin = void 0;
const core_1 = require('@nestjs/core');
const core_2 = require('@vendure/core');
const api_extensions_1 = require('./api/api-extensions');
const invoice_admin_resolver_1 = require('./api/invoice-admin.resolver');
const invoice_common_resolver_1 = require('./api/invoice-common.resolver');
const invoice_controller_1 = require('./api/invoice.controller');
const constants_1 = require('./constants');
const invoice_config_entity_1 = require('./entities/invoice-config.entity');
const invoice_entity_1 = require('./entities/invoice.entity');
const accounting_service_1 = require('./services/accounting.service');
const invoice_service_1 = require('./services/invoice.service');
const load_data_fn_1 = require('./strategies/load-data-fn');
const local_file_strategy_1 = require('./strategies/storage/local-file-strategy');
/**
 * @description
 * Vendure plugin to generate PDF invoices for orders.
 */
let InvoicePlugin = (InvoicePlugin_1 = class InvoicePlugin {
  constructor(moduleRef) {
    this.moduleRef = moduleRef;
  }
  async onModuleInit() {
    // Initialize accounting export strategies, if they define an init function
    for (const strategy of InvoicePlugin_1.config.accountingExports || []) {
      if (strategy.init) {
        await strategy.init(new core_2.Injector(this.moduleRef));
        core_2.Logger.info(
          `Initialized accounting export strategy: ${strategy.constructor.name}`,
          constants_1.loggerCtx
        );
      }
    }
    // Initialize storage strategy
    if (InvoicePlugin_1.config.storageStrategy) {
      await InvoicePlugin_1.config.storageStrategy.init();
      core_2.Logger.info(
        `Initialized storage strategy: ${InvoicePlugin_1.config.storageStrategy.constructor.name}`,
        constants_1.loggerCtx
      );
    }
  }
  static init(config) {
    InvoicePlugin_1.config = {
      ...config,
      storageStrategy:
        config.storageStrategy || new local_file_strategy_1.LocalFileStrategy(),
      loadDataFn: config.loadDataFn || load_data_fn_1.defaultLoadDataFn,
      startInvoiceNumber: config.startInvoiceNumber || 10000,
    };
    return this;
  }
});
exports.InvoicePlugin = InvoicePlugin;
exports.InvoicePlugin =
  InvoicePlugin =
  InvoicePlugin_1 =
    __decorate(
      [
        (0, core_2.VendurePlugin)({
          imports: [core_2.PluginCommonModule],
          entities: [
            invoice_config_entity_1.InvoiceConfigEntity,
            invoice_entity_1.InvoiceEntity,
          ],
          providers: [
            invoice_service_1.InvoiceService,
            {
              provide: constants_1.PLUGIN_INIT_OPTIONS,
              useFactory: () => InvoicePlugin.config,
            },
            accounting_service_1.AccountingService,
          ],
          controllers: [invoice_controller_1.InvoiceController],
          adminApiExtensions: {
            schema: api_extensions_1.adminSchemaExtensions,
            resolvers: [
              invoice_admin_resolver_1.InvoiceAdminResolver,
              invoice_common_resolver_1.InvoiceCommonResolver,
            ],
          },
          shopApiExtensions: {
            schema: api_extensions_1.shopSchemaExtensions,
            resolvers: [invoice_common_resolver_1.InvoiceCommonResolver],
          },
          compatibility: '>=3.2.0',
          dashboard: './dashboard/index.tsx',
          configuration: (config) => {
            config.authOptions.customPermissions.push(
              invoice_common_resolver_1.invoicePermission
            );
            return config;
          },
        }),
        __metadata('design:paramtypes', [
          typeof (_a =
            typeof core_1.ModuleRef !== 'undefined' && core_1.ModuleRef) ===
          'function'
            ? _a
            : Object,
        ]),
      ],
      InvoicePlugin
    );
