import { defineDashboardExtension } from '@vendure/dashboard';
import { pdfTemplateList } from './components/pdf-template-list';
import { pdfTemplateDetail } from './components/pdf-template-detail';

defineDashboardExtension({
  routes: [pdfTemplateList, pdfTemplateDetail],
});
