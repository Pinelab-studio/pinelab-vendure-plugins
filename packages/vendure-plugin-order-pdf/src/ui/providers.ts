import {
  addActionBarDropdownMenuItem,
  addNavMenuItem,
  DataService,
  getServerLocation,
  LocalStorageService,
  ModalService,
  NotificationService,
  registerBulkAction,
} from '@vendure/admin-ui/core';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { PdfTemplate, PdfTemplateNamesQuery } from './generated/graphql';
import { downloadBlob, getHeaders } from './helpers';
import { getTemplateNames } from './queries.graphql';
import { ID } from '@vendure/core';

async function getEnabledTemplates(dataService: DataService) {
  const templateNames = await firstValueFrom(
    dataService
      .query<PdfTemplateNamesQuery>(getTemplateNames)
      .mapStream((d) => d.pdfTemplates.items)
  );
  return templateNames.filter((t) => t.enabled);
}

/**
 * Show dialog with templates, and return the user selected templateID
 */
async function promptTemplateSelection(
  modalService: ModalService,
  templates: Array<Pick<PdfTemplate, 'name' | 'id'>>,
  nrOfOrders: number
) {
  return await firstValueFrom(
    modalService.dialog({
      title: `Select a PDF template`,
      body: `You are about to download PDF files for ${nrOfOrders} order(s). Please select a template to use.`,
      size: 'xl',
      buttons: [
        { type: 'secondary', label: 'cancel', returnValue: null },
        // Render all templates as buttons
        ...templates.map((t) => ({
          type: 'primary' as const,
          label: t.name,
          returnValue: t.id,
        })),
      ],
    })
  );
}

/**
 * Download the actual PDF files or ZIP file if multiple orders
 */
async function startDownload(
  notificationService: NotificationService,
  localStorageService: LocalStorageService,
  templateId: ID,
  orderCodes: string[]
) {
  notificationService.info('Starting download...');
  const serverPath = getServerLocation();
  const res = await fetch(
    `${serverPath}/order-pdf/download/${templateId}?orderCodes=${orderCodes.join(
      ','
    )}`,
    {
      headers: getHeaders(localStorageService),
      method: 'GET',
    }
  );
  if (!res.ok) {
    const json = await res.json();
    throw Error(json?.message);
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const blob = await res.blob();
  const fileName = orderCodes.length > 1 ? `orders.zip` : 'order.pdf';
  await downloadBlob(blob, fileName, true);
}

export default [
  addNavMenuItem(
    {
      id: 'pdf-templates',
      label: 'PDF Templates',
      routerLink: ['/extensions/pdf-templates'],
      requiresPermission: 'AllowPDFDownload',
      icon: 'printer',
    },
    'settings'
  ),
  addActionBarDropdownMenuItem({
    id: 'print-invoice',
    locationId: 'order-detail',
    label: 'Download PDF',
    icon: 'printer',
    requiresPermission: 'AllowPDFDownload',
    hasDivider: true,
    onClick: async (event, context) => {
      const order = await firstValueFrom(context.entity$);
      const templateNames = await getEnabledTemplates(context.dataService);
      // Prompt template selection
      const modalService = context.injector.get(ModalService);
      const selectedTemplateId = await promptTemplateSelection(
        modalService,
        templateNames,
        1
      );
      if (!selectedTemplateId) {
        return;
      }
      // Download the actual PDFs
      const localStorageService = context.injector.get(LocalStorageService);
      const notificationService = context.injector.get(NotificationService);
      const orderCode = order?.code;
      console.log('asdfasdfasd', orderCode);
      await startDownload(
        notificationService,
        localStorageService,
        selectedTemplateId,
        [orderCode]
      ).catch((e) => {
        notificationService.error(e?.message);
      });
    },
  }),
  registerBulkAction({
    location: 'order-list',
    label: 'Download PDF',
    icon: 'printer',
    requiresPermission: 'AllowPDFDownload',
    onClick: async ({ injector, selection }) => {
      const dataService = injector.get(DataService);
      const templateNames = await getEnabledTemplates(dataService);
      // Prompt template selection
      const modalService = injector.get(ModalService);
      const selectedTemplateId = await promptTemplateSelection(
        modalService,
        templateNames,
        selection.length
      );
      if (!selectedTemplateId) {
        return;
      }
      // Download the actual PDFs
      const localStorageService = injector.get(LocalStorageService);
      const notificationService = injector.get(NotificationService);
      const orderCodes = selection.map((s) => s.code);
      await startDownload(
        notificationService,
        localStorageService,
        selectedTemplateId,
        orderCodes
      ).catch((e) => {
        notificationService.error(e?.message);
      });
    },
  }),
];
