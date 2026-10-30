import { defineDashboardExtension } from '@vendure/dashboard';
import { DownloadPdfBulkAction } from './components/DownloadPdfBulkAction';
import { DownloadPdfMenuItem } from './components/DownloadPdfMenuItem';
import { pdfTemplateDetailRoute } from './components/PdfTemplateDetailPage';
import { pdfTemplateListRoute } from './components/PdfTemplateListPage';

defineDashboardExtension({
  routes: [pdfTemplateListRoute, pdfTemplateDetailRoute],
  actionBarItems: [
    {
      pageId: 'order-detail',
      type: 'dropdown',
      requiresPermission: 'AllowPDFDownload',
      component: ({ context }) => <DownloadPdfMenuItem context={context} />,
    },
  ],
  dataTables: [
    {
      pageId: 'order-list',
      bulkActions: [
        {
          component: DownloadPdfBulkAction,
        },
      ],
    },
  ],
});
