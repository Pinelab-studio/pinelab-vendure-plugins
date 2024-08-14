import { InvoiceOrderTotals } from '../ui/generated/graphql';

/**
 * Reverse the order total amounts.
 * Used for creating credit invoices.
 * E.g. When `totalWithTax: 100` is given, this will return `totalWithTax: -100`
 */
export function reverseOrderTotals(
  orderTotal: InvoiceOrderTotals
): InvoiceOrderTotals {
  const summaries = orderTotal.taxSummaries.map((summary) => {
    return {
      ...summary,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      taxBase: -summary.taxBase,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      taxTotal: -summary.taxTotal,
    } as InvoiceOrderTotals;
  });
  return {
    total: -orderTotal.total,
    totalWithTax: -orderTotal.totalWithTax,
    taxSummaries: summaries,
  } as InvoiceOrderTotals;
}
