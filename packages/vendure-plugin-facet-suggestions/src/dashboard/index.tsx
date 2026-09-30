import { defineDashboardExtension } from '@vendure/dashboard';
import { SuggestedFacetsBlock } from './components/SuggestedFacetsBlock';

defineDashboardExtension({
  pageBlocks: [
    {
      id: 'suggested-facets',
      location: {
        pageId: 'product-detail',
        column: 'main',
        position: {
          blockId: 'main-form',
          order: 'after',
        },
      },
      component: SuggestedFacetsBlock,
    },
  ],
});
