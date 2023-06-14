export type Id = string | number;

export type VendureOrderEvent = ItemEvent | CouponEvent;

export interface ItemEvent {
  productVariantIds: Id[];
  quantity: number;
}

export interface CouponEvent {
  couponCode: string;
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type VendureOrderEvents = {
  'item-added': ItemEvent;
  'item-removed': ItemEvent;
  'coupon-code-applied': CouponEvent;
  'coupon-code-removed': CouponEvent;
};
