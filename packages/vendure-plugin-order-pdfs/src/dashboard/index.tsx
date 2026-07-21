import { defineDashboardExtension } from '@vendure/dashboard';
import { pdfTemplateListRoute } from './components/PdfTemplateListPage';
import { pdfTemplateDetailRoute } from './components/PdfTemplateDetailPage';
import { DownloadPdfMenuItem } from './components/DownloadPdfMenuItem';
import { DownloadPdfBulkAction } from './components/DownloadPdfBulkAction';

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
