import {
  Button,
  DetailPageButton,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ListPage,
  PageActionBarRight,
} from '@vendure/dashboard';
import { graphql } from '@/vdb/graphql/graphql';
import { api } from '@/vdb/graphql/api.js';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, PlusIcon, Tag } from 'lucide-react';
import { ContentTypeBadge } from './ContentTypeBadge';

/**
 * Paginated list of all CMS content entries.
 *
 * Columns: id, displayName, contentTypeCode, updatedAt.
 * Default sort: updatedAt DESC.
 * Includes a `contentTypeCode` faceted filter populated by the
 * `simpleCmsContentTypes` admin query, plus a "New" dropdown to create
 * an entry of a chosen content type.
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

/** Soft-deletes a content entry by id. */
const deleteContentEntry = graphql(`
  mutation DeleteContentEntry($id: ID!) {
    deleteContentEntry(id: $id) {
      result
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

/** Dropdown trigger listing all content types as create targets. */
function NewContentEntryButton() {
  const { data } = useQuery({
    queryKey: ['simple-cms-content-types-for-new'],
    queryFn: () => api.query(getContentTypes, {}),
  });
  const types = data?.simpleCmsContentTypes ?? [];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <PlusIcon className="mr-2 h-4 w-4" />
          New
          <ChevronDown className="ml-1 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {types.map((ct) => (
          <DropdownMenuItem key={ct.code} asChild>
            <Link to="/content/new" search={{ contentType: ct.code } as any}>
              {ct.displayName}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ContentEntryList({ route }: { route: any }) {
  return (
    <ListPage
      pageId="simple-cms-content-entries"
      title="Content"
      listQuery={getContentEntries}
      deleteMutation={deleteContentEntry}
      route={route}
      defaultVisibility={{
        id: false,
        displayName: true,
        contentTypeCode: true,
        updatedAt: true,
        createdAt: false,
      }}
      defaultSort={[{ id: 'updatedAt', desc: true }]}
      customizeColumns={{
        displayName: {
          enableColumnFilter: false,
          cell: ({ row }: any) => (
            <DetailPageButton
              id={row.original.id}
              label={row.original.displayName ?? row.original.id}
            />
          ),
        },
        createdAt: { enableColumnFilter: false },
        updatedAt: { enableColumnFilter: false },
        contentTypeCode: {
          cell: ({ row }: any) => (
            <ContentTypeBadge code={row.original.contentTypeCode} />
          ),
        },
      }}
      facetedFilters={{
        contentTypeCode: {
          title: 'Content type',
          icon: Tag,
          optionsFn: loadContentTypeOptions,
        },
      }}
    >
      <PageActionBarRight>
        <NewContentEntryButton />
      </PageActionBarRight>
    </ListPage>
  );
}
