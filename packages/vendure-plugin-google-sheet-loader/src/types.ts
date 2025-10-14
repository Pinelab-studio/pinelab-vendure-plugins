import { Injector, RequestContext } from '@vendure/core';

/**
 * @description
 * The plugin can be configured using the following options:
 */
export interface GoogleSheetLoaderPluginOptions {
  strategies: GoogleSheetDataStrategy[];
  googleApiKey: string;
}

/**
 * Defines what sheet and what tabs to load from a Google spreadsheet
 */
export interface SheetMetadata {
  sheets: string[];
  spreadSheetId: string;
}

/**
 * The actual content of a tab or multiple tabs in a google spreadsheet
 */
export interface SheetContent {
  sheetName: string;
  data: string[][];
}

/**
 * Interface that defines how to handle Google Sheet loading per channel
 */
export interface GoogleSheetDataStrategy {
  /**
   * Unique identifier for the strategy.
   */
  code: string;
  /**
   * Get the sheet url and sheets (tabs) based on given context. If your strategy returns false, no action will be taken for this channel.
   */
  getSheetMetadata: (ctx: RequestContext) => SheetMetadata | false;

  /**
   * Validate the data in the sheets before it is handled. This gives you the opportunity to notify the admin user that triggered the loading process.
   * If the validation fails, you can return a string with the error message.
   * If the validation succeeds, you can return true.
   */
  validateSheetData: (
    ctx: RequestContext,
    sheets: SheetContent[]
  ) => Promise<boolean | string> | boolean | string;

  /**
   * Handle the actual content of the sheets. For example, you can sync products.
   * You should return a string with the result of the handling. Can be anything you want.
   */
  handleSheetData: (
    ctx: RequestContext,
    injector: Injector,
    sheets: SheetContent[]
  ) => Promise<string>;
}
