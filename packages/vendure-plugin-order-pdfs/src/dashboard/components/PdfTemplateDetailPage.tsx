import {
  ActionBarItem,
  Button,
  DashboardRouteDefinition,
  FormFieldWrapper,
  Input,
  NEW_ENTITY_PATH,
  Page,
  PageActionBar,
  PageBlock,
  PageLayout,
  PageTitle,
  Switch,
  Textarea,
  useDetailPage,
} from '@vendure/dashboard';
import { graphql } from '@/gql';
import { toast } from 'sonner';
import { useState } from 'react';
import { getAuthHeaders, getServerBaseUrl, downloadBlob } from '../utils';

export const pdfTemplateDetailDocument = graphql(`
  query PdfTemplateDetail($id: ID!) {
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
  mutation CreatePdfTemplateFromDetail($input: CreatePDFTemplateInput!) {
    createPDFTemplate(input: $input) {
      id
      name
      enabled
      public
      templateString
    }
  }
`);

const updatePdfTemplateDocument = graphql(`
  mutation UpdatePdfTemplateFromDetail($input: UpdatePDFTemplateInput!) {
    updatePDFTemplate(input: $input) {
      id
      name
      enabled
      public
      templateString
    }
  }
`);

const pageId = 'pdf-template-detail';

function PdfTemplateDetailPageComponent({ route }: { route: any }) {
  const params = route.useParams();
  const creatingNewEntity = params.id === NEW_ENTITY_PATH;
  const [previewLoading, setPreviewLoading] = useState(false);

  const { form, submitHandler, entity, isPending } = useDetailPage({
    pageId,
    queryDocument: pdfTemplateDetailDocument,
    createDocument: createPdfTemplateDocument,
    updateDocument: updatePdfTemplateDocument,
    setValuesForUpdate: (template: any) => ({
      id: template.id,
      name: template.name,
      enabled: template.enabled,
      public: template.public,
      templateString: template.templateString ?? '',
    }),
    params: { id: params.id },
    onSuccess: () => {
      toast.success(
        creatingNewEntity
          ? 'Successfully created PDF template'
          : 'Successfully updated PDF template'
      );
    },
    onError: (err: unknown) => {
      toast.error(
        creatingNewEntity
          ? 'Failed to create PDF template'
          : 'Failed to update PDF template',
        { description: err instanceof Error ? err.message : 'Unknown error' }
      );
    },
  });

  async function handlePreview() {
    const templateString = form.getValues('templateString' as never);
    setPreviewLoading(true);
    try {
      const serverPath = getServerBaseUrl();
      const res = await fetch(`${serverPath}/order-pdf/preview/`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: templateString }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.message ?? 'Preview failed');
      }
      const blob = await res.blob();
      downloadBlob(blob, 'preview.pdf', true);
    } catch (err: any) {
      toast.error(err?.message ?? 'Preview failed');
    }
    setPreviewLoading(false);
  }

  return (
    <Page pageId={pageId} form={form} submitHandler={submitHandler}>
      <PageTitle>
        {creatingNewEntity ? 'New PDF template' : (entity?.name ?? '')}
      </PageTitle>
      <PageActionBar>
        <ActionBarItem itemId="preview-button">
          <Button
            type="button"
            variant="secondary"
            onClick={handlePreview}
            disabled={previewLoading}
          >
            {previewLoading ? 'Generating...' : 'Preview'}
          </Button>
        </ActionBarItem>
        <ActionBarItem
          itemId="save-button"
          requiresPermission={['AllowPDFDownload']}
        >
          <Button
            type="submit"
            disabled={!form.formState.isDirty || isPending}
          >
            {creatingNewEntity ? 'Create' : 'Update'}
          </Button>
        </ActionBarItem>
      </PageActionBar>
      <PageLayout>
        <PageBlock column="side" blockId="pdf-template-flags">
          <div className="space-y-4">
            <FormFieldWrapper
              control={form.control}
              name="enabled"
              label="Enabled"
              render={({ field }) => (
                <Switch
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <FormFieldWrapper
              control={form.control}
              name="public"
              label="Public"
              description="Allow customers to download this template for their own orders without logging in."
              render={({ field }) => (
                <Switch
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
        </PageBlock>
        <PageBlock column="main" blockId="pdf-template-main-form">
          <div className="space-y-6">
            <FormFieldWrapper
              control={form.control}
              name="name"
              label="Name"
              render={({ field }) => <Input {...field} />}
            />
            <FormFieldWrapper
              control={form.control}
              name="templateString"
              label="HTML template"
              render={({ field }) => (
                <Textarea
                  {...field}
                  rows={20}
                  className="font-mono text-xs"
                  placeholder="Enter your HTML PDF template..."
                />
              )}
            />
          </div>
        </PageBlock>
      </PageLayout>
    </Page>
  );
}

export const pdfTemplateDetailRoute: DashboardRouteDefinition = {
  path: '/pdf-templates/$id',
  loader: () => ({
    breadcrumb: [
      { path: '/pdf-templates', label: 'PDF Templates' },
      'PDF template',
    ],
  }),
  component: (route) => <PdfTemplateDetailPageComponent route={route} />,
};
