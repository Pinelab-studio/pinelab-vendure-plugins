import { ID } from '@vendure/core';

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
