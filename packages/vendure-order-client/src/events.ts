export type Id = string | number;

export type VendureOrderEvent = ItemEvent; // TODO | PaymentEvent | FulfillmentEvent etc

export interface ItemEvent {
  productVariantIds: Id[];
  quantity: number;
}

export type VendureOrderEvents = {
  'item-added': ItemEvent;
  'item-removed': ItemEvent;
};
