import {
  api,
  Button,
  DateRangePicker,
  DefinedDateRange,
  Label,
  LS_KEY_SELECTED_CHANNEL_TOKEN,
  LS_KEY_SESSION_TOKEN,
  Page,
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
import { getApiBaseUrl } from '@/vdb/utils/config-utils.js';
import { useQuery } from '@tanstack/react-query';
import { endOfDay, startOfMonth } from 'date-fns';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const StrategiesQuery = graphql(`
  query availableOrderExportStrategies {
    availableOrderExportStrategies
  }
`);

export function OrderExportComponent() {
  const [dateRange, setDateRange] = useState<DefinedDateRange>({
    from: startOfMonth(new Date()),
    to: endOfDay(new Date()),
  });
  const [strategy, setStrategy] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  const { data } = useQuery({
    queryKey: ['availableOrderExportStrategies'],
    queryFn: () => api.query(StrategiesQuery),
  });
  const strategies = data?.availableOrderExportStrategies ?? [];

  useEffect(() => {
    if (strategies.length && !strategy) {
      setStrategy(strategies[0]);
    }
  }, [strategies]);

  async function handleDownload() {
    setIsDownloading(true);
    try {
      const headers: Record<string, string> = {};
      const channelToken = localStorage.getItem(LS_KEY_SELECTED_CHANNEL_TOKEN);
      if (channelToken) headers['vendure-token'] = channelToken;
      const sessionToken = localStorage.getItem(LS_KEY_SESSION_TOKEN);
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const url =
        `${getApiBaseUrl()}/export-orders/export/${strategy}` +
        `?startDate=${dateRange.from.toISOString()}&endDate=${dateRange.to.toISOString()}`;

      const res = await fetch(url, { credentials: 'include', headers });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.message);
      }
      const contentDisposition = res.headers.get('Content-Disposition') ?? '';
      const filename =
        contentDisposition.split(';')[1]?.split('=')?.[1] ?? 'export';
      const blobUrl = window.URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement('a'), {
        href: blobUrl,
        download: filename,
      });
      a.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      toast.error(err.message ?? 'Export failed');
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Page pageId="order-export">
      <PageTitle>Export orders</PageTitle>
      <PageLayout>
        <PageBlock column="main" blockId="export-form">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Date range</Label>
              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
            </div>
            <div className="space-y-2">
              <Label>Export as</Label>
              <Select value={strategy} onValueChange={setStrategy}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Select a strategy" />
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
            <Button
              onClick={handleDownload}
              disabled={!strategy || isDownloading}
            >
              {isDownloading ? 'Exporting...' : 'Export'}
            </Button>
          </div>
        </PageBlock>
      </PageLayout>
    </Page>
  );
}
