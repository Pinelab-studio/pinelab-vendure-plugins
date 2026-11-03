import { schemaInfo } from 'virtual:admin-api-schema';
import { defineDashboardExtension } from '@vendure/dashboard';
import { MetricWidget } from './MetricWidget';

/**
 * The plugin adds a `MetricCode` enum with the configured metric codes to the Admin API schema.
 * The dashboard build exposes the schema, so we can register a widget per configured metric.
 */
const metricCodes: string[] = schemaInfo.enums.MetricCode ?? [];
if (!metricCodes.length) {
  console.warn(
    `[MetricsPlugin] No 'MetricCode' enum found in the Admin API schema: no metric widgets are registered`,
  );
}

/**
 * Turns a code like 'units_sold' into 'Units sold'
 */
function toWidgetName(code: string): string {
  const name = code.replace(/[_-]+/g, ' ').trim();
  return name.charAt(0).toUpperCase() + name.slice(1);
}

defineDashboardExtension({
  widgets: metricCodes.map((code) => ({
    id: `pinelab-metric-${code}`,
    name: toWidgetName(code),
    component: (props) => <MetricWidget {...props} code={code} />,
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 3, h: 3 },
    requiresPermissions: ['ReadOrder'],
  })),
});
