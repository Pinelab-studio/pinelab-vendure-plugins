import { defineDashboardExtension } from '@vendure/dashboard';
import { invoiceConfigRoute } from './components/InvoiceConfigPage';
import { invoiceListRoute } from './components/InvoiceListPage';
import { OrderInvoicesBlock } from './components/OrderInvoicesBlock';
import { RegenerateInvoiceButton } from './components/RegenerateInvoiceButton';

defineDashboardExtension({
  routes: [invoiceListRoute, invoiceConfigRoute],
  actionBarItems: [
    {
      pageId: 'order-detail',
      component: ({ context }) => <RegenerateInvoiceButton context={context} />,
    },
  ],
  pageBlocks: [
    {
      id: 'order-invoices',
      title: 'Invoices',
      location: {
        pageId: 'order-detail',
        column: 'main',
        position: {
          blockId: 'order-history',
          order: 'before',
        },
      },
      component: ({ context }) => (
        <OrderInvoicesBlock orderId={context.entity?.id as string} />
      ),
    },
  ],
});
