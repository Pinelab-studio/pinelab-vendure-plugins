import { UtmOrderParameter } from '../entities/utm-order-parameter.entity';
import { AttributionModel, AttributionResult } from '../types';

export class LastClickAttribution implements AttributionModel {
  name = 'Last Click';
  calculateAttribution(
    utmParameters: UtmOrderParameter[]
  ): AttributionResult[] {
    if (utmParameters.length === 0) {
      return [];
    }
    // Last click attribution gives 100% to the most recent parameter
    const mostRecent = utmParameters[0];
    return [
      {
        utmParameterId: mostRecent.id,
        attributionPercentage: 1,
      },
    ];
  }
}
