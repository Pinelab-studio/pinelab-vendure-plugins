import { defineDashboardExtension } from '@vendure/dashboard';
import { FileText } from 'lucide-react';
import { ContentEntryList } from './components/ContentEntryList';
import { ContentEntryDetail } from './components/ContentEntryDetail';

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
    {
      path: '/content/new',
      loader: () => ({
        breadcrumb: [{ path: '/content', label: 'Content' }, 'New'],
      }),
      component: (route) => {
        const search = (route as any).useSearch?.() as
          | { contentType?: string }
          | undefined;
        return <ContentEntryDetail contentTypeCode={search?.contentType} />;
      },
    },
    {
      path: '/content/$id',
      loader: () => ({
        breadcrumb: [{ path: '/content', label: 'Content' }, 'Edit'],
      }),
      component: (route) => {
        const params = (route as any).useParams?.() as { id: string };
        return <ContentEntryDetail id={params.id} />;
      },
    },
  ],
});
