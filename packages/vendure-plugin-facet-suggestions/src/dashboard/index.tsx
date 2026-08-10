import { defineDashboardExtension } from '@vendure/dashboard';
import { SuggestedFacetsBlock } from './components/SuggestedFacetsBlock';

defineDashboardExtension({
  pageBlocks: [
    {
      id: 'suggested-facets',
      title: 'Suggested facets',
      location: {
        pageId: 'product-detail',
        column: 'side',
        position: {
          blockId: 'facet-values',
          order: 'after',
        },
      },
      component: SuggestedFacetsBlock,
    },
  ],
});
