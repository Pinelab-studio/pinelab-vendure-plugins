import {
  addNavMenuItem,
  registerBulkAction,
  getServerLocation,
  LocalStorageService,
  NotificationService,
} from '@vendure/admin-ui/core';

export default [
  addNavMenuItem(
    {
      id: 'invoice-list',
      label: 'Invoices',
      routerLink: ['/extensions/invoice-list'],
      requiresPermission: 'AllowInvoicesPermission',
      icon: 'star',
    },
    'sales'
  ),
  registerBulkAction({
    location: 'invoice-list',
    label: 'Download',
    icon: 'download',
    onClick: async ({ injector, selection }) => {
      const notificationService = injector.get(NotificationService);
      try {
        const nrs = selection.map((i) => i.invoiceNumber).join(',');
        const localStorageService = injector.get(LocalStorageService);
        const serverPath = getServerLocation();
        const res = await fetch(`${serverPath}/invoices/download?nrs=${nrs}`, {
          headers: getHeaders(localStorageService),
        });
        if (!res.ok) {
          const json = await res.json();
          notificationService.error(json?.message);
          throw Error(json?.message);
        }
        const blob = await res.blob();
        await downloadBlob(blob, 'invoices.zip');
      } catch (err: any) {
        notificationService.error(err?.message);
        throw Error(err);
      }
    },
  }),
];

export function getHeaders(
  localStorageService: LocalStorageService
): Record<string, string> {
  const headers: Record<string, string> = {};
  const channelToken = localStorageService.get('activeChannelToken');
  if (channelToken) {
    headers['vendure-token'] = channelToken;
  }
  const authToken = localStorageService.get('authToken');
  if (authToken) {
    headers.authorization = `Bearer ${authToken}`;
  }
  return headers;
}

export async function downloadBlob(
  blob: Blob,
  fileName: string,
  openInNewTab = false
): Promise<void> {
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  document.body.appendChild(a);
  a.setAttribute('hidden', 'true');
  a.href = blobUrl;
  if (!openInNewTab) {
    a.download = fileName;
  }
  a.setAttribute('target', '_blank');
  a.click();
}
