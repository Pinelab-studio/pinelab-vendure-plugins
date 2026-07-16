import { defineDashboardExtension } from '@vendure/dashboard';
import { UtmParametersBlock } from './components/UtmParametersBlock';

defineDashboardExtension({
  pageBlocks: [
    {
      id: 'utm-parameters',
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
