import { Button, Disclosure, DisclosurePanel, Heading } from 'react-aria-components';
import type { TruckTelemetry } from '../utils/telemetryHealth';
import { StatusBadge } from '../../../components/StatusBadge';
import { RouteStatus } from '../../../components/RouteStatus';
import type { FleetRoute } from '../../../globalSchemas/routeSchema';
import type { TruckAlert } from '../../../globalSchemas/truckAlertSchema';
import { TruckAlertPanel } from './TruckAlertPanel';
import { TruckMeasurements } from './TruckMeasurements';
import { TruckMileage } from './TruckMileage';
import { TruckViewers } from './TruckViewers';

interface TruckCardProps {
  truck: TruckTelemetry;
  route: FleetRoute | null | undefined;
  canAssign: boolean;
  onAssign: () => void;
  alerts: readonly TruckAlert[];
  dispatcherId: string | null;
  onAlert: (alert: TruckAlert) => void;
  dispatcherName: (id: string) => string;
  viewers: readonly string[];
  isSelected: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

export function TruckCard({ truck, route, canAssign, onAssign, alerts, dispatcherId, onAlert, dispatcherName, viewers, isSelected, onExpandedChange }: TruckCardProps) {
  return (
    <Disclosure
      isExpanded={isSelected}
      onExpandedChange={onExpandedChange}
      className={`rounded-xl border bg-surface px-4 pb-4 ${isSelected ? 'border-accent' : 'border-outline'}`}
    >
      <Heading level={4}>
        <Button
          slot="trigger"
          className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="flex items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-canvas text-xs font-medium text-muted" aria-hidden="true">
              {truck.id.replace(/^truck_/, '')}
            </span>
            <span className="text-sm font-semibold">{truck.name}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <StatusBadge status={truck.status} />
            <span aria-hidden="true" className="text-muted">{isSelected ? '−' : '+'}</span>
          </span>
        </Button>
      </Heading>
      {route !== undefined && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          {route ? (
            <div className="flex min-w-0 items-center gap-2">
              <span className="break-words font-medium text-ink">{route.destination}</span>
              <RouteStatus status={route.status} />
            </div>
          ) : (
            <>
              <span className="text-muted">Unassigned</span>
              {truck.status === 'idle' && (
                <Button
                  onPress={onAssign} isDisabled={!canAssign}
                  className="cursor-pointer rounded px-1.5 py-1 font-medium text-accent outline-none hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Assign route
                </Button>
              )}
            </>
          )}
        </div>
      )}
      <TruckViewers names={viewers} />
      {truck.signalStale && (
        <p className="mb-2 text-xs font-medium text-warning">
          Signal stale{truck.positionAgeSeconds !== null && ` · position ${truck.positionAgeSeconds}s ago`}
        </p>
      )}
      {truck.signalStale && <p className="mb-1 text-xs font-medium text-muted">Last known readings</p>}
      {!isSelected && <TruckMeasurements truck={truck} />}
      <DisclosurePanel className="text-sm text-muted">
        {isSelected && (
          <>
            <TruckMeasurements truck={truck} expanded />
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              <TruckMileage key={truck.id} truckId={truck.id} />
              <div>
                <dt className="text-xs">Position</dt>
                <dd className="tabular-nums text-ink">{truck.location.lat.toFixed(4)}°, {truck.location.lng.toFixed(4)}°</dd>
              </div>
              <div>
                <dt className="text-xs">Heading</dt>
                <dd className="tabular-nums text-ink">{truck.heading.toFixed(0)}°</dd>
              </div>
            </dl>
            {route && (
              <section className="mt-3 border-t border-outline pt-3">
                <h5 className="text-xs font-semibold text-ink">Route details</h5>
                <dl className="mt-1 grid gap-1 text-xs">
                  <div className="flex gap-2"><dt>Priority</dt><dd className="capitalize text-ink">{route.priority}</dd></div>
                  {route.notes && (
                    <div><dt>Notes</dt><dd className="whitespace-pre-wrap break-words text-ink">{route.notes}</dd></div>
                  )}
                </dl>
              </section>
            )}
            <TruckAlertPanel
              truckId={truck.id} truckName={truck.name} alerts={alerts} dispatcherId={dispatcherId}
              onSent={onAlert} dispatcherName={dispatcherName}
            />
          </>
        )}
      </DisclosurePanel>
    </Disclosure>
  );
}
