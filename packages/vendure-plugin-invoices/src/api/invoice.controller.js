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
var _a, _b, _c, _d, _e, _f, _g, _h, _j;
Object.defineProperty(exports, '__esModule', { value: true });
exports.InvoiceController = void 0;
const invoice_service_1 = require('../services/invoice.service');
const common_1 = require('@nestjs/common');
const express_1 = require('express');
const core_1 = require('@vendure/core');
const constants_1 = require('../constants');
const invoice_common_resolver_1 = require('./invoice-common.resolver');
let InvoiceController = class InvoiceController {
  constructor(invoiceService, channelService) {
    this.invoiceService = invoiceService;
    this.channelService = channelService;
  }
  async downloadMultipleInvoices(ctx, numbers, req, res) {
    if (!ctx.channelId) {
      throw Error(`Channel id is needed to download invoices`);
    }
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const stream = await this.invoiceService.downloadMultiple(
      ctx,
      numbers.split(','),
      res
    );
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    core_1.Logger.info(
      `Invoices ${numbers} downloaded from ${ip}`,
      constants_1.loggerCtx
    );
    stream.pipe(res);
  }
  async preview(ctx, res, body, orderCode) {
    if (!ctx.channel?.token) {
      throw new common_1.BadRequestException('No channel set for request');
    }
    if (!body?.template || !body?.template.trim()) {
      throw new common_1.BadRequestException('No template given');
    }
    const stream = await this.invoiceService.previewInvoiceWithTemplate(
      ctx,
      body.template,
      orderCode
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="preview-invoice.pdf"`,
    });
    return stream.pipe(res);
  }
  // Example: /invoices/default-channel/DJSLHJ238390/123?email=customer%40example.com
  async downloadInvoice(
    channelToken,
    orderCode,
    invoiceNumber,
    encodedCustomerEmail,
    req,
    res
  ) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (!channelToken || !orderCode || !encodedCustomerEmail) {
      core_1.Logger.warn(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Invalid invoice download attempt from ${ip} for ${req.path}`,
        constants_1.loggerCtx
      );
      throw new common_1.BadRequestException();
    }
    try {
      const customerEmail = decodeURIComponent(encodedCustomerEmail);
      const channel = await this.channelService.getChannelFromToken(
        channelToken
      );
      if (channel.token !== channelToken) {
        throw new core_1.UserInputError(
          `No channel found with token '${channelToken}'`
        );
      }
      const ctx = new core_1.RequestContext({
        apiType: 'admin',
        authorizedAsOwnerOnly: false,
        isAuthorized: true,
        channel,
      });
      const streamOrRedirect = await this.invoiceService.downloadInvoice(ctx, {
        orderCode,
        customerEmail,
        invoiceNumber,
        res,
      });
      core_1.Logger.info(
        `Invoice downloaded from ${JSON.stringify(ip)} for ${req.path}`,
        constants_1.loggerCtx
      );
      if (
        typeof streamOrRedirect === 'string' ||
        streamOrRedirect instanceof String
      ) {
        return res.redirect(302, streamOrRedirect);
      } else {
        return streamOrRedirect.pipe(res);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error) {
      core_1.Logger.warn(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Failed invoice download attempt from ${JSON.stringify(ip)} for ${
          req.path
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        }: ${error.message}`,
        constants_1.loggerCtx
      );
      throw new common_1.ForbiddenException(
        'This invoice does not exist or you are not authorized to download it'
      );
    }
  }
};
exports.InvoiceController = InvoiceController;
__decorate(
  [
    (0, core_1.Allow)(invoice_common_resolver_1.invoicePermission.Permission),
    (0, common_1.Get)('/download'),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, common_1.Query)('nrs')),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata('design:type', Function),
    __metadata('design:paramtypes', [
      typeof (_c =
        typeof core_1.RequestContext !== 'undefined' &&
        core_1.RequestContext) === 'function'
        ? _c
        : Object,
      String,
      typeof (_d =
        typeof express_1.Request !== 'undefined' && express_1.Request) ===
      'function'
        ? _d
        : Object,
      typeof (_e =
        typeof express_1.Response !== 'undefined' && express_1.Response) ===
      'function'
        ? _e
        : Object,
    ]),
    __metadata('design:returntype', Promise),
  ],
  InvoiceController.prototype,
  'downloadMultipleInvoices',
  null
);
__decorate(
  [
    (0, core_1.Allow)(invoice_common_resolver_1.invoicePermission.Permission),
    (0, common_1.Post)('/preview{/:orderCode}'),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Param)('orderCode')),
    __metadata('design:type', Function),
    __metadata('design:paramtypes', [
      typeof (_f =
        typeof core_1.RequestContext !== 'undefined' &&
        core_1.RequestContext) === 'function'
        ? _f
        : Object,
      typeof (_g =
        typeof express_1.Response !== 'undefined' && express_1.Response) ===
      'function'
        ? _g
        : Object,
      Object,
      String,
    ]),
    __metadata('design:returntype', Promise),
  ],
  InvoiceController.prototype,
  'preview',
  null
);
__decorate(
  [
    (0, common_1.Get)('/:channelToken/:orderCode{/:invoiceNumber}'),
    __param(0, (0, common_1.Param)('channelToken')),
    __param(1, (0, common_1.Param)('orderCode')),
    __param(2, (0, common_1.Param)('invoiceNumber')),
    __param(3, (0, common_1.Query)('email')),
    __param(4, (0, common_1.Req)()),
    __param(5, (0, common_1.Res)()),
    __metadata('design:type', Function),
    __metadata('design:paramtypes', [
      String,
      String,
      Object,
      String,
      typeof (_h =
        typeof express_1.Request !== 'undefined' && express_1.Request) ===
      'function'
        ? _h
        : Object,
      typeof (_j =
        typeof express_1.Response !== 'undefined' && express_1.Response) ===
      'function'
        ? _j
        : Object,
    ]),
    __metadata('design:returntype', Promise),
  ],
  InvoiceController.prototype,
  'downloadInvoice',
  null
);
exports.InvoiceController = InvoiceController = __decorate(
  [
    (0, common_1.Controller)('invoices'),
    __metadata('design:paramtypes', [
      typeof (_a =
        typeof invoice_service_1.InvoiceService !== 'undefined' &&
        invoice_service_1.InvoiceService) === 'function'
        ? _a
        : Object,
      typeof (_b =
        typeof core_1.ChannelService !== 'undefined' &&
        core_1.ChannelService) === 'function'
        ? _b
        : Object,
    ]),
  ],
  InvoiceController
);
