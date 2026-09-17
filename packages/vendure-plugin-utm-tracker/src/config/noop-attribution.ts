import { AttributionModel, AttributionResult } from '../types';

/**
 * Collects tracking parameters without attributing any order value.
 */
export class NoopAttribution implements AttributionModel {
  name = 'No attribution';
  skipAttribution = true;

  /**
   * Returns no attribution results because persistence is skipped for this model.
   */
  calculateAttribution(): AttributionResult[] {
    return [];
  }
}
