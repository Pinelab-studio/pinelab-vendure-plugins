import { OramaQPSEngine } from './config/orama-qps-engine';

export const BETTER_SEARCH_PLUGIN_OPTIONS = Symbol(
  'BETTER_SEARCH_PLUGIN_OPTIONS'
);
export const loggerCtx = 'BetterSearchPlugin';

export const engine = new OramaQPSEngine();
