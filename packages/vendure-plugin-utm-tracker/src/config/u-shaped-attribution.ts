import { UtmOrderParameter } from '../entities/utm-order-parameter.entity';
import { AttributionModel, AttributionResult } from '../types';

/**
 * U-shaped attribution assigns higher weight to the oldest and newest parameters, and lower weight to the middle parameters.
 * The first and last click receive 40%, and the remaining parameters share the remaining 20%.
 */
export class UShapedAttribution implements AttributionModel {
  name = 'U-Shaped Attribution';

  calculateAttribution(
    utmParameters: UtmOrderParameter[]
  ): AttributionResult[] {
    if (utmParameters.length === 0) {
      return [];
    }

    // If only one parameter, give it 100%
    if (utmParameters.length === 1) {
      return [
        {
          utmParameterId: utmParameters[0].id,
          attributionPercentage: 1,
        },
      ];
    }

    // U-shaped attribution: first and last click get 40%, middle parameters share remaining 20%
    const firstAndLastClickPercentage = 0.4; // 40% for first and last click
    const remainingPercentage = 0.2; // 20% for middle parameters

    // If only 2 parameters, give them 50% each (both are first and last)
    if (utmParameters.length === 2) {
      return [
        {
          utmParameterId: utmParameters[0].id, // newest (last click)
          attributionPercentage: 0.5,
        },
        {
          utmParameterId: utmParameters[1].id, // oldest (first click)
          attributionPercentage: 0.5,
        },
      ];
    }

    // Calculate percentages for each parameter in order (newest to oldest)
    const middleParameterCount = utmParameters.length - 2;
    const middlePercentage = remainingPercentage / middleParameterCount;

    return utmParameters.map((param, index) => {
      let percentage: number;

      if (index === 0) {
        // Last click (newest, index 0) gets 40%
        percentage = firstAndLastClickPercentage;
      } else if (index === utmParameters.length - 1) {
        // First click (oldest, last index) gets 40%
        percentage = firstAndLastClickPercentage;
      } else {
        // Middle parameters share the remaining 20%
        percentage = middlePercentage;
      }

      return {
        utmParameterId: param.id,
        attributionPercentage: percentage,
      };
    });
  }
}
