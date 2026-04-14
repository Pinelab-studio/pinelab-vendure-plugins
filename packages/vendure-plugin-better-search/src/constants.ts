import { FlexSearchEngine } from './config/flexsearch-engine';

export const BETTER_SEARCH_PLUGIN_OPTIONS = Symbol(
  'BETTER_SEARCH_PLUGIN_OPTIONS'
);
export const loggerCtx = 'BetterSearchPlugin';

export const engine = new FlexSearchEngine();
