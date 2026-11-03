import path from 'node:path';
import {
  DefaultLogger,
  DefaultSearchPlugin,
  LogLevel,
  mergeConfig,
  VendureConfig,
} from '@vendure/core';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { testConfig } from '@vendure/testing';
import { testPaymentMethod } from '../../test/src/test-payment-method';
import {
  defaultMetrics,
  MetricChart,
  MetricStrategy,
  MetricsPlugin,
} from '../src';

/**
 * Tracks calls of the test metrics, so tests can verify strategies run sequentially
 */
export const testMetricState = {
  inFlight: 0,
  maxInFlight: 0,
  calls: 0,
  run: 1,
  failing: false,
};

/**
 * Takes a short time per variation, to detect if strategies run in parallel
 */
async function trackCall(createChart: () => MetricChart): Promise<MetricChart> {
  testMetricState.calls++;
  testMetricState.inFlight++;
  testMetricState.maxInFlight = Math.max(
    testMetricState.maxInFlight,
    testMetricState.inFlight,
  );
  await new Promise((resolve) => setTimeout(resolve, 50));
  testMetricState.inFlight--;
  return createChart();
}

/**
 * Channel independent test metric with 2 variations
 */
export class SequentialTestMetric implements MetricStrategy {
  readonly code = 'test_sequential';
  readonly perChannel = false;

  getChartVariations(): string[] {
    return ['Variation A', 'Variation B'];
  }

  loadChart(_ctx: unknown, _injector: unknown, variation?: string) {
    return trackCall(() => ({
      title: `${variation} run ${testMetricState.run}`,
      type: 'bar',
      data: { labels: ['x'], datasets: [{ label: 'x', data: [1] }] },
    }));
  }
}

/**
 * Per channel test metric without variations, that throws when `testMetricState.failing` is set
 */
export class FailingTestMetric implements MetricStrategy {
  readonly code = 'test_failing';
  readonly perChannel = true;

  loadChart() {
    return trackCall(() => {
      if (testMetricState.failing) {
        throw Error('Test metric failed');
      }
      return {
        title: `Failing metric run ${testMetricState.run}`,
        type: 'pie',
        data: { labels: ['x'], datasets: [{ data: [1] }] },
      };
    });
  }
}

export const config: VendureConfig = mergeConfig(testConfig, {
  logger: new DefaultLogger({ level: LogLevel.Info }),
  apiOptions: {
    adminApiPlayground: {},
    shopApiPlayground: {},
  },
  authOptions: {
    tokenMethod: ['cookie', 'bearer'],
  },
  paymentOptions: {
    paymentMethodHandlers: [testPaymentMethod],
  },
  plugins: [
    MetricsPlugin.init({
      metrics: [
        ...defaultMetrics,
        new SequentialTestMetric(),
        new FailingTestMetric(),
      ],
    }),
    DefaultSearchPlugin,
    DashboardPlugin.init({
      // Should correspond to `base` and `build.outDir` in vite.config.mts
      route: 'dashboard',
      appDir: path.join(__dirname, '../dist/dashboard'),
    }),
  ],
});
