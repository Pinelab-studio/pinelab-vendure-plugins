import { CustomFieldConfig } from '@vendure/core';

export const orderLineCustomFields: CustomFieldConfig[] = [
  {
    name: 'isSelectedAsGift',
    type: 'boolean',
    readonly: true, // Should only be writeable via TS code
    public: true, // We need it to display if an item was added as gift in the current order
    internal: false,
  },
];
