'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.defaultLoadDataFn = void 0;
const core_1 = require('@vendure/core');
const defaultLoadDataFn = (
  ctx,
  injector,
  order,
  mostRecentInvoiceNumber,
  shouldGenerateCreditInvoice
) => {
  // Increase order number
  let newInvoiceNumber = mostRecentInvoiceNumber || 0;
  newInvoiceNumber += 1;
  const orderDate = new Intl.DateTimeFormat('nl-NL').format(order.updatedAt);
  order.lines.forEach((line) => {
    line.productVariant = (0, core_1.translateEntity)(
      line.productVariant,
      ctx.languageCode
    );
  });
  order.shippingLines.forEach((line) => {
    line.shippingMethod = (0, core_1.translateEntity)(
      line.shippingMethod,
      ctx.languageCode
    );
  });
  if (!shouldGenerateCreditInvoice) {
    // Normal debit invoice
    return {
      orderDate,
      invoiceNumber: newInvoiceNumber,
      order: order,
    };
  }
  // Create credit invoice
  const { previousInvoice, reversedOrderTotals } = shouldGenerateCreditInvoice;
  return {
    orderDate,
    invoiceNumber: newInvoiceNumber,
    isCreditInvoice: true,
    // Reference to original invoice because this is a credit invoice
    originalInvoiceNumber: previousInvoice.invoiceNumber,
    order: {
      ...order,
      total: reversedOrderTotals.total,
      totalWithTax: reversedOrderTotals.totalWithTax,
      taxSummary: reversedOrderTotals.taxSummaries.map((t) => {
        return {
          description: t.description,
          taxBase: t.taxBase,
          taxRate: t.taxRate,
          taxTotal: t.taxTotal,
        };
      }),
    },
  };
};
exports.defaultLoadDataFn = defaultLoadDataFn;
