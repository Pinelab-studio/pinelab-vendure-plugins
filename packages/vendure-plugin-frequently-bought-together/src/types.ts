/**
 * @description
 * The plugin can be configured using the following options:
 */
export interface PluginInitOptions {
  /**
   * The maximum number of related products that are automatically added.
   * Manual selection can exceed this limit
   */
  maxRelatedProducts: number;
  /**
   * Defines in what tab the custom field should be displayed in the admin UI.
   * Can be an existing tab.
   */
  customFieldUiTab: string;
}
