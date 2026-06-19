import {
  ActionBarItem,
  Button,
  DashboardRouteDefinition,
  DetailFormGrid,
  FormFieldWrapper,
  Input,
  Page,
  PageActionBar,
  PageBlock,
  PageLayout,
  PageTitle,
  Switch,
  Textarea,
  detailPageRouteLoader,
  toast,
  useDetailPage,
  useNavigate,
} from '@vendure/dashboard';
import type { AnyRoute } from '@vendure/dashboard';
import { useEffect, useState } from 'react';
import { graphql } from '@/gql';
import { defaultTemplate } from './default-template';
import { downloadBlob } from './helpers';

const pdfTemplateDetailDocument = graphql(`
  query GetPdfTemplateDetail($id: ID!) {
    pdfTemplate(id: $id) {
      id
      createdAt
      updatedAt
      name
      enabled
      public
      templateString
    }
  }
`);

const createPdfTemplateDocument = graphql(`
  mutation CreatePdfTemplate($input: CreatePdfTemplateInput!) {
    createPdfTemplate(input: $input) {
      id
    }
  }
`);

const updatePdfTemplateDocument = graphql(`
  mutation UpdatePdfTemplate($input: UpdatePdfTemplateInput!) {
    updatePdfTemplate(input: $input) {
      id
    }
  }
`);

export const pdfTemplateDetail: DashboardRouteDefinition = {
  path: '/pdf-templates/$id',
  loader: detailPageRouteLoader({
    queryDocument: pdfTemplateDetailDocument,
    breadcrumb: (isNew, entity) => [
      { path: '/pdf-templates', label: 'PDF Templates' },
      isNew ? 'New template' : entity?.name,
    ],
  }),
  component: (route) => <PdfTemplateDetailPage route={route} />,
};

function PdfTemplateDetailPage({ route }: { route: AnyRoute }) {
  const params = route.useParams();
  const navigate = useNavigate();
  const isNew = params.id === 'new';
  const [previewLoading, setPreviewLoading] = useState(false);

  const { form, submitHandler, entity, isPending, resetForm } = useDetailPage({
    queryDocument: pdfTemplateDetailDocument,
    createDocument: createPdfTemplateDocument,
    updateDocument: updatePdfTemplateDocument,
    setValuesForUpdate: (t) => ({
      id: t?.id ?? '',
      name: t?.name ?? '',
      enabled: t?.enabled ?? true,
      public: t?.public ?? false,
      templateString: t?.templateString ?? '',
    }),
    params: { id: params.id },
    onSuccess: async (data) => {
      toast(isNew ? 'Created' : 'Saved');
      resetForm();
      if (isNew) {
        await navigate({ to: '../$id', params: { id: data.id } });
      }
    },
    onError: (err) => {
      toast('Failed to save template', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    },
  });

  // Replaces the Angular create() default-template patch
  useEffect(() => {
    if (isNew) {
      form.reset({
        id: '',
        name: '',
        enabled: true,
        public: false,
        templateString: defaultTemplate,
      });
    }
  }, [isNew]);

  async function preview() {
    const values = form.getValues();
    try {
      setPreviewLoading(true);
      const res = await fetch(`${API_URL}/order-pdf/preview/`, {
        method: 'POST',
        credentials: 'include', // cookie/session auth; see note below
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: values.templateString }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.message ?? 'Preview failed');
      }
      const blob = await res.blob();
      const fileName =
        (values.name?.toLowerCase().replace(/\s+/g, '_') || 'template') +
        '_preview.pdf';
      downloadBlob(blob, fileName);
    } catch (err: any) {
      toast('Preview failed', { description: err?.message });
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <Page
      pageId="pdf-template-detail"
      form={form}
      submitHandler={submitHandler}
    >
      <PageTitle>{isNew ? 'New PDF template' : entity?.name ?? ''}</PageTitle>
      <PageActionBar>
        <ActionBarItem itemId="preview-button">
          <Button
            type="button"
            variant="outline"
            disabled={previewLoading}
            onClick={preview}
          >
            Preview
          </Button>
        </ActionBarItem>
        <ActionBarItem itemId="save-button">
          <Button type="submit" disabled={!form.formState.isValid || isPending}>
            Save
          </Button>
        </ActionBarItem>
      </PageActionBar>

      <PageLayout>
        <PageBlock column="side" blockId="status">
          <FormFieldWrapper
            control={form.control}
            name="enabled"
            label="Enabled"
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
          <FormFieldWrapper
            control={form.control}
            name="public"
            label="Public"
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </PageBlock>

        <PageBlock column="main" blockId="main-form">
          <DetailFormGrid>
            <FormFieldWrapper
              control={form.control}
              name="name"
              label="Name"
              render={({ field }) => <Input {...field} />}
            />
          </DetailFormGrid>

          <FormFieldWrapper
            control={form.control}
            name="templateString"
            label="HTML template"
            render={({ field }) => (
              <Textarea
                {...field}
                rows={24}
                spellCheck={false}
                className="font-mono text-sm"
              />
            )}
          />
        </PageBlock>
      </PageLayout>
    </Page>
  );
}
