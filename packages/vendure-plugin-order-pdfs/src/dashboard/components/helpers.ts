import { LocalStorageService } from '@vendure/admin-ui/core';

/**
 * Make the downloaded blob popup in the browser.
 * Opens the PDF in new browser tab, or prompts a download if its a ZIP file
 */
export async function downloadBlob(
  blob: Blob,
  fileName: string
): Promise<void> {
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  document.body.appendChild(a);
  a.setAttribute('hidden', 'true');
  a.href = blobUrl;
  a.download = fileName;
  a.setAttribute('target', '_blank');
  a.click();
}

/**
 * Get the channel token and auth token from local storage
 */
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
  headers['Content-Type'] = 'application/json';
  return headers;
}
