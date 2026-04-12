import fetch from 'node-fetch';
import { Response } from 'node-fetch';
import { Logger } from '@vendure/core';
import { loggerCtx } from './constants';
import { Parcel, ParcelInput } from './types/sendcloud-api.types';

export class SendcloudClient {
  endpoint = 'https://panel.sendcloud.sc/api/v2';
  headers: { [key: string]: string };

  constructor(private publicKey: string, private secret: string) {
    this.headers = {
      'Content-Type': 'application/json',
      Authorization:
        'Basic ' +
        Buffer.from(`${this.publicKey}:${this.secret}`).toString('base64'),
    };
  }

  async createParcel(parcelInput: ParcelInput): Promise<Parcel> {
    const body = { parcel: parcelInput };
    const res = await this.fetch('parcels', body);
    if (!res.ok) {
      throw Error(res.statusText);
    }
    const json = (await res.json()) as any;
    Logger.info(
      `Created parcel in SendCloud with for order ${parcelInput.order_number}  with id ${json.parcel?.id}`,
      loggerCtx
    );
    return json.parcel;
  }

  async fetch(path: string, body: any): Promise<Response> {
    const res = await fetch(`${this.endpoint}/${path}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const json = (await res.json()) as any;
      throw Error(`${res.statusText}: ${json.error?.message}`);
    }
    return res;
  }
}
