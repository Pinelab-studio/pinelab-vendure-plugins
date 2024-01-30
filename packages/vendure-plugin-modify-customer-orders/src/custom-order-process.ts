import { OrderProcess } from '@vendure/core';

export const convertToDraft: OrderProcess<'AddingItems'> = {
  transitions: {
    AddingItems: {
      to: ['Draft'],
      mergeStrategy: 'merge',
    },
  },
};
