import { defineDashboardExtension } from '@vendure/dashboard';
import { FileText } from 'lucide-react';

defineDashboardExtension({
  routes: [
    {
      path: '/content',
      component: () => {
        return (
          <div style={{ padding: 16 }}>
            <h1 style={{ margin: 0, fontSize: 20 }}>Content</h1>
            <p style={{ marginTop: 8 }}>
              Simple CMS dashboard UI is not implemented yet.
            </p>
          </div>
        );
      },
      navMenuItem: {
        sectionId: 'catalog',
        id: 'simple-cms-content',
        title: 'Content',
        icon: FileText,
      },
    },
  ],
});
