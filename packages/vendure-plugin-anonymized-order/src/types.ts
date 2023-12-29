import { Order } from '@vendure/core';

export type AnonymizeOrderFn = (order: Order) => void;

export interface AnonymizeOrderPluginOptions {
  anonymizeOrderFn?: AnonymizeOrderFn;
}
