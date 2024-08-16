import { InvoiceOrderTotals } from '../ui/generated/graphql';

/**
 * Reverse the order total amounts.
 * Used for creating credit invoices.
 * E.g. When `totalWithTax: 100` is given, this will return `totalWithTax: -100`
 */
export function reverseOrderTotals(
  orderTotal: InvoiceOrderTotals
): InvoiceOrderTotals {
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
