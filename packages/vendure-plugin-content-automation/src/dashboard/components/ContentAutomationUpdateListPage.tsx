import {
  Badge,
  Button,
  DashboardRouteDefinition,
  ListPage,
} from '@vendure/dashboard';
import { AnyRoute, Link } from '@tanstack/react-router';
import { ExternalLinkIcon, SparklesIcon } from 'lucide-react';
import { contentAutomationUpdateListDocument } from '../queries';

/**
 * Lists all successful content generations of the active channel.
 */
function ContentAutomationUpdateListPage({ route }: { route: AnyRoute }) {
  return (
    <ListPage
      pageId="content-automation-update-list"
      title="Content automation"
      listQuery={contentAutomationUpdateListDocument}
      route={route}
      onSearchTermChange={(term) => ({
        _or: [
          { strategyName: { contains: term } },
          { resultMessage: { contains: term } },
        ],
      })}
      customizeColumns={{
        strategyName: { header: 'Strategy' },
        languageCode: {
          header: 'Language',
          cell: ({ row }) => (
            <Badge variant="outline">{row.original.languageCode}</Badge>
          ),
        },
        resultMessage: {
          header: 'Result',
          cell: ({ row }) => (
            <span
              className="block max-w-md truncate text-sm text-muted-foreground"
              title={row.original.resultMessage ?? undefined}
            >
              {row.original.resultMessage ?? '—'}
            </span>
          ),
        },
        entityUrl: {
          header: 'Entity',
          cell: ({ row }) => {
            const url = row.original.entityUrl;
            if (!url) {
              return null;
            }
            return (
              <Button
                variant="ghost"
                size="icon"
                title="Go to entity"
                render={<Link to={url} />}
              >
                <ExternalLinkIcon className="h-4 w-4" />
                <span className="sr-only">Go to entity</span>
              </Button>
            );
          },
        },
      }}
      defaultColumnOrder={[
        'createdAt',
        'strategyName',
        'languageCode',
        'resultMessage',
        'entityUrl',
      ]}
      defaultVisibility={{
        createdAt: true,
        strategyName: true,
        languageCode: true,
        resultMessage: true,
        entityUrl: true,
        id: false,
        updatedAt: false,
        hash: false,
      }}
      defaultSort={[{ id: 'createdAt', desc: true }]}
    />
  );
}

export const contentAutomationUpdateListRoute: DashboardRouteDefinition = {
  path: '/content-automation',
  loader: () => ({ breadcrumb: 'Content automation' }),
  component: (route) => <ContentAutomationUpdateListPage route={route} />,
  navMenuItem: {
    sectionId: 'catalog',
    id: 'content-automation',
    title: 'Content automation',
    icon: SparklesIcon,
  },
};
