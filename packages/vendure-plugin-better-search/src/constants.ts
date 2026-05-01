import { FlexSearchEngine } from './config/flexsearch-engine';
import { OramaBM25Engine } from './config/orama-bm25-engine';
import { OramaHybridSemanticEngine } from './config/orama-hybrid-semantic-engine';

export const BETTER_SEARCH_PLUGIN_OPTIONS = Symbol(
  'BETTER_SEARCH_PLUGIN_OPTIONS'
);
export const loggerCtx = 'BetterSearchPlugin';

export const engine = new OramaHybridSemanticEngine();
