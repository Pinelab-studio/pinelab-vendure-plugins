import { UtmOrderParameter } from '../entities/utm-order-parameter.entity';
import { AttributionModel, AttributionResult } from '../types';

/**
 * Time Decay Attribution:
 * - Newer touches get higher weight than older touches.
 * - We use exponential decay over days since `connectedAt` (fallback `createdAt`).
 * - Weight = exp(-lambda * ageInDays). Default lambda chosen to halve roughly every 7 days.
 */
export class TimeDecayAttribution implements AttributionModel {
  name = 'Time Decay Attribution';

  /**
   * Lambda tuned so that weight halves approximately every 7 days.
   * halfLifeDays = ln(2) / lambda  => lambda = ln(2) / halfLifeDays
   */
  private readonly lambda = Math.log(2) / 7; // ~weekly half-life

  calculateAttribution(
    utmParameters: UtmOrderParameter[]
  ): AttributionResult[] {
    if (utmParameters.length === 0) {
      return [];
    }

    const now = Date.now();
    const weights = utmParameters.map((p) => {
      const date = (p.connectedAt ?? p.createdAt) as unknown as Date | string;
      const ts =
        typeof date === 'string' ? Date.parse(date) : date?.getTime?.() ?? now;
      const ageDays = Math.max(0, (now - ts) / (1000 * 60 * 60 * 24));
      return Math.exp(-this.lambda * ageDays);
    });

    const total = weights.reduce((sum, w) => sum + w, 0);
    if (total === 0) {
      // Fallback to equal split if all timestamps are invalid or identical causing zero total
      return utmParameters.map((param) => ({
        utmParameterId: param.id,
        attributionPercentage:
          Math.round((1 / utmParameters.length) * 10000) / 10000,
      }));
    }
    return utmParameters.map((param, idx) => ({
      utmParameterId: param.id,
      attributionPercentage: Math.round((weights[idx] / total) * 10000) / 10000,
    }));
  }
}
