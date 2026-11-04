import { useQuery } from '@tanstack/react-query';
import {
  api,
  DashboardBaseWidget,
  type DashboardBaseWidgetProps,
  graphql,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useChannel,
  useLocalFormat,
} from '@vendure/dashboard';
import {
  type ChartConfiguration,
  Chart as ChartJS,
  registerables,
  type ScriptableContext,
} from 'chart.js';
import { color } from 'chart.js/helpers';
import { useMemo, useState } from 'react';
import { Chart } from 'react-chartjs-2';

ChartJS.register(...registerables);

const metricChartsQuery = graphql(`
  query MetricCharts($code: String!) {
    metricCharts(code: $code) {
      code
      variation
      title
      type
      data
      options
      valueFormat
      updatedAt
    }
  }
`);

/**
 * Shows the stored charts of a single metric, with a dropdown to switch between variations.
 */
export function MetricWidget({
  code,
  ...props
}: DashboardBaseWidgetProps & { code: string }) {
  const { activeChannel } = useChannel();
  const { formatCurrency, formatNumber, formatDate } = useLocalFormat();
  const [selectedVariation, setSelectedVariation] = useState<string>();
  const { data, isLoading } = useQuery({
    queryKey: ['pinelab-metric-charts', code, activeChannel?.id],
    queryFn: () => api.query(metricChartsQuery, { code }),
  });
  const charts = data?.metricCharts ?? [];
  const chart =
    charts.find((c) => c.variation === selectedVariation) ?? charts[0];

  // Formatting callbacks can't be stored, so they are added here based on `valueFormat`
  const config = useMemo(() => {
    if (!chart) {
      return undefined;
    }
    const format = (value: number | string) =>
      chart.valueFormat === 'currency'
        ? formatCurrency(
            Number(value),
            activeChannel?.defaultCurrencyCode ?? 'USD',
          )
        : formatNumber(Number(value));
    const options = chart.options ?? {};
    const hasAxes = chart.type === 'line' || chart.type === 'bar';
    return {
      type: chart.type,
      data:
        chart.type === 'line'
          ? {
              ...chart.data,
              datasets: chart.data.datasets.map((dataset, index) => {
                const lineColor =
                  dataset.borderColor ?? (index === 0 ? '#0ea5e9' : '#94a3b8');
                return {
                  tension: 0.4,
                  borderWidth: 1.5,
                  cubicInterpolationMode: 'monotone',
                  fill: true,
                  ...dataset,
                  borderColor: lineColor,
                  backgroundColor:
                    dataset.backgroundColor ??
                    (({ chart }: ScriptableContext<'line'>) => {
                      const { ctx, chartArea } = chart;
                      if (!chartArea || typeof lineColor !== 'string') {
                        return 'transparent';
                      }
                      const gradient = ctx.createLinearGradient(
                        0,
                        chartArea.top,
                        0,
                        chartArea.bottom,
                      );
                      gradient.addColorStop(
                        0,
                        color(lineColor).alpha(0.4).rgbString(),
                      );
                      gradient.addColorStop(
                        1,
                        color(lineColor).alpha(0).rgbString(),
                      );
                      return gradient;
                    }),
                };
              }),
            }
          : chart.data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...options,
        scales: hasAxes
          ? {
              ...options.scales,
              y: {
                ...options.scales?.y,
                ticks: { ...options.scales?.y?.ticks, callback: format },
              },
            }
          : options.scales,
        plugins: {
          ...options.plugins,
          tooltip: {
            ...options.plugins?.tooltip,
            callbacks: {
              label: (item: { dataset: { label?: string }; raw: unknown }) =>
                `${item.dataset.label ?? ''}: ${format(item.raw as number)}`,
            },
          },
        },
      },
    } as ChartConfiguration;
  }, [chart, formatCurrency, formatNumber, activeChannel]);

  return (
    <DashboardBaseWidget
      {...props}
      title={chart?.title ?? props.title}
      description={
        chart
          ? `Updated ${formatDate(chart.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })}`
          : undefined
      }
      actions={
        charts.length > 1 && chart?.variation ? (
          <Select value={chart.variation} onValueChange={setSelectedVariation}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {charts.map((c) => (
                <SelectItem key={c.variation} value={c.variation ?? ''}>
                  {c.variation}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : undefined
      }
    >
      {config ? (
        <div className="relative h-full w-full">
          <Chart
            key={JSON.stringify([code, activeChannel?.id, chart?.variation])}
            type={config.type}
            data={config.data}
            options={config.options}
          />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          {isLoading
            ? 'Loading...'
            : 'No data yet, charts are generated nightly.'}
        </p>
      )}
    </DashboardBaseWidget>
  );
}
