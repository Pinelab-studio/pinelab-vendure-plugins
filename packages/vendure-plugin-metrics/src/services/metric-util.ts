import { addMonths, isBefore } from 'date-fns';
import { AdvancedMetricSeries } from '../ui/generated/graphql';

interface EntitiesPerMonth<T> {
  monthNr: number;
  year: number;
  entities: T[];
}

// Categorize the datapoints per Legend name,
export type DataPointsPerLegend = Map<string, number[]>;

export function getMonthName(monthNr: number): string {
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return monthNames[monthNr];
}

/**
 * Categorize loaded entities per month
 */
export function groupEntitiesPerMonth<T>(
  entities: T[],
  sortableField: 'createdAt' | 'updatedAt' | 'orderPlacedAt',
  from: Date,
  to: Date
): EntitiesPerMonth<T>[] {
  // Helper function to construct yearMonth as identifier. E.g. "2021-01"
  const getYearMonth = (date: Date) =>
    `${date.getFullYear()}-${date.getMonth()}`;
  const entitiesPerMonth = new Map<string, EntitiesPerMonth<T>>();
  // Populate the map with all months in the range
  for (let i = from; isBefore(i, to); i = addMonths(i, 1)) {
    const yearMonth = getYearMonth(i);
    entitiesPerMonth.set(yearMonth, {
      monthNr: i.getMonth(),
      year: i.getFullYear(),
      entities: [], // Will be populated below
    });
  }
  // Loop over each item and categorize it in the correct month
  entities.forEach((entity) => {
    const date = (entity as any)[sortableField] as Date;
    if (!(date instanceof Date) || isNaN(date as any)) {
      throw Error(
        `${date} is not a valid date! Can not split ${entities.constructor.name}'s in months.`
      );
    }
    const yearMonth = getYearMonth(date);
    const entry = entitiesPerMonth.get(yearMonth);
    if (!entry) {
      // Should never happen, but type safety
      return;
    }
    entry.entities.push(entity);
    entitiesPerMonth.set(yearMonth, entry);
  });
  return Array.from(entitiesPerMonth.values());
}

/**
 * Map the data points per month map to the AdvancedMetricSeries array
 */
export function mapToSeries(
  dataPointsPerMonth: DataPointsPerLegend
): AdvancedMetricSeries[] {
  const series: AdvancedMetricSeries[] = [];
  dataPointsPerMonth.forEach((dataPoints, name) => {
    series.push({
      name,
      values: dataPoints,
    });
  });
  return series;
}
