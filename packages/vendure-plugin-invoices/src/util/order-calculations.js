'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.reverseOrderTotals = reverseOrderTotals;
/**
 * Reverse the order total amounts.
 * Used for creating credit invoices.
 * E.g. When `totalWithTax: 100` is given, this will return `totalWithTax: -100`
 */
function reverseOrderTotals(orderTotal) {
  const reversedSummaries = orderTotal.taxSummaries.map((summary) => {
    return {
      description: summary.description,
      taxRate: summary.taxRate,
      taxBase: -summary.taxBase,
      taxTotal: -summary.taxTotal,
    };
  });
  return {
    total: -orderTotal.total,
    totalWithTax: -orderTotal.totalWithTax,
    taxSummaries: reversedSummaries,
  };
}
