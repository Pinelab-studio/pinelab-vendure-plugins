import {
  DashboardRouteDefinition,
  ListPage,
  defineDashboardExtension,
} from '@vendure/dashboard';
import { graphql } from '@/gql';

const searchLogAggregatesDocument = graphql(`
  query SearchAnalytics($options: SearchLogAggregateListOptions) {
    searchLogAggregates(options: $options) {
      items {
        id
        term
        searchCount
        lastSearchedAt
        resultCount
        languageCode
      }
      totalItems
    }
  }
`);

const searchAnalyticsRoute: DashboardRouteDefinition = {
  path: '/search-analytics',
  loader: () => ({ breadcrumb: 'Search analytics' }),
  navMenuItem: {
    sectionId: 'settings',
    id: 'search-analytics',
    title: 'Search Analytics',
    requiresPermission: 'ReadCatalog',
  },
  component: (route) => (
    <ListPage
      pageId="search-analytics"
      title="Search Analytics"
      route={route}
      listQuery={searchLogAggregatesDocument}
      defaultSort={[{ id: 'searchCount', desc: true }]}
      onSearchTermChange={(term) => ({ term: { contains: term } })}
      customizeColumns={{
        id: { meta: { disabled: true } },
        term: { header: 'Term' },
        searchCount: { header: 'Searches' },
        lastSearchedAt: { header: 'Last searched' },
        resultCount: { header: 'Latest result count' },
        languageCode: { header: 'Language' },
      }}
    />
  ),
};

defineDashboardExtension({ routes: [searchAnalyticsRoute] });
