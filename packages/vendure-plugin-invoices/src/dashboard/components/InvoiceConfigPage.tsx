import {
  api,
  Button,
  DashboardRouteDefinition,
  FormFieldWrapper,
  Input,
  Page,
  PageActionBar,
  PageActionBarRight,
  PageBlock,
  PageLayout,
  PageTitle,
  PermissionGuard,
  Switch,
  Textarea,
} from '@vendure/dashboard';
import { graphql } from '@/gql';
import { FormProvider, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { getAuthHeaders, getServerBaseUrl, downloadBlob } from '../utils';

const invoiceConfigDocument = graphql(`
  query InvoiceConfig {
    invoiceConfig {
      id
      enabled
      createCreditInvoices
      templateString
    }
  }
`);

const upsertInvoiceConfigDocument = graphql(`
  mutation UpsertInvoiceConfig($input: InvoiceConfigInput!) {
    upsertInvoiceConfig(input: $input) {
      id
      enabled
      createCreditInvoices
      templateString
    }
  }
`);

interface ConfigFormValues {
  enabled: boolean;
  templateString: string;
  orderCode: string;
}

function InvoiceConfigPageComponent() {
  const queryClient = useQueryClient();
  const [previewLoading, setPreviewLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['invoice-config'],
    queryFn: () => api.query(invoiceConfigDocument),
  });

  const form = useForm<ConfigFormValues>({
    defaultValues: {
      enabled: false,
      templateString: '',
      orderCode: '',
    },
  });

  // Populate form when data loads
  useEffect(() => {
    const config = data?.invoiceConfig;
    if (config) {
      form.reset({
        enabled: config.enabled,
        templateString: config.templateString ?? '',
        orderCode: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const { mutate: saveConfig, isPending: saving } = useMutation({
    mutationFn: (values: ConfigFormValues) =>
      api.mutate(upsertInvoiceConfigDocument, {
        input: {
          enabled: values.enabled,
          templateString: values.templateString,
        },
      }),
    onSuccess: () => {
      toast.success('Invoice config updated');
      queryClient.invalidateQueries({ queryKey: ['invoice-config'] });
      form.reset(form.getValues());
    },
    onError: (err: Error) =>
      toast.error('Failed to update config', { description: err.message }),
  });

  async function handlePreview() {
    const template = form.getValues('templateString');
    const orderCode = form.getValues('orderCode');
    setPreviewLoading(true);
    try {
      const serverPath = getServerBaseUrl();
      const res = await fetch(`${serverPath}/invoices/preview/${orderCode}`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ template }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(JSON.stringify(json?.message));
      }
      const blob = await res.blob();
      downloadBlob(blob, 'test-invoice.pdf', true);
    } catch (err: any) {
      toast.error(err?.message ?? 'Preview failed');
    }
    setPreviewLoading(false);
  }

  if (isLoading) {
    return null;
  }

  return (
    <FormProvider {...form}>
      <Page pageId="invoice-config">
        <PageTitle>Invoice Settings</PageTitle>
        <PageActionBar>
          <PageActionBarRight>
            <PermissionGuard requires={['AllowInvoicesPermission']}>
              <Button
                type="button"
                disabled={!form.formState.isDirty || saving}
                onClick={form.handleSubmit((values: ConfigFormValues) =>
                  saveConfig(values)
                )}
              >
                {saving ? 'Saving...' : 'Update'}
              </Button>
            </PermissionGuard>
          </PageActionBarRight>
        </PageActionBar>
        <PageLayout>
          <PageBlock column="main" blockId="invoice-config-form">
            <div className="space-y-6">
              <FormFieldWrapper
                control={form.control}
                name="enabled"
                label="Generate invoices"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
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
                    placeholder="Enter your HTML invoice template..."
                  />
                )}
              />
            </div>
          </PageBlock>
          <PageBlock
            column="side"
            blockId="invoice-preview"
            title="Template Preview"
          >
            <div className="space-y-4">
              <FormFieldWrapper
                control={form.control}
                name="orderCode"
                label="Order Code"
                render={({ field }) => (
                  <Input {...field} placeholder="e.g. ABC123" />
                )}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handlePreview}
                disabled={previewLoading}
              >
                {previewLoading ? 'Generating...' : 'Preview Template'}
              </Button>
            </div>
          </PageBlock>
        </PageLayout>
      </Page>
    </FormProvider>
  );
}

export const invoiceConfigRoute: DashboardRouteDefinition = {
  navMenuItem: {
    sectionId: 'settings',
    id: 'invoice-settings',
    url: '/invoice-settings',
    title: 'Invoices',
  },
  path: '/invoice-settings',
  loader: () => ({
    breadcrumb: 'Invoice Settings',
  }),
  component: InvoiceConfigPageComponent,
};
