import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  api,
  Button,
  ContentLanguageSelector,
  graphql,
  Page,
  PageActionBar,
  PageActionBarLeft,
  PageActionBarRight,
  PageBlock,
  PageLayout,
  PageTitle,
  useUserSettings,
} from '@vendure/dashboard';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ContentTypeBadge } from './ContentTypeBadge';
import { SimpleCmsFieldDto } from './field-def-mapping';
import { RenderField } from './render-content-field';

/** Fetch a single content entry with its translations. */
const getContentEntryDoc = graphql(`
  query GetContentEntry($id: ID!) {
    contentEntry(id: $id) {
      id
      contentTypeCode
      fields
      translations {
        languageCode
        fields
      }
      createdAt
      updatedAt
      displayName
    }
  }
`);

/** Fetch the field metadata for a content type. */
const getContentTypeDoc = graphql(`
  query GetContentTypeForDetail($code: String!) {
    simpleCmsContentType(code: $code) {
      code
      displayName
      allowMultiple
      fields {
        name
        type
        nullable
        isTranslatable
        graphQLType
        list
        ui
        fields {
          name
          type
          nullable
          ui
        }
      }
    }
  }
`);

const createContentEntryDoc = graphql(`
  mutation CreateContentEntry($input: ContentEntryInput!) {
    createContentEntry(input: $input) {
      id
    }
  }
`);

const updateContentEntryDoc = graphql(`
  mutation UpdateContentEntry($id: ID!, $input: ContentEntryInput!) {
    updateContentEntry(id: $id, input: $input) {
      id
    }
  }
`);

interface FormShape {
  fields: Record<string, unknown>;
  translation: Record<string, unknown>;
}

interface ContentEntryDetailProps {
  /** When set, edit mode (id from route param). When undefined, create mode. */
  id?: string;
  /** Content type code, required in create mode. Edit mode reads it from entry. */
  contentTypeCode?: string;
}

/**
 * Convert a relation form value into the `{ id }` shape expected by the
 * SimpleCms admin API. Accepts:
 *  - a bare id string/number (as emitted by `DefaultRelationInput`)
 *  - an existing `{ id, ... }` object (passes through as `{ id }`)
 *  - an array of any of the above (for multi-relations)
 *  - null/undefined/empty → null
 */
function normalizeRelationValue(
  value: unknown,
): { id: string | number } | Array<{ id: string | number }> | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string' || typeof item === 'number') {
          return { id: item };
        }
        if (typeof item === 'object' && item !== null) {
          const id = (item as { id?: unknown }).id;
          if (typeof id === 'string' || typeof id === 'number') {
            return { id };
          }
        }
        return null;
      })
      .filter((item): item is { id: string | number } => item !== null);
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return { id: value };
  }
  if (typeof value === 'object') {
    const id = (value as { id?: unknown }).id;
    if (typeof id === 'string' || typeof id === 'number') {
      return { id };
    }
  }
  return null;
}

/** Flattens loaded relation entities to the IDs expected by relation inputs. */
function flattenRelationValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item && typeof item === 'object' && 'id' in item)
      .map((item) => item.id);
  }
  if (value && typeof value === 'object' && 'id' in value) return value.id;
  return value;
}

type FormFieldDefinition = Pick<
  SimpleCmsFieldDto,
  'name' | 'type' | 'isTranslatable'
>;

/** Clears untranslated fields before merging values from the active translation. */
function createTranslationDefaults(
  definitions: FormFieldDefinition[],
  values: Record<string, unknown> | undefined,
) {
  const translation: Record<string, unknown> = {};
  for (const def of definitions) {
    if (def.isTranslatable) translation[def.name] = null;
  }
  return Object.assign(translation, values ?? {});
}

/** Partitions submitted fields by translation status and normalizes relation references. */
function partitionFormValues(
  definitions: FormFieldDefinition[],
  values: FormShape,
) {
  const fields: Record<string, unknown> = {};
  const translationFields: Record<string, unknown> = {};
  for (const def of definitions) {
    const target = def.isTranslatable ? translationFields : fields;
    const source = def.isTranslatable ? values.translation : values.fields;
    if (source && def.name in source) {
      target[def.name] =
        def.type === 'relation'
          ? normalizeRelationValue(source[def.name])
          : source[def.name];
    }
  }
  return { fields, translationFields };
}

/** Preserves other translations while reducing relation entities to API references. */
function normalizeTranslationFields(
  values: Record<string, unknown>,
  definitions: FormFieldDefinition[],
) {
  const fields = { ...values };
  for (const def of definitions) {
    if (def.type === 'relation' && def.isTranslatable && def.name in fields) {
      fields[def.name] = normalizeRelationValue(fields[def.name]);
    }
  }
  return fields;
}

/**
 * Detail page for creating or editing a SimpleCms content entry.
 *
 * Form layout is generated dynamically from the selected content type's
 * field definitions. Translatable fields are edited for the dashboard's
 * currently active content language only.
 */
export function ContentEntryDetail({
  id,
  contentTypeCode: contentTypeCodeProp,
}: ContentEntryDetailProps) {
  const isCreate = !id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { contentLanguage } = useUserSettings().settings;

  const entryQuery = useQuery({
    queryKey: ['simple-cms-content-entry', id],
    queryFn: () => api.query(getContentEntryDoc, { id: id! }),
    enabled: !!id,
  });

  const resolvedContentTypeCode =
    entryQuery.data?.contentEntry?.contentTypeCode ?? contentTypeCodeProp;

  const contentTypeQuery = useQuery({
    queryKey: ['simple-cms-content-type', resolvedContentTypeCode],
    queryFn: () =>
      api.query(getContentTypeDoc, { code: resolvedContentTypeCode! }),
    enabled: !!resolvedContentTypeCode,
  });

  const contentType = contentTypeQuery.data?.simpleCmsContentType;
  const entry = entryQuery.data?.contentEntry;

  /** Build defaultValues from entry + active-language translations. */
  const defaultValues = useMemo<FormShape>(() => {
    const fields: Record<string, unknown> = { ...(entry?.fields ?? {}) };
    const activeTranslation = entry?.translations?.find(
      (t) => t.languageCode === contentLanguage,
    );
    // Start with an explicit `null` for every translatable field defined
    // in the content type, so that switching to a language without an
    // existing translation reliably clears any previously rendered values
    // when `form.reset(defaultValues)` is called. Without this, fields
    // missing from `defaultValues.translation` may retain their prior
    // controller values.
    const translation = createTranslationDefaults(
      contentType?.fields ?? [],
      activeTranslation?.fields,
    );
    // Flatten relation `{ id, ... }` objects to bare id strings, since
    // DefaultRelationInput expects `value` to be an id.
    for (const def of contentType?.fields ?? []) {
      if ((def as any).type !== 'relation') continue;
      const target = (def as any).isTranslatable ? translation : fields;
      target[def.name] = flattenRelationValue(target[def.name]);
    }
    return { fields, translation };
  }, [entry, contentLanguage, contentType]);

  const form = useForm<FormShape>({
    defaultValues,
    mode: 'onChange',
  });

  // Reset form once entry data has loaded.
  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const createMutation = useMutation({
    mutationFn: (input: any) => api.mutate(createContentEntryDoc, { input }),
    onSuccess: async (res: any) => {
      toast.success('Content entry created');
      const newId = res?.createContentEntry?.id;
      await queryClient.invalidateQueries({ queryKey: ['ContentEntries'] });
      // Reset the form to mark it as clean so the Page component does not
      // show an "unsaved changes" warning when navigating to the new entry.
      form.reset();
      if (newId) {
        navigate({ to: '/content/$id', params: { id: newId } as any });
      }
    },
    onError: (err: any) => toast.error(err.message ?? 'Create failed'),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; input: any }) =>
      api.mutate(updateContentEntryDoc, vars),
    onSuccess: async () => {
      toast.success('Content entry updated');
      await queryClient.invalidateQueries({
        queryKey: ['simple-cms-content-entry', id],
      });
      await queryClient.invalidateQueries({ queryKey: ['ContentEntries'] });
    },
    onError: (err: any) => toast.error(err.message ?? 'Update failed'),
  });

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    entryQuery.isLoading ||
    contentTypeQuery.isLoading;

  function onSubmit(values: FormShape) {
    if (!contentType || !resolvedContentTypeCode) return;

    // Partition values into top-level fields vs. translation fields based on
    // the content type field definitions. Relation values are normalized to
    // `{ id }` objects, since Vendure's DefaultRelationInput emits a bare id
    // string (or a full entity object) but the backend expects `{ id }`.
    const { fields, translationFields } = partitionFormValues(
      contentType.fields ?? [],
      values,
    );

    // The backend replaces ALL translations on update, so we must send
    // every existing translation alongside the one currently being edited.
    // Merge: keep all other-language translations untouched, replace the
    // active language's translation with the form values. Relation values
    // inside other-language translations are normalized to `{ id }` shape
    // because the entry payload returns them as full objects.
    const otherTranslations = (entry?.translations ?? [])
      .filter((t) => t.languageCode !== contentLanguage)
      .map((t) => {
        const normalizedFields = normalizeTranslationFields(
          t.fields ?? {},
          contentType.fields ?? [],
        );
        return { languageCode: t.languageCode, fields: normalizedFields };
      });

    const translations = [...otherTranslations];
    if (Object.keys(translationFields).length) {
      translations.push({
        languageCode: contentLanguage,
        fields: translationFields,
      });
    }

    const input: any = {
      contentTypeCode: resolvedContentTypeCode,
      fields,
      translations: translations.length ? translations : undefined,
    };

    if (isCreate) {
      createMutation.mutate(input);
    } else {
      updateMutation.mutate({ id: id!, input });
    }
  }

  if (!resolvedContentTypeCode) {
    return (
      <Page>
        <PageTitle>New content</PageTitle>
        <PageLayout>
          <PageBlock column="main" blockId="missing-type">
            <p className="text-muted-foreground text-sm">
              Missing required <code>contentType</code> parameter.
            </p>
          </PageBlock>
        </PageLayout>
      </Page>
    );
  }

  if (!contentType) {
    const isLoading = contentTypeQuery.isLoading || contentTypeQuery.isFetching;
    return (
      <Page>
        <PageTitle>{isLoading ? 'Loading' : 'Not Found'}</PageTitle>
        <PageLayout>
          <PageBlock column="main" blockId="loading">
            {!isLoading && (
              <p className="text-muted-foreground text-sm">
                Content type &apos;{resolvedContentTypeCode}&apos; not found.
              </p>
            )}
          </PageBlock>
        </PageLayout>
      </Page>
    );
  }

  const title = isCreate
    ? `New ${contentType.displayName}`
    : ((entry as any)?.displayName ?? contentType.displayName);

  const submitDisabled =
    isPending || !form.formState.isDirty || !form.formState.isValid;

  // Show the language switcher only when the content type has at least
  // one translatable field — otherwise switching languages is a no-op.
  const hasTranslatableField = (contentType.fields ?? []).some(
    (f) => !!(f as any).isTranslatable,
  );

  return (
    <Page form={form} submitHandler={form.handleSubmit(onSubmit)}>
      <PageTitle>{title}</PageTitle>
      <div className="-mt-2 mb-2">
        <ContentTypeBadge
          code={resolvedContentTypeCode}
          label={contentType.displayName}
        />
      </div>
      <PageActionBar>
        {hasTranslatableField && (
          <PageActionBarLeft>
            <ContentLanguageSelector />
          </PageActionBarLeft>
        )}
        <PageActionBarRight>
          <Button type="submit" disabled={submitDisabled}>
            {isCreate ? 'Create' : 'Update'}
          </Button>
        </PageActionBarRight>
      </PageActionBar>
      <PageLayout>
        <PageBlock column="main" blockId="main-form">
          <div className="flex flex-col gap-4">
            {(contentType.fields ?? []).map((def) => {
              const f = def as unknown as SimpleCmsFieldDto;
              const isTranslatable = !!f.isTranslatable;
              const baseName = isTranslatable ? 'translation' : 'fields';
              // Include contentLanguage in key for translatable fields so
              // the inputs fully remount when the user switches language,
              // guaranteeing the new value is reflected even if RHF's
              // controller fails to pick up the reset.
              const key = isTranslatable
                ? `${f.name}::${contentLanguage}`
                : f.name;
              return (
                <RenderField
                  key={key}
                  field={f}
                  name={`${baseName}.${f.name}`}
                  control={form.control}
                />
              );
            })}
          </div>
        </PageBlock>
      </PageLayout>
    </Page>
  );
}
