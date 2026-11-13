import { lazy, Suspense, useState } from 'react';
import { Button, Disclosure, DisclosurePanel } from 'react-aria-components';
import type { TruckAlert } from '../../../sharedSchemas/truckAlertSchema';
const SendAlertForm = lazy(() => import('./SendAlertForm'));

interface TruckAlertPanelProps {
  truckId: string;
  truckName: string;
  alerts: readonly TruckAlert[];
  dispatcherId: string | null;
  onSent: (alert: TruckAlert) => void;
  dispatcherName: (id: string) => string;
}

const severityStyle: Record<string, string> = {
  info: 'bg-accent-soft text-accent',
  warning: 'bg-warning-soft text-warning',
  critical: 'bg-danger-soft text-danger',
};

export function TruckAlertPanel({ truckId, truckName, alerts, dispatcherId, onSent, dispatcherName }: TruckAlertPanelProps) {
  const [hasOpened, setHasOpened] = useState(false);

  return (
    <section aria-label={'Alerts for ' + truckName} className="mt-3 grid gap-2 border-t border-outline pt-3">
      <Disclosure onExpandedChange={expanded => { if (expanded) setHasOpened(true); }}>
        <Button slot="trigger" className="cursor-pointer rounded-sm text-sm font-semibold text-accent underline outline-none focus-visible:ring-2 focus-visible:ring-accent">
          Send alert
        </Button>
        <DisclosurePanel>
          {hasOpened && (
            <div className="mt-2">
              <Suspense fallback={<p role="status" className="text-xs text-muted">Loading alert form…</p>}>
                <SendAlertForm truckId={truckId} truckName={truckName} dispatcherId={dispatcherId} onSent={onSent} />
              </Suspense>
            </div>
          )}
        </DisclosurePanel>
      </Disclosure>
      {alerts.length > 0 && (
        <ul aria-label="Recent alerts" className="max-h-44 space-y-2 overflow-y-auto">
          {alerts.map(alert => (
            <li key={alert.id} className="min-w-0 rounded-lg border border-outline bg-surface px-3 py-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className={`rounded-full px-2 py-0.5 font-medium capitalize ${severityStyle[alert.severity] ?? 'bg-canvas text-muted'}`}>
                  {alert.severity}
                </span>
                <span>{alert.sentBy ? dispatcherName(alert.sentBy) : 'Unknown dispatcher'}</span>
                <time dateTime={new Date(alert.timestamp).toISOString()}>{new Date(alert.timestamp).toLocaleTimeString()}</time>
              </div>
              <p className="mt-1 break-words text-sm text-ink">{alert.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
