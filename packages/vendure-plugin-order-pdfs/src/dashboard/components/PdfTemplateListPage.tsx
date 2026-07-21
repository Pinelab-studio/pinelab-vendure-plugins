import {
  ActionBarItem,
  Badge,
  Button,
  DashboardRouteDefinition,
  DetailPageButton,
  ListPage,
} from '@vendure/dashboard';
import { graphql } from '@/gql';
import { Link } from '@tanstack/react-router';
import { PlusIcon } from 'lucide-react';

export const pdfTemplateListDocument = graphql(`
  query PdfTemplateList($options: PDFTemplateListOptions) {
    pdfTemplates(options: $options) {
      items {
        id
        createdAt
        updatedAt
        name
        enabled
        public
      }
      totalItems
    }
  }
`);

export const deletePdfTemplateDocument = graphql(`
  mutation DeletePdfTemplateFromList($id: ID!) {
    deletePDFTemplate(id: $id) {
      result
      message
    }
  }
`);

export const pdfTemplateListRoute: DashboardRouteDefinition = {
  navMenuItem: {
    sectionId: 'settings',
    id: 'pdf-templates',
    url: '/pdf-templates',
    title: 'PDF Templates',
  },
  path: '/pdf-templates',
  loader: () => ({
    breadcrumb: 'PDF Templates',
  }),
  component: (route) => (
    <ListPage
      pageId="pdf-template-list"
      title="PDF Templates"
      listQuery={pdfTemplateListDocument}
      deleteMutation={deletePdfTemplateDocument}
      route={route}
      customizeColumns={{
        name: {
          cell: ({ row }: any) => (
            <DetailPageButton id={row.original.id} label={row.original.name} />
          ),
        },
        enabled: {
          cell: ({ row }: any) => (
            <Badge variant={row.original.enabled ? 'success' : 'secondary'}>
              {row.original.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          ),
        },
        public: {
          cell: ({ row }: any) => (
            <Badge variant={row.original.public ? 'success' : 'secondary'}>
              {row.original.public ? 'Public' : 'Admin only'}
            </Badge>
          ),
        },
      }}
      defaultVisibility={{
        name: true,
        enabled: true,
        public: true,
        createdAt: true,
      }}
      defaultColumnOrder={['name', 'enabled', 'public', 'createdAt']}
    >
      <ActionBarItem itemId="new-pdf-template">
        <Button render={<Link to="./new" />}>
          <PlusIcon className="mr-2 h-4 w-4" />
          New PDF template
        </Button>
      </ActionBarItem>
    </ListPage>
  ),
};
