import { defineDashboardExtension } from '@vendure/dashboard';
import {
  UtmAttributionBlock,
  UtmParametersBlock,
  useUtmParameters,
} from './components/UtmParametersBlock';

defineDashboardExtension({
  pageBlocks: [
    {
      id: 'utm-parameters',
      title: 'UTM attribution',
      shouldRender: (context) => {
        const { data } = useUtmParameters(context.entity?.id as string);
        return (
          data?.order?.utmParameters.some(
            (param) => param.attributedValue != null
          ) ?? false
        );
      },
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
