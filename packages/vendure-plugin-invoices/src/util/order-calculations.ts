import { OrderTaxSummary } from '@vendure/common/lib/generated-types';
import { InvoiceOrderTotals } from '../entities/invoice.entity';

/**
 * Reverse the order total amounts.
 * Used for creating credit invoices.
 * E.g. When `totalWithTax: 100` is given, this will return `totalWithTax: -100`
 */
export function reverseOrderTotals(
  orderTotal: InvoiceOrderTotals,
): InvoiceOrderTotals {
  const summaries = orderTotal.taxSummaries.map((summary) => {
    return {
      ...summary,
      taxBase: -summary.taxBase,
      taxTotal: -summary.taxTotal,
    };
  });
  return {
    total: -orderTotal.total,
    totalWithTax: -orderTotal.totalWithTax,
    taxSummaries: summaries,
  };
}
