import { Asset, LanguageCode } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { TypeDefinition } from '../types';
import { validateContentEntryInput } from './validate-content-entry-input';
import { ContentEntryInput } from '../api/generated/graphql';

const featuredProduct: TypeDefinition = {
  displayName: 'Featured Product',
  allowMultiple: false,
  fields: [
    { name: 'subtitle', type: 'string', nullable: true, isTranslatable: false },
    { name: 'title', type: 'string', isTranslatable: true },
    {
      name: 'seo',
      type: 'struct',
      isTranslatable: true,
      fields: [
        { name: 'metaTitle', type: 'string', isTranslatable: false },
        { name: 'metaDescription', type: 'text', isTranslatable: false },
      ],
    },
    {
      name: 'image',
      type: 'relation',
      entity: Asset,
      graphQLType: 'Asset',
      nullable: false,
    },
  ],
};

const banner: TypeDefinition = {
  displayName: 'Banner',
  allowMultiple: true,
  fields: [
    { name: 'title', type: 'string', isTranslatable: true },
    { name: 'priority', type: 'int', isTranslatable: false, nullable: true },
    {
      name: 'image',
      type: 'relation',
      entity: Asset,
      graphQLType: 'Asset',
      nullable: false,
    },
  ],
};

function fpInput(
  overrides: Partial<ContentEntryInput> = {}
): ContentEntryInput {
  return {
    contentTypeCode: 'featuredProduct',
    fields: { image: { id: 1 } },
    translations: [
      {
        languageCode: LanguageCode.en,
        fields: {
          title: 'Hello',
          seo: { metaTitle: 'Meta', metaDescription: 'Desc' },
        },
      },
    ],
    ...overrides,
  } as ContentEntryInput;
}

function bannerInput(
  overrides: Partial<ContentEntryInput> = {}
): ContentEntryInput {
  return {
    contentTypeCode: 'banner',
    fields: { image: { id: 1 }, priority: 1 },
    translations: [
      { languageCode: LanguageCode.en, fields: { title: 'Hello' } },
    ],
    ...overrides,
  } as ContentEntryInput;
}

describe('validateContentEntryInput', () => {
  it('Accepts a valid singleton input', () => {
    expect(() =>
      validateContentEntryInput(featuredProduct, fpInput())
    ).not.toThrow();
  });

  it('Accepts a valid multi-instance input with translations', () => {
    expect(() =>
      validateContentEntryInput(banner, bannerInput())
    ).not.toThrow();
  });

  it('Allows nullable field to be omitted', () => {
    expect(() =>
      validateContentEntryInput(
        banner,
        bannerInput({ fields: { image: { id: 1 } } })
      )
    ).not.toThrow();
  });

  it('Rejects unknown top-level field', () => {
    expect(() =>
      validateContentEntryInput(
        banner,
        bannerInput({ fields: { image: { id: 1 }, bogus: 'x' } })
      )
    ).toThrow(/Unknown field 'bogus'/);
  });

  it('Rejects translatable field placed in top-level fields', () => {
    expect(() =>
      validateContentEntryInput(
        banner,
        bannerInput({ fields: { image: { id: 1 }, title: 'Hello' } })
      )
    ).toThrow(/translatable/);
  });

  it('Rejects missing required non-nullable relation', () => {
    expect(() =>
      validateContentEntryInput(banner, bannerInput({ fields: {} }))
    ).toThrow(/Required field 'image' is missing/);
  });

  it('Rejects type mismatch on int', () => {
    expect(() =>
      validateContentEntryInput(
        banner,
        bannerInput({ fields: { image: { id: 1 }, priority: 1.5 } })
      )
    ).toThrow(/integer/);
  });

  it('Rejects type mismatch on boolean / date', () => {
    const def: TypeDefinition = {
      displayName: 'X',
      allowMultiple: false,
      fields: [
        { name: 'flag', type: 'boolean', isTranslatable: false },
        { name: 'when', type: 'date', isTranslatable: false },
      ],
    };
    expect(() =>
      validateContentEntryInput(def, {
        contentTypeCode: 'x',
        fields: { flag: 'true', when: '2024-01-01' },
      } as ContentEntryInput)
    ).toThrow(/boolean/);
    expect(() =>
      validateContentEntryInput(def, {
        contentTypeCode: 'x',
        fields: { flag: true, when: 'not a date' },
      } as ContentEntryInput)
    ).toThrow(/ISO 8601/);
  });

  it('Rejects struct missing required sub-field', () => {
    expect(() =>
      validateContentEntryInput(
        featuredProduct,
        fpInput({
          translations: [
            {
              languageCode: LanguageCode.en,
              fields: { title: 'Hi', seo: { metaTitle: 'Only' } },
            },
          ],
        })
      )
    ).toThrow(/metaDescription/);
  });

  it('Rejects struct with unknown sub-field', () => {
    expect(() =>
      validateContentEntryInput(
        featuredProduct,
        fpInput({
          translations: [
            {
              languageCode: LanguageCode.en,
              fields: {
                title: 'Hi',
                seo: { metaTitle: 'a', metaDescription: 'b', bogus: 1 },
              },
            },
          ],
        })
      )
    ).toThrow(/bogus/);
  });

  it('Rejects relation value not shaped { id }', () => {
    expect(() =>
      validateContentEntryInput(
        banner,
        bannerInput({ fields: { image: 1 as never } })
      )
    ).toThrow(/object with an 'id'/);
    expect(() =>
      validateContentEntryInput(
        banner,
        bannerInput({ fields: { image: { name: 'no id' } as never } })
      )
    ).toThrow(/'id'/);
  });

  it('Rejects duplicate languageCode in translations', () => {
    expect(() =>
      validateContentEntryInput(
        banner,
        bannerInput({
          translations: [
            { languageCode: LanguageCode.en, fields: { title: 'A' } },
            { languageCode: LanguageCode.en, fields: { title: 'B' } },
          ],
        })
      )
    ).toThrow(/Duplicate translation/);
  });

  it('Rejects translation entry with unknown field name', () => {
    expect(() =>
      validateContentEntryInput(
        banner,
        bannerInput({
          translations: [
            {
              languageCode: LanguageCode.en,
              fields: { title: 'A', bogus: 'x' },
            },
          ],
        })
      )
    ).toThrow(/Unknown translatable field 'bogus'/);
  });

  it('Rejects missing required translatable field', () => {
    expect(() =>
      validateContentEntryInput(
        banner,
        bannerInput({
          translations: [{ languageCode: LanguageCode.en, fields: {} }],
        })
      )
    ).toThrow(/Required translatable field 'title'/);
  });
});
