export type Id = string | number;

export interface ItemEvent {
  productVariantId: Id;
  quantity: number;
}

export type VendureOrderEvents = {
  'item-added': ItemEvent;
  'item-removed': ItemEvent;
};
