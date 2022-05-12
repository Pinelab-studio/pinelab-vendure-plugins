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
    },
    {
      name: 'pickupLocationCarrier',
      type: 'string',
      public: true,
      nullable: true,
    },
    {
      name: 'pickupLocationName',
      type: 'string',
      public: true,
      nullable: true,
    },
    {
      name: 'pickupLocationStreet',
      type: 'string',
      public: true,
      nullable: true,
    },
    {
      name: 'pickupLocationHouseNumber',
      type: 'string',
      public: true,
      nullable: true,
    },
    {
      name: 'pickupLocationZipcode',
      type: 'string',
      public: true,
      nullable: true,
    },
    {
      name: 'pickupLocationCity',
      type: 'string',
      public: true,
      nullable: true,
    },
    {
      name: 'pickupLocationCountry',
      type: 'string',
      public: true,
      nullable: true,
    },
  ],
};
