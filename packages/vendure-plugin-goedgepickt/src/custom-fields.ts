import { CustomFields } from '@vendure/core';
import {
  CustomFieldConfig,
  Injector,
  LanguageCode,
  Logger,
  RequestContext,
} from '@vendure/core';
import { Product } from '@vendure/core';
import {
  CustomChannelFields,
  CustomOrderFields,
} from '@vendure/core/dist/entity/custom-entity-fields';
import { loggerCtx } from './constants';
import { goedgepicktPermission } from './api/goedgepickt.resolver';
import { GoedgepicktService } from './api/goedgepickt.service';
import nock from 'nock';

declare module '@vendure/core' {
  interface CustomOrderFields {
    pickupLocationNumber?: string;
    pickupLocationCarrier?: string;
    pickupLocationName?: string;
    pickupLocationStreet?: string;
    pickupLocationHouseNumber?: string;
    pickupLocationZipcode?: string;
    pickupLocationCity?: string;
    pickupLocationCountry?: string;
  }
  interface CustomChannelFields {
    ggEnabled?: boolean;
    ggUuidApiKey?: string;
  }
}

export const orderCustomFields: CustomFieldConfig[] = [
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
];

const uiTab = 'GoedGepickt';

export const channelCustomFields: CustomFieldConfig[] = [
  {
    name: 'ggEnabled',
    type: 'boolean',
    public: false,
    label: [{ languageCode: LanguageCode.en, value: 'Enabled' }],
    requiresPermission: goedgepicktPermission.Permission,
    ui: {
      tab: uiTab,
    },
  },
  {
    name: 'ggUuidApiKey',
    type: 'text',
    public: false,
    validate,
    label: [{ languageCode: LanguageCode.en, value: 'UUID and ApiKey' }],
    description: [
      {
        languageCode: LanguageCode.en,
        value:
          'Webshop UUID and ApiKey separated by colon, e.g. "uuid1234:apikey1234"',
      },
    ],
    requiresPermission: goedgepicktPermission.Permission,
    ui: {
      tab: uiTab,
      component: 'textarea-form-input',
      spellcheck: false,
    },
  },
];

/**
 * Validate if ApiKey is valid, and if a webshop with given UUID exists
 */
async function validate(
  value: any,
  injector: Injector,
  ctx: RequestContext
): Promise<string | undefined> {
  if (typeof value !== 'string') {
    return 'Must be a string';
  }
  const [uuid, apiKey] = value.split(':');
  if (!uuid || !apiKey) {
    return 'Must be in the format "uuid1234:apiKey4567"';
  }
  if (process.env.VITEST_WORKER_ID) {
    // For some reason Nock can not mock this request, so we disable it for e2e test
    return;
  }
  const result = await fetch('https://account.goedgepickt.nl/api/v1/webshops', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    redirect: 'follow',
  });
  if (result.status !== 200) {
    return `Invalid ApiKey: ${result.status} (${result.statusText})`;
  }
  const json: any = await result.json();
  const webshop = json.items?.find((item: any) => item.uuid === uuid);
  if (!webshop) {
    return 'Apikey is correct, but cannot find webshopUuid';
  }
  Logger.info(
    `Saved correct UUID and ApiKey for webshop '${webshop.name}' for channel '${ctx.channel.token}`,
    loggerCtx
  );
  await injector
    .get(GoedgepicktService)
    .setWebhooks(ctx)
    .catch((err) => {
      Logger.error(
        `Failed to set webhooks for channel '${ctx.channel.token}' after saving credentials: ${err.message}`,
        loggerCtx
      );
    });
}
