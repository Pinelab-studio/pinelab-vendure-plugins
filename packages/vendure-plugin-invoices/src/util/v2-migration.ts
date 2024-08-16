import { InvoiceEntity } from '../entities/invoice.entity';
import { Order } from '@vendure/core';
import { QueryRunner } from 'typeorm';

type OrderWithInvoice = Order & { invoice: InvoiceEntity };

/**
 * Populates `invoice.orderTotals` with the current totals of the order.
 * This migration is needed to support credit invoices of invoices that have been created with V1.X of the plugin.
 */
export async function migrateInvoices(queryRunner: QueryRunner): Promise<void> {
  const orderRepo = queryRunner.manager.getRepository(Order);
  const invoiceRepo = queryRunner.manager.getRepository(InvoiceEntity);
  const take = 100;
  let hasMore = true;
  let migratedInvoices = 0;
  let total: number | undefined = undefined;
  while (hasMore) {
    const [items, count] = await orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.lines', 'lines')
      .innerJoinAndMapOne(
        'order.invoice',
        InvoiceEntity,
        'invoice',
        'invoice.orderId = order.id'
      )
      .where('invoice.orderTotals IS NULL')
      .take(take)
      .getManyAndCount();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    const orders: OrderWithInvoice[] = items as any;
    if (!total) {
      // Set initial total invoices
      total = count;
    }
    if (orders.length === 0) {
      hasMore = false;
      break;
    }
    const invoicesWithTotals = orders.map((order) => {
      order.invoice.orderTotals = {
        taxSummaries: order.taxSummary.map((t) => {
          return {
            description: t.description,
            taxRate: t.taxRate,
            taxBase: t.taxBase,
            taxTotal: t.taxTotal,
          };
        }),
        total: order.total,
        totalWithTax: order.totalWithTax,
      };
      return order.invoice;
    });
    await invoiceRepo.save(invoicesWithTotals);
    migratedInvoices += orders.length;
    console.log(
      `Migrated invoices ${migratedInvoices}/${total}. Last invoice nr.: ${
        orders[orders.length - 1].invoice.invoiceNumber
      }`
    );
  }
  console.log(`Successfully migrated ${migratedInvoices} invoices`);
}
