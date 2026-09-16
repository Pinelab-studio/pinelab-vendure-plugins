import { defineDashboardExtension } from '@vendure/dashboard';
import {
  UtmAttributionBlock,
  UtmParametersBlock,
} from './components/UtmParametersBlock';

defineDashboardExtension({
  pageBlocks: [
    {
      id: 'utm-parameters',
      title: 'UTM attribution',
      location: {
        pageId: 'order-detail',
        column: 'main',
        position: {
          blockId: 'order-history',
          order: 'before',
        },
      },
      component: ({ context }) => (
        <UtmAttributionBlock orderId={context.entity?.id as string} />
      ),
    },
    {
      id: 'utm-raw-parameters',
      title: 'UTM Parameters',
      location: {
        pageId: 'order-detail',
        column: 'main',
        position: {
          blockId: 'order-history',
          order: 'before',
        },
      },
      component: ({ context }) => (
        <UtmParametersBlock orderId={context.entity?.id as string} />
      ),
    },
  ],
});
