import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Button } from 'react-aria-components';
import type { FleetRoute } from '../../sharedSchemas/routeSchema';
import type { TruckAlert } from '../../sharedSchemas/truckAlertSchema';
import type { TruckAlerts } from './utils/truckAlerts';
import type { TelemetryStatus } from '../../realtime/telemetryStream';
import { useFleetStore, useFleetView } from '../../fleet/FleetProvider';
import { DispatcherPresence, type DispatcherPresenceProps } from '../../components/dispatcher-presence/DispatcherPresence';
import { FleetFilters } from './components/FleetFilters';
import { TruckCard } from './components/TruckCard';
import { TruckGrid } from './components/TruckGrid';
import { emptyFleetFilter, isFleetFilterActive, visibleTrucks } from './utils/fleetFilter';

const telemetryLabels = {
  connecting: 'Connecting to telemetry…',
  connected: 'Telemetry connected',
  reconnecting: 'Reconnecting to telemetry…',
  unavailable: 'Telemetry unavailable',
} satisfies Record<TelemetryStatus, string>;

interface FleetScreenProps {
  selectedId: string | null;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  presence: DispatcherPresenceProps['presence'];
  truckNames: ReadonlyMap<string, string>;
  assignments: ReadonlyMap<string, FleetRoute> | null;
  assignmentWarning: boolean;
  onRetryAssignments?: () => void;
  canAssign: boolean;
  onAssign: (truckId: string) => void;
  alerts: TruckAlerts;
  dispatcherId: string | null;
  onAlert: (alert: TruckAlert) => void;
  dispatcherName: (id: string) => string;
}

export function FleetScreen({ selectedId, setSelectedId, presence, truckNames, assignments, assignmentWarning, onRetryAssignments, canAssign, onAssign, alerts, dispatcherId, onAlert, dispatcherName }: FleetScreenProps) {
  const { status, snapshot, telemetryStatus, trucks } = useFleetView();
  const { reconnect, refresh } = useFleetStore();
  const { viewersByTruck } = presence;
  const [filter, setFilter] = useState(emptyFleetFilter);
  const shown = trucks ? visibleTrucks(trucks, assignments, selectedId, filter) : null;
  const filtering = isFleetFilterActive(filter);
  const truckList = useRef<HTMLUListElement>(null);
  const selectedCard = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const list = truckList.current;
    const card = selectedCard.current;
    if (!list || !card || list.scrollHeight <= list.clientHeight) return;

    const listTop = list.getBoundingClientRect().top + list.clientTop;
    const listBottom = listTop + list.clientHeight;
    const { top, bottom } = card.getBoundingClientRect();
    if (top < listTop) {
      list.scrollTop += top - listTop;
    } else if (bottom > listBottom) {
      list.scrollTop += Math.min(top - listTop, bottom - listBottom);
    }
  }, [selectedId]);

  const snapshotDate = snapshot ? new Date(snapshot.timestamp) : null;

  return (
    <section aria-labelledby="fleet-title">
      <div className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="fleet-title" className="text-2xl font-semibold tracking-tight">Fleet overview</h2>
          <div className="flex flex-wrap items-center gap-2">
            {telemetryStatus === 'unavailable' && (
              <Button
                onPress={reconnect}
                className="cursor-pointer rounded-lg border border-outline bg-surface px-3 py-2 text-sm font-medium text-accent outline-none hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent"
              >
                Reconnect telemetry
              </Button>
            )}
            {(snapshot || status === 'error') && (
              <Button
                onPress={refresh}
                isPending={status === 'loading'}
                className="cursor-pointer rounded-lg border border-outline bg-surface px-3 py-2 text-sm font-medium text-accent outline-none hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent data-[pending]:cursor-wait data-[pending]:opacity-70"
              >
                {status === 'loading' ? 'Refreshing…' : status === 'error' ? 'Retry' : 'Refresh snapshot'}
              </Button>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <p
            role="status"
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${telemetryStatus === 'connected' ? 'bg-active-soft text-active' : 'bg-warning-soft text-warning'}`}
          >
            {telemetryLabels[telemetryStatus]}
          </p>
          {snapshotDate && (
            <p className="text-xs text-muted">
              Fleet snapshot at{' '}
              <time dateTime={snapshotDate.toISOString()}>{snapshotDate.toLocaleTimeString()}</time>
            </p>
          )}
        </div>
      </div>

      {status === 'loading' && <p role="status" className="mb-4 text-sm text-muted">Loading fleet snapshot…</p>}
      {status === 'error' && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">
          {snapshot ? 'Could not refresh the fleet snapshot. Showing the last available fleet data.' : 'Could not load the fleet.'}
        </p>
      )}

      <DispatcherPresence presence={presence} truckNames={truckNames} selectedTruckId={selectedId} />
      {assignmentWarning && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-warning">
          <p role="status">Truck assignments may be out of date.</p>
          {onRetryAssignments && (
            <Button onPress={onRetryAssignments} className="font-medium underline">Retry routes</Button>
          )}
        </div>
      )}

      {trucks && trucks.length > 0 && (
        <FleetFilters filter={filter} onChange={setFilter} assignmentReady={assignments !== null} />
      )}

      {trucks && (
        trucks.length === 0 ? (
          <p className="rounded-xl border border-outline bg-surface p-5 text-muted">No trucks in this snapshot.</p>
        ) : (
          <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_clamp(20rem,28vw,24rem)]">
            <TruckGrid trucks={shown ?? []} selectedId={selectedId} onSelect={setSelectedId} viewersByTruck={viewersByTruck} />
            <section aria-labelledby="truck-list-title" className="grid min-w-0 grid-rows-[auto_1fr] gap-3">
              <div className="flex items-baseline justify-between">
                <h3 id="truck-list-title" className="text-base font-semibold">Truck list</h3>
                <p className="text-sm tabular-nums text-muted">
                  {filtering ? `${shown?.length ?? 0} of ${trucks.length} trucks` : `${trucks.length} trucks`}
                </p>
              </div>
              <div className="relative">
                {shown?.length === 0 ? (
                  <p className="rounded-xl border border-outline bg-surface p-5 text-sm text-muted">No trucks match these filters.</p>
                ) : (
                  <ul ref={truckList} className="space-y-3 lg:absolute lg:inset-0 lg:overflow-y-auto lg:p-0.5">
                    {shown?.map(truck => (
                      <li key={truck.id} ref={selectedId === truck.id ? selectedCard : undefined}>
                        <TruckCard
                          truck={truck}
                          alerts={alerts.get(truck.id) ?? []} dispatcherId={dispatcherId}
                          onAlert={onAlert} dispatcherName={dispatcherName}
                          route={assignments ? assignments.get(truck.id) ?? null : undefined}
                          canAssign={canAssign}
                          onAssign={() => onAssign(truck.id)}
                          viewers={viewersByTruck.get(truck.id) ?? []}
                          isSelected={selectedId === truck.id}
                          onExpandedChange={expanded => setSelectedId(expanded ? truck.id : null)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        )
      )}
    </section>
  );
}
