import { Badge } from '@vendure/dashboard';
import { AlertTriangleIcon, XCircleIcon } from 'lucide-react';

export interface ContentCheckFindingsListMessage {
  severity: string;
  source: string;
  message: string;
  languageCode: string;
}

/**
 * Renders a flat list of findings (already flattened across every checked
 * language) with a severity icon, language badge, and check source.
 * Shared between the product/collection detail-page block and the
 * standalone issue detail page so both stay visually consistent.
 */
export function ContentCheckFindingsList({
  messages,
  emptyMessage = 'All good ✅',
}: {
  messages: ContentCheckFindingsListMessage[];
  emptyMessage?: string;
}) {
  if (messages.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2">
      {messages.map((m, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
            m.severity === 'ERROR'
              ? 'border-destructive/50 bg-destructive/10'
              : 'border-yellow-500/50 bg-yellow-500/10'
          }`}
        >
          {m.severity === 'ERROR' ? (
            <XCircleIcon className="h-4 w-4 shrink-0 text-destructive" />
          ) : (
            <AlertTriangleIcon className="h-4 w-4 shrink-0 text-yellow-600" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{m.languageCode}</Badge>
              <span className="text-xs text-muted-foreground">{m.source}</span>
            </div>
            <p>{m.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
