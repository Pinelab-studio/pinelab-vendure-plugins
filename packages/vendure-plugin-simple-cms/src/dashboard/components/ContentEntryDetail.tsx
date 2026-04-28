import {
  api,
  Button,
  graphql,
  Page,
  PageActionBar,
  PageActionBarRight,
  PageBlock,
  PageLayout,
  PageTitle,
  useUserSettings,
} from '@vendure/dashboard';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { RenderField } from './render-content-field';
import { SimpleCmsFieldDto } from './field-def-mapping';

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
        ui
        fields {
          name
          type
          nullable
          isTranslatable
          graphQLType
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
 *  - null/undefined/empty → null
 */
function normalizeRelationValue(
  value: unknown
): { id: string | number } | null {
  if (value === null || value === undefined || value === '') {
    return null;
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
      (t) => t.languageCode === contentLanguage
    );
    const translation: Record<string, unknown> = {
      ...(activeTranslation?.fields ?? {}),
    };
    // Flatten relation `{ id, ... }` objects to bare id strings, since
    // DefaultRelationInput expects `value` to be an id.
    for (const def of contentType?.fields ?? []) {
      if ((def as any).type !== 'relation') continue;
      const target = (def as any).isTranslatable ? translation : fields;
      const v = target[def.name];
      if (v && typeof v === 'object' && 'id' in (v as any)) {
        target[def.name] = (v as any).id;
      }
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
    const fields: Record<string, unknown> = {};
    const translationFields: Record<string, unknown> = {};
    for (const def of contentType.fields ?? []) {
      const isTranslatable = !!(def as any).isTranslatable;
      const target = isTranslatable ? translationFields : fields;
      const source = isTranslatable ? values.translation : values.fields;
      if (source && def.name in source) {
        let val = (source as any)[def.name];
        if ((def as any).type === 'relation') {
          val = normalizeRelationValue(val);
        }
        target[def.name] = val;
      }
    }

    const input: any = {
      contentTypeCode: resolvedContentTypeCode,
      fields,
      translations: Object.keys(translationFields).length
        ? [{ languageCode: contentLanguage, fields: translationFields }]
        : undefined,
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
            <p className="text-sm text-muted-foreground">
              Missing required <code>contentType</code> parameter.
            </p>
          </PageBlock>
        </PageLayout>
      </Page>
    );
  }

  if (!contentType) {
    return (
      <Page>
        <PageTitle>Loading…</PageTitle>
        <PageLayout>
          <PageBlock column="main" blockId="loading" />
        </PageLayout>
      </Page>
    );
  }

  const title = isCreate
    ? `New ${contentType.displayName}`
    : (entry as any)?.displayName ?? contentType.displayName;

  const submitDisabled =
    isPending || !form.formState.isDirty || !form.formState.isValid;

  return (
    <Page form={form} submitHandler={form.handleSubmit(onSubmit)}>
      <PageTitle>{title}</PageTitle>
      <div className="text-sm text-muted-foreground -mt-2 mb-2">
        {contentType.displayName}
      </div>
      <PageActionBar>
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
              return (
                <RenderField
                  key={f.name}
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
