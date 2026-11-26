import { E2E_DEFAULT_CHANNEL_TOKEN } from '@vendure/testing';
import gql from 'graphql-tag';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initialData } from '../../test/src/initial-data';
import {
  CREATE_CONTENT_ENTRY,
  getField,
  getType,
  INTROSPECTION_QUERY,
  typeRefToString,
} from './simple-cms-helpers';
import { createCmsTestEnvironment } from './test-environment';

let environment: Awaited<ReturnType<typeof createCmsTestEnvironment>>;
let collections: Array<{ id: string }>;

beforeAll(async () => {
  environment = await createCmsTestEnvironment();
  await environment.server.init({
    initialData: { ...initialData, collections: [] },
  });
  const { adminClient } = environment;
  await adminClient.asSuperAdmin();
  const { activeChannel } = await adminClient.query(GET_CHANNEL);
  const defaultChannelId = activeChannel.id;
  await adminClient.query(ENABLE_LANGUAGES);
  await adminClient.query(UPDATE_CHANNEL_LANGUAGES, { id: defaultChannelId });
  collections = [];
  for (const [name, slug, dutchName, dutchSlug] of [
    ['Garden tools', 'garden-tools', 'Tuingereedschap', 'tuingereedschap'],
    ['Seeds', 'seeds', 'Zaden', 'zaden'],
    ['Plants', 'plants', 'Planten', 'planten'],
  ]) {
    const { createCollection } = await environment.adminClient.query(
      CREATE_COLLECTION,
      {
        input: {
          translations: [
            { languageCode: 'en', name, slug, description: '' },
            {
              languageCode: 'nl',
              name: dutchName,
              slug: dutchSlug,
              description: '',
            },
          ],
          filters: [],
        },
      },
    );
    collections.push(createCollection);
  }
}, 60000);

afterAll(async () => {
  await environment?.destroy();
}, 30000);

beforeEach(() => {
  environment.adminClient.setChannelToken(E2E_DEFAULT_CHANNEL_TOKEN);
  environment.shopClient.setChannelToken(E2E_DEFAULT_CHANNEL_TOKEN);
});

describe('Collection relation lists', () => {
  it('exposes required Collection lists and list metadata to API consumers', async () => {
    const { __schema } =
      await environment.shopClient.query(INTROSPECTION_QUERY);
    expect(
      typeRefToString(
        getField(getType(__schema, 'QuickFilter'), 'collections')?.type,
      ),
    ).toBe('[Collection!]!');
    const { simpleCmsContentType } =
      await environment.adminClient.query(GET_TYPE);
    expect(simpleCmsContentType.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'collections',
          type: 'relation',
          graphQLType: 'Collection',
          list: true,
        }),
        expect.objectContaining({ name: 'key', isTranslatable: false }),
        expect.objectContaining({ name: 'featuredCollection', list: false }),
      ]),
    );
  });

  it('persists ordered references, localizes names/slugs, and preserves single relations', async () => {
    const entry = await createQuickFilter([collections[1], collections[0]]);
    const { contentEntry } = await environment.adminClient.query(GET_ENTRY, {
      id: entry.id,
    });
    expect(contentEntry.fields).toEqual({
      key: 'home',
      collections: [collections[1], collections[0]],
      featuredCollection: collections[0],
    });
    for (const [languageCode, expected] of [
      [
        'en',
        [
          { ...collections[1], name: 'Seeds', slug: 'seeds' },
          { ...collections[0], name: 'Garden tools', slug: 'garden-tools' },
        ],
      ],
      [
        'nl',
        [
          { ...collections[1], name: 'Zaden', slug: 'zaden' },
          {
            ...collections[0],
            name: 'Tuingereedschap',
            slug: 'tuingereedschap',
          },
        ],
      ],
    ] as const) {
      const { quickFilter } = await environment.shopClient.query(
        GET_FILTER,
        { id: entry.id },
        { languageCode },
      );
      expect(quickFilter.key).toBe('home');
      expect(quickFilter.collections).toEqual(expected);
      expect(quickFilter.featuredCollection).toEqual(expected[1]);
    }
  });

  it('saves additions, removals, reordering and clearing without corrupting encoded IDs', async () => {
    const entry = await createQuickFilter([collections[0], collections[1]]);
    for (const references of [
      [collections[1], collections[2], collections[0]],
      [collections[2], collections[1]],
      [],
    ]) {
      await environment.adminClient.query(UPDATE_ENTRY, {
        id: entry.id,
        input: {
          contentTypeCode: 'quickFilter',
          fields: { key: 'home', collections: references },
        },
      });
      const { contentEntry } = await environment.adminClient.query(GET_ENTRY, {
        id: entry.id,
      });
      expect(contentEntry.fields.collections).toEqual(references);
      const { quickFilter } = await environment.shopClient.query(GET_FILTER, {
        id: entry.id,
      });
      expect(
        quickFilter.collections.map((collection: { id: string }) => ({
          id: collection.id,
        })),
      ).toEqual(references);
      expect(quickFilter.featuredCollection).toBeNull();
    }
  });

  it('omits deleted collections while retaining the order of surviving references', async () => {
    const { createCollection } = await environment.adminClient.query(
      CREATE_COLLECTION,
      {
        input: {
          translations: [
            {
              languageCode: 'en',
              name: 'Temporary',
              slug: 'temporary',
              description: '',
            },
          ],
          filters: [],
        },
      },
    );
    const entry = await createQuickFilter(
      [collections[2], createCollection, collections[1]],
      createCollection,
    );
    await environment.adminClient.query(DELETE_COLLECTION, {
      id: createCollection.id,
    });
    const { quickFilter } = await environment.shopClient.query(GET_FILTER, {
      id: entry.id,
    });
    expect(
      quickFilter.collections.map(
        (collection: { id: string }) => collection.id,
      ),
    ).toEqual([collections[2].id, collections[1].id]);
    expect(quickFilter.featuredCollection).toBeNull();
  });

  it('scopes entries and their related collections to the request channel', async () => {
    const defaultEntry = await createQuickFilter([collections[0]]);
    const { activeChannel } = await environment.adminClient.query(GET_CHANNEL);
    const { createChannel } = await environment.adminClient.query(
      CREATE_CHANNEL,
      {
        input: {
          code: 'relation-list-channel',
          token: 'relation-list-channel',
          defaultLanguageCode: 'en',
          defaultCurrencyCode: 'USD',
          pricesIncludeTax: false,
          defaultShippingZoneId: activeChannel.defaultShippingZone.id,
          defaultTaxZoneId: activeChannel.defaultTaxZone.id,
        },
      },
    );
    expect(createChannel.__typename).toBe('Channel');
    await environment.adminClient.query(ASSIGN_COLLECTION, {
      input: {
        collectionIds: [collections[1].id],
        channelId: createChannel.id,
      },
    });
    environment.adminClient.setChannelToken('relation-list-channel');
    environment.shopClient.setChannelToken('relation-list-channel');
    expect(
      (await environment.shopClient.query(GET_FILTER, { id: defaultEntry.id }))
        .quickFilter,
    ).toBeNull();
    const channelEntry = await createQuickFilter([
      collections[0],
      collections[1],
    ]);
    const { quickFilter } = await environment.shopClient.query(GET_FILTER, {
      id: channelEntry.id,
    });
    expect(quickFilter.collections).toEqual([
      { ...collections[1], name: 'Seeds', slug: 'seeds' },
    ]);
    expect(quickFilter.featuredCollection).toBeNull();
  });
});

async function createQuickFilter(
  references: Array<{ id: string }>,
  featuredCollection = collections[0],
) {
  const { createContentEntry } = await environment.adminClient.query(
    CREATE_CONTENT_ENTRY,
    {
      input: {
        contentTypeCode: 'quickFilter',
        fields: { key: 'home', collections: references, featuredCollection },
      },
    },
  );
  return createContentEntry;
}

const GET_CHANNEL = gql`
  query { activeChannel { id defaultShippingZone { id } defaultTaxZone { id } } }
`;
const ENABLE_LANGUAGES = gql`
  mutation { updateGlobalSettings(input: { availableLanguages: [en, nl] }) { __typename } }
`;
const UPDATE_CHANNEL_LANGUAGES = gql`
  mutation($id: ID!) { updateChannel(input: { id: $id, availableLanguageCodes: [en, nl] }) { __typename } }
`;
const CREATE_COLLECTION = gql`
  mutation($input: CreateCollectionInput!) { createCollection(input: $input) { id } }
`;
const DELETE_COLLECTION = gql`
  mutation($id: ID!) { deleteCollection(id: $id) { result } }
`;
const GET_TYPE = gql`
  query { simpleCmsContentType(code: "quickFilter") { fields { name type graphQLType list isTranslatable } } }
`;
const GET_ENTRY = gql`
  query($id: ID!) { contentEntry(id: $id) { id fields } }
`;
const GET_FILTER = gql`
  query($id: ID!) {
    quickFilter(id: $id) {
      key
      collections { id name slug }
      featuredCollection { id name slug }
    }
  }
`;
const UPDATE_ENTRY = gql`
  mutation($id: ID!, $input: ContentEntryInput!) { updateContentEntry(id: $id, input: $input) { id } }
`;
const CREATE_CHANNEL = gql`
  mutation($input: CreateChannelInput!) { createChannel(input: $input) { __typename ... on Channel { id } } }
`;
const ASSIGN_COLLECTION = gql`
  mutation($input: AssignCollectionsToChannelInput!) { assignCollectionsToChannel(input: $input) { id } }
`;
