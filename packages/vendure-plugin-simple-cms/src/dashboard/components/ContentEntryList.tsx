import { ListPage } from '@vendure/dashboard';
import { graphql } from '@/vdb/graphql/graphql';
import { api } from '@/vdb/graphql/api.js';
import { Tag } from 'lucide-react';

/**
 * Paginated list of all CMS content entries.
 *
 * Columns: id, displayName, contentTypeCode, updatedAt.
 * Default sort: updatedAt DESC.
 * Includes a `contentTypeCode` faceted filter populated by the
 * `simpleCmsContentTypes` admin query.
 */
const getContentEntries = graphql(`
  query ContentEntries($options: AdminContentEntryListOptions) {
    contentEntries(options: $options) {
      items {
        id
        contentTypeCode
        createdAt
        updatedAt
        displayName
      }
      totalItems
    }
  }
`);

const getContentTypes = graphql(`
  query ContentTypesForFilter {
    simpleCmsContentTypes {
      code
      displayName
    }
  }
`);

/**
 * Loads available content types and maps them to faceted filter options.
 */
async function loadContentTypeOptions() {
  const result = await api.query(getContentTypes, {});
  return (result?.simpleCmsContentTypes ?? []).map((ct) => ({
    label: ct.displayName,
    value: ct.code,
  }));
}

export function ContentEntryList({ route }: { route: any }) {
  return (
    <ListPage
      pageId="simple-cms-content-entries"
      title="Content"
      listQuery={getContentEntries}
      route={route}
      defaultVisibility={{
        id: true,
        displayName: true,
        contentTypeCode: true,
        updatedAt: true,
        createdAt: false,
      }}
      defaultSort={[{ id: 'updatedAt', desc: true }]}
      facetedFilters={{
        contentTypeCode: {
          title: 'Content type',
          icon: Tag,
          optionsFn: loadContentTypeOptions,
        },
      }}
    />
  );
}
