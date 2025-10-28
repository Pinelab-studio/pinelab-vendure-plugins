export interface StockMonitoringPluginOptions {
  /**
   * The global threshold for all variants. The plugin will emit an event when a variant's stock level drops below this threshold.
   *
   * If a variant has a threshold set, it will override this global threshold.
   */
  globalThreshold: number;
  /**
   * Under which tab to show the `Stock threshold` custom field per variant in the admin UI.
   */
  uiTab: string;
}
