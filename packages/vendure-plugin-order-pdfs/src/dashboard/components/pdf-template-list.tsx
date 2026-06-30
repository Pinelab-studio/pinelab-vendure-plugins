import {
  ActionBarItem,
  Badge,
  Button,
  DashboardRouteDefinition,
  DetailPageButton,
  Link,
  ListPage,
} from '@vendure/dashboard';
import { PlusIcon } from 'lucide-react';
import { graphql } from '@/gql';

const getPdfTemplatesDocument = graphql(`
  query GetPdfTemplates($options: PdfTemplateListOptions) {
    pdfTemplates(options: $options) {
      items {
        id
        name
        enabled
        public
      }
      totalItems
    }
  }
`);

const deletePdfTemplateDocument = graphql(`
  mutation DeletePdfTemplate($id: ID!) {
    deletePdfTemplate(id: $id) {
      result
    }
  }
`);

export const pdfTemplateList: DashboardRouteDefinition = {
  navMenuItem: {
    sectionId: 'settings', // or wherever you had it in the Angular nav
    id: 'pdf-templates',
    url: '/pdf-templates',
    title: 'PDF Templates',
  },
  path: '/pdf-templates',
  loader: () => ({ breadcrumb: 'PDF Templates' }),
  component: (route) => (
    <ListPage
      pageId="pdf-template-list"
      title="PDF Templates"
      listQuery={getPdfTemplatesDocument}
      deleteMutation={deletePdfTemplateDocument}
      route={route}
      customizeColumns={{
        name: {
          header: 'Name',
          cell: ({ row }) => (
            <DetailPageButton id={row.original.id} label={row.original.name} />
          ),
        },
        enabled: {
          header: 'Enabled',
          cell: ({ row }) =>
            row.original.enabled ? (
              <Badge variant="success">Enabled</Badge>
            ) : (
              <Badge variant="destructive">Disabled</Badge>
            ),
        },
        public: {
          header: 'Public',
          cell: ({ row }) =>
            row.original.public ? (
              <Badge variant="success">Public</Badge>
            ) : (
              <Badge variant="secondary">Admin only</Badge>
            ),
        },
      }}
    >
      <ActionBarItem>
        <Button render={<Link to="./new" />}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Create
        </Button>
      </ActionBarItem>
    </ListPage>
  ),
};
