import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Dashboard extension', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('Registers a widget per metric code in the Admin API schema', async () => {
    const extension = await loadExtension(['revenue', 'units_sold']);
    expect(
      extension.widgets.map((w) => ({
        id: w.id,
        name: w.name,
        requiresPermissions: w.requiresPermissions,
      })),
    ).toEqual([
      {
        id: 'pinelab-metric-revenue',
        name: 'Revenue',
        requiresPermissions: ['ReadOrder'],
      },
      {
        id: 'pinelab-metric-units_sold',
        name: 'Units sold',
        requiresPermissions: ['ReadOrder'],
      },
    ]);
  });

  it('Registers no widgets and warns when the MetricCode enum is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const extension = await loadExtension(undefined);
    expect(extension.widgets).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });
});

/**
 * Load the dashboard extension with the given `MetricCode` enum values in the schema,
 * and return what it passed to `defineDashboardExtension`.
 */
async function loadExtension(metricCodes: string[] | undefined) {
  const defineDashboardExtension = vi.fn();
  vi.doMock('@vendure/dashboard', () => ({ defineDashboardExtension }));
  vi.doMock('./MetricWidget', () => ({ MetricWidget: () => null }));
  vi.doMock('virtual:admin-api-schema', () => ({
    schemaInfo: { enums: metricCodes ? { MetricCode: metricCodes } : {} },
  }));
  await import('./index');
  expect(defineDashboardExtension).toHaveBeenCalledOnce();
  return defineDashboardExtension.mock.calls[0][0] as {
    widgets: Array<{ id: string; name: string; requiresPermissions: string[] }>;
  };
}
