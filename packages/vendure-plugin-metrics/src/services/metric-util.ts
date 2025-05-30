import {
  addMonths,
  isBefore,
  isSameMonth,
  isSameYear,
  startOfMonth,
} from 'date-fns';
import { AdvancedMetricSeries } from '../ui/generated/graphql';
import { MetricRequest } from '../entities/metric-request.entity';
import { Session } from './request-service';

interface EntitiesPerMonth<T> {
  monthNr: number;
  year: number;
  date: Date;
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
export function groupEntitiesPerMonth<T, K extends keyof T>(
  entities: T[],
  sortableField: K,
  from: Date,
  to: Date
): EntitiesPerMonth<T>[] {
  // Helper function to construct yearMonth as identifier. E.g. "2021-1"
  const getYearMonth = (date: Date) =>
    `${date.getFullYear()}-${date.getMonth()}`;

  const entitiesPerMonth = new Map<string, EntitiesPerMonth<T>>();
  // Populate the map with all months in the range
  let currentDate = startOfMonth(from);
  while (isBefore(currentDate, to)) {
    const yearMonth = getYearMonth(currentDate);
    entitiesPerMonth.set(yearMonth, {
      monthNr: currentDate.getMonth(),
      year: currentDate.getFullYear(),
      date: currentDate,
      entities: [],
    });
    currentDate = addMonths(currentDate, 1);
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
 * Get entities from a list for given month and year
 */
export function getEntitiesForMonth<T, K extends keyof T>(
  entities: T[],
  date: Date,
  dateFilterField: K
): T[] {
  return entities.filter((entity) => {
    const entityDate = (entity as any)[dateFilterField] as Date;
    return isSameMonth(entityDate, date) && isSameYear(entityDate, date);
  });
}
/**
 * Map the data points per month map to the AdvancedMetricSeries array.
 *
 * E.g. `'product1', [10, 20, 30]` becomes
 * `[{ name: 'product1', values: [10, 20, 30] }]`
 * This is used to display the data in the chart.
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

/**
 * Aggregates the raw requests to sessions, grouping them by identifier and session length.
 *
 * E.g. multiple requests from id:123 within 5 minutes are combined into 1 session
 *
 */
export function getSessions(
  requests: MetricRequest[],
  sessionLengthInMinutes: number
): Session[] {
  const sessions: Session[] = [];
  const sessionLengthInMs = sessionLengthInMinutes * 60 * 1000;

  // Group requests by identifier
  const requestsByIdentifier = requests.reduce((map, request) => {
    const group = map.get(request.identifier) || [];
    group.push(request);
    map.set(request.identifier, group);
    return map;
  }, new Map<string, MetricRequest[]>());

  // Combine requests within the same session length into one session
  for (const [identifier, groupedRequests] of requestsByIdentifier) {
    // Sort requests by timestamp
    groupedRequests.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
    let currentSession: Session | null = null;

    for (const request of groupedRequests) {
      const isWithinSession =
        currentSession &&
        request.createdAt.getTime() - currentSession.start.getTime() <=
          sessionLengthInMs;
      if (sessionLengthInMs && isWithinSession && currentSession) {
        // Extend the current session if the request is within the same session
        currentSession.end = request.createdAt;
      } else {
        // Start a new session
        if (currentSession) {
          sessions.push(currentSession);
        }
        currentSession = {
          identifier,
          start: request.createdAt,
          end: request.createdAt,
          deviceType: request.deviceType,
        };
      }
    }
    // Push the last session
    if (currentSession) {
      sessions.push(currentSession);
    }
  }
  return sessions;
}
