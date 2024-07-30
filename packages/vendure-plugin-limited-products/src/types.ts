import { ID } from '@vendure/core';
//eslint-disable-next-line @typescript-eslint/no-unused-vars
import { CustomProductFields } from '@vendure/core/dist/entity/custom-entity-fields';

declare module '@vendure/core' {
  interface CustomProductFields {
    maxPerOrder?: string[];
    onlyAllowPer?: string[];
  }
}

export type ChannelAwareIntValue = {
  channelId: ID;
  value: number;
};
