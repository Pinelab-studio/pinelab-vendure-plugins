import { describe, expect, it } from 'vitest';
import { validateMetricChart } from './util';

describe('validateMetricChart', () => {
  it('Accepts a valid chart', () => {
    const chart = {
      title: 'Revenue',
      type: 'line',
      data: { labels: ['Jan'], datasets: [{ data: [1] }] },
      valueFormat: 'currency',
    };
    expect(validateMetricChart(chart)).toBe(chart);
  });

  it('Rejects a missing chart', () => {
    expect(() => validateMetricChart(undefined)).toThrow(
      'Chart must be an object',
    );
  });

  it('Rejects a chart without title', () => {
    expect(() =>
      validateMetricChart({ type: 'line', data: { datasets: [] } }),
    ).toThrow(`Chart must have a 'title'`);
  });

  it('Rejects a chart without type', () => {
    expect(() =>
      validateMetricChart({ title: 'Revenue', data: { datasets: [] } }),
    ).toThrow(`Chart must have a Chart.js 'type'`);
  });

  it('Rejects a chart without datasets', () => {
    expect(() =>
      validateMetricChart({ title: 'Revenue', type: 'line', data: {} }),
    ).toThrow(`Chart must have Chart.js 'data' with a 'datasets' array`);
  });

  it('Rejects an unknown value format', () => {
    expect(() =>
      validateMetricChart({
        title: 'Revenue',
        type: 'line',
        data: { datasets: [] },
        valueFormat: 'percentage',
      }),
    ).toThrow(`Chart 'valueFormat' must be 'currency' or 'number'`);
  });
});
