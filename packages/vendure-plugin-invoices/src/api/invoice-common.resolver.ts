import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  EntityHydrator,
  Order,
  PermissionDefinition,
  RequestContext,
} from '@vendure/core';
import { InvoiceService } from '../services/invoice.service';
import { Invoice } from '../ui/generated/graphql';

export const invoicePermission = new PermissionDefinition({
  name: 'AllowInvoicesPermission',
  description: 'Allow this user to enable invoice generation',
});

@Resolver()
export class InvoiceCommonResolver {
  constructor(
    private invoiceService: InvoiceService,
    private entityHydrator: EntityHydrator
  ) {}

  @ResolveField('invoices')
  @Resolver('Order')
  @Allow(invoicePermission.Permission)
  async invoices(
    @Ctx() ctx: RequestContext,
    @Parent() order: Order
  ): Promise<Invoice[]> {
    const invoices = await this.invoiceService.getInvoicesForOrder(
      ctx,
      order.id
    );
    await this.entityHydrator.hydrate(ctx, order, { relations: ['customer'] });
    if (!order.customer?.emailAddress) {
      return [];
    }
    return invoices.map((invoice) => ({
      ...invoice,
      orderCode: order.code,
      orderId: order.id,
      isCreditInvoice: invoice.isCreditInvoice,
      orderTotals: invoice.orderTotals,
      downloadUrl: this.invoiceService.getDownloadUrl(
        ctx,
        invoice.invoiceNumber,
        order.code,
        order.customer!.emailAddress
      ),
    }));
  }
}
