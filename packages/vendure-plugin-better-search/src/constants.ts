import { MinisearchEngine } from './config/minisearch-engine';
import { SearchEngine } from './types';

export const BETTER_SEARCH_PLUGIN_OPTIONS = Symbol(
  'BETTER_SEARCH_PLUGIN_OPTIONS'
);
export const loggerCtx = 'BetterSearchPlugin';

export const engine: SearchEngine = new MinisearchEngine();
