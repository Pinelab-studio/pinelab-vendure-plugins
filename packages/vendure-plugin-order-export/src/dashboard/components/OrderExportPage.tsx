import {
  ActionBarItem,
  api,
  Button,
  DashboardRouteDefinition,
  DateRangePicker,
  Page,
  PageActionBar,
  PageBlock,
  PageLayout,
  PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@vendure/dashboard';
import { graphql } from '@/gql';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { getAuthHeaders, getServerBaseUrl, downloadBlob } from '../utils';

const availableOrderExportStrategiesDocument = graphql(`
  query AvailableOrderExportStrategies {
    availableOrderExportStrategies
  }
`);

/** Structurally matches the dashboard's `DefinedDateRange`. */
interface DateRange {
  from: Date;
  to: Date;
}

/** Default to the last 30 days (full days). */
function getDefaultDateRange(): DateRange {
  const from = new Date();
  from.setDate(from.getDate() - 29);
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function OrderExportPageComponent() {
  const [downloading, setDownloading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());
  const [strategy, setStrategy] = useState('');

  const { data } = useQuery({
    queryKey: ['order-export-strategies'],
    queryFn: () => api.query(availableOrderExportStrategiesDocument, {}),
  });
  const strategies = data?.availableOrderExportStrategies ?? [];

  useEffect(() => {
    if (strategies.length && !strategy) {
      setStrategy(strategies[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategies.join(',')]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const serverPath = getServerBaseUrl();
      const res = await fetch(
        `${serverPath}/export-orders/export/${strategy}?startDate=${dateRange.from.toISOString()}&endDate=${dateRange.to.toISOString()}`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.message ?? 'Failed to export orders');
      }
      const header = res.headers.get('Content-Disposition');
      const parts = header?.split(';') ?? [];
      const fileName = parts[1]?.split('=')[1] ?? 'order-export';
      const blob = await res.blob();
      downloadBlob(blob, fileName);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to export orders');
    }
    setDownloading(false);
  }

  return (
    <Page pageId="order-export">
      <PageTitle>Export orders</PageTitle>
      <PageActionBar>
        <ActionBarItem
          itemId="export-button"
          requiresPermission={['ExportOrders']}
        >
          <Button
            type="button"
            disabled={downloading || !strategy}
            onClick={handleDownload}
          >
            {downloading ? 'Exporting...' : 'Export'}
          </Button>
        </ActionBarItem>
      </PageActionBar>
      <PageLayout>
        <PageBlock column="main" blockId="order-export-form">
          <div className="space-y-6">
            <div className="space-y-2 flex flex-col">
              <label className="text-sm font-medium">Date range</label>
              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
            </div>
            <div className="space-y-2 flex flex-col">
              <label className="text-sm font-medium">Export as</label>
              <Select value={strategy} onValueChange={setStrategy}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an export strategy" />
                </SelectTrigger>
                <SelectContent>
                  {strategies.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </PageBlock>
      </PageLayout>
    </Page>
  );
}

export const orderExportRoute: DashboardRouteDefinition = {
  navMenuItem: {
    sectionId: 'sales',
    id: 'export-orders',
    url: '/order-export',
    title: 'Export orders',
  },
  path: '/order-export',
  loader: () => ({
    breadcrumb: 'Export orders',
  }),
  component: OrderExportPageComponent,
};
