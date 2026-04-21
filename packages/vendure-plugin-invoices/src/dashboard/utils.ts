import { getApiBaseUrl } from '@/vdb/utils/config-utils.js';

const LS_SESSION_TOKEN = 'vendure-session-token';
const LS_CHANNEL_TOKEN = 'vendure-selected-channel-token';

/**
 * Get auth and channel headers for REST calls to the Vendure server.
 * Reads tokens from localStorage (same keys Vendure dashboard uses internally).
 */
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const sessionToken = localStorage.getItem(LS_SESSION_TOKEN);
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }
  const channelToken = localStorage.getItem(LS_CHANNEL_TOKEN);
  if (channelToken) {
    headers['vendure-token'] = channelToken;
  }
  return headers;
}

/** Get the base URL for the Vendure server (e.g. http://localhost:3050) */
export function getServerBaseUrl(): string {
  return getApiBaseUrl();
}

/** Download a blob as a file, or open it in a new tab */
export function downloadBlob(
  blob: Blob,
  fileName: string,
  openInNewTab = false
): void {
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
  document.body.removeChild(a);
  window.URL.revokeObjectURL(blobUrl);
}
