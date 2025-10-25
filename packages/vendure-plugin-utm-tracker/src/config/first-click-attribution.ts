import { UtmOrderParameter } from '../entities/utm-order-parameter.entity';
import { AttributionModel, AttributionResult } from '../types';

export class FirstClickAttribution implements AttributionModel {
  name = 'First Click';
  calculateAttribution(
    utmParameters: UtmOrderParameter[]
  ): AttributionResult[] {
    if (utmParameters.length === 0) {
      return [];
    }
    // First click attribution gives 100% to the oldest parameter
    const oldest = utmParameters[0];
    return [
      {
        utmParameterId: oldest.id,
        attributionPercentage: 1,
      },
    ];
  }
}
