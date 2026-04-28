import { defineDashboardExtension } from '@vendure/dashboard';
import { FileText } from 'lucide-react';
import { ContentEntryList } from './components/ContentEntryList';

defineDashboardExtension({
  routes: [
    {
      path: '/content',
      loader: () => ({ breadcrumb: 'Content' }),
      component: (route) => <ContentEntryList route={route} />,
      navMenuItem: {
        sectionId: 'catalog',
        id: 'simple-cms-content',
        title: 'Content',
        icon: FileText,
      },
    },
  ],
});
