import { Order } from '@vendure/core';

type OrderWithPlacedAt = Pick<Order, 'orderPlacedAt'>;

/**
 * @description
 * Calculate the conversion rate of the given set of orders.
 * Orders with a orderPlacedAt date are considered placed, all others
 */
export function calculateConversion(orders: Array<OrderWithPlacedAt>): number {
  const completedOrders = orders.filter((order) => order.orderPlacedAt);
  return completedOrders.length / orders.length;
}

/**
 * @description
 * Calculate the total revenue of the given set of orders.
 */
export function calculateRevenue(orders: Array<Pick<Order, 'total'>>): number {
  return orders.reduce((total, order) => total + order.total, 0);
}

export function getOrdersPlacedInLastXDays<T extends OrderWithPlacedAt>(
  orders: Array<T>,
  nrOfDays: number
): Array<T> {
  const xDaysAgo = new Date();
  xDaysAgo.setDate(xDaysAgo.getDate() - nrOfDays);
  return orders.filter((order) => (order.orderPlacedAt ?? 0) > xDaysAgo);
}
