import { CustomFields } from '@vendure/core';
export interface PickupPointCustomFields {
  pickupLocationNumber?: string;
  pickupLocationCarrier?: string;
  pickupLocationName?: string;
  pickupLocationStreet?: string;
  pickupLocationHouseNumber?: string;
  pickupLocationZipcode?: string;
  pickupLocationCity?: string;
  pickupLocationCountry?: string;
}

export const customFields: CustomFields = {
  Order: [
    {
      name: 'pickupLocationNumber',
      type: 'string',
      public: true,
      nullable: true,
      ui: { tab: 'pickup' },
    },
    {
      name: 'pickupLocationCarrier',
      type: 'string',
      public: true,
      nullable: true,
      ui: { tab: 'pickup' },
    },
    {
      name: 'pickupLocationName',
      type: 'string',
      public: true,
      nullable: true,
      ui: { tab: 'pickup' },
    },
    {
      name: 'pickupLocationStreet',
      type: 'string',
      public: true,
      nullable: true,
      ui: { tab: 'pickup' },
    },
    {
      name: 'pickupLocationHouseNumber',
      type: 'string',
      public: true,
      nullable: true,
      ui: { tab: 'pickup' },
    },
    {
      name: 'pickupLocationZipcode',
      type: 'string',
      public: true,
      nullable: true,
      ui: { tab: 'pickup' },
    },
    {
      name: 'pickupLocationCity',
      type: 'string',
      public: true,
      nullable: true,
      ui: { tab: 'pickup' },
    },
    {
      name: 'pickupLocationCountry',
      type: 'string',
      public: true,
      nullable: true,
      ui: { tab: 'pickup' },
    },
  ],
};
