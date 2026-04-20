import { defineDashboardExtension } from '@vendure/dashboard';
import { invoiceListRoute } from './components/InvoiceListPage';
import { invoiceConfigRoute } from './components/InvoiceConfigPage';
import { OrderInvoicesBlock } from './components/OrderInvoicesBlock';
import { RegenerateInvoiceButton } from './components/RegenerateInvoiceButton';

defineDashboardExtension({
  routes: [invoiceListRoute, invoiceConfigRoute],
  actionBarItems: [
    {
      pageId: 'order-detail',
      component: ({ context }) => (
        <RegenerateInvoiceButton context={context} isWarning={false} />
      ),
    },
    {
      pageId: 'order-detail',
      component: ({ context }) => (
        <RegenerateInvoiceButton context={context} isWarning={true} />
      ),
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
