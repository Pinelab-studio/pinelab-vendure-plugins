import { UtmOrderParameter } from '../entities/utm-order-parameter.entity';
import { AttributionModel, AttributionResult } from '../types';

export class LinearAttribution implements AttributionModel {
  name = 'Linear Attribution';
  calculateAttribution(
    utmParameters: UtmOrderParameter[]
  ): AttributionResult[] {
    if (utmParameters.length === 0) {
      return [];
    }
    // Linear attribution splits the attribution evenly between all parameters
    return utmParameters.map((param) => ({
      utmParameterId: param.id,
      attributionPercentage:
        Math.round((1 / utmParameters.length) * 10000) / 10000,
    }));
  }
}
