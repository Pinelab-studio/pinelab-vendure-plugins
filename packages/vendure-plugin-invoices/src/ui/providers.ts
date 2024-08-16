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
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    onClick: async ({ injector, selection }) => {
      const notificationService =
        injector.get<NotificationService>(NotificationService);
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const nrs = selection.map((i) => i.invoiceNumber as string).join(',');
        const localStorageService = injector.get(LocalStorageService);
        const serverPath = getServerLocation();
        const res = await fetch(`${serverPath}/invoices/download?nrs=${nrs}`, {
          headers: getHeaders(localStorageService),
        });
        if (!res.ok) {
          const json = await res.json();
          notificationService.error(JSON.stringify(json?.message));
          throw Error(JSON.stringify(json?.message));
        }
        const blob = await res.blob();
        downloadBlob(blob, 'invoices.zip');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      } catch (err: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        notificationService.error(JSON.stringify(err?.message));
        throw Error(JSON.stringify(err));
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

export function downloadBlob(
  blob: Blob,
  fileName: string,
  openInNewTab = false
): void {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const blobUrl = window.URL.createObjectURL(blob);
  // eslint-disable-next-line  @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const a = document.createElement('a');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  document.body.appendChild(a);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  a.setAttribute('hidden', 'true');
  //  eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  a.href = blobUrl;
  if (!openInNewTab) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    a.download = fileName;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  a.setAttribute('target', '_blank');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  a.click();
}
