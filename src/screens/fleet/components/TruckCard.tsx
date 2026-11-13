import { Button, Disclosure, DisclosurePanel, Heading } from 'react-aria-components';
import type { TruckTelemetry } from '../../../fleet/telemetryHealth';
import { StatusBadge } from '../../../components/StatusBadge';
import { RouteStatus } from '../../../components/RouteStatus';
import type { FleetRoute } from '../../../sharedSchemas/routeSchema';
import type { TruckAlert } from '../../../sharedSchemas/truckAlertSchema';
import { TruckAlertPanel } from './TruckAlertPanel';
import { TruckMeasurements } from './TruckMeasurements';
import { TruckMileage } from './TruckMileage';
import { TruckViewers } from './TruckViewers';

const numberStatus = {
  active: 'bg-active text-white',
  idle: 'border border-idle bg-idle-soft text-idle',
  maintenance: 'bg-maintenance text-white',
};

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
  const eligibleForAssignment = truck.status !== 'maintenance' && route === null;

  return (
    <Disclosure
      isExpanded={isSelected}
      onExpandedChange={onExpandedChange}
      className={`rounded-xl border bg-surface px-4 pb-4 ${isSelected ? 'border-accent' : 'border-outline'}`}
    >
      <Heading level={4}>
        <Button
          slot="trigger"
          className="group flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className={`grid size-7 shrink-0 place-items-center rounded-md text-xs font-semibold ${numberStatus[truck.status]}`}
            >
              {truck.id.replace(/^truck_/, '')}
            </span>
            <span className="text-sm font-semibold">{truck.name}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-md bg-accent-soft px-2 py-1.5 text-xs font-semibold text-accent group-hover:bg-accent group-hover:text-white">
            {isSelected ? 'Hide details' : 'Show details'}
            <span
              aria-hidden="true"
              className={`size-1.5 border-r border-b ${isSelected ? 'translate-y-0.5 rotate-225' : '-translate-y-0.5 rotate-45'}`}
            />
          </span>
        </Button>
      </Heading>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <StatusBadge status={truck.status} />
        {route && (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="break-words font-medium text-ink">{route.destination}</span>
            <RouteStatus status={route.status} />
          </div>
        )}
        {route === null && <RouteStatus status="unassigned" />}
        {!isSelected && eligibleForAssignment && <span className="text-muted">Show details to assign a route.</span>}
      </div>
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
            {eligibleForAssignment && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button
                  onPress={onAssign} isDisabled={!canAssign}
                  className="cursor-pointer rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Assign route
                </Button>
                {dispatcherId === null && <span className="text-xs">Join as a dispatcher to assign a route.</span>}
              </div>
            )}
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
