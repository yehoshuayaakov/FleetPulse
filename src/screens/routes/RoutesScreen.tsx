import { useState } from 'react';
import { Button, Cell, Column, Row, Table, TableBody, TableHeader } from 'react-aria-components';
import { DispatcherPresence, type DispatcherPresenceProps } from '../../components/dispatcher-presence/DispatcherPresence';
import { RouteStatus } from '../../components/RouteStatus';
import type { FleetRoute, RouteEvent } from '../../sharedSchemas/routeSchema';
import type { RouteActivity } from './utils/routeState';
import { RouteActions } from './components/RouteActions';

interface RoutesScreenProps {
  routes: readonly FleetRoute[];
  activity: ReadonlyMap<string, ReadonlyMap<number, RouteActivity>>;
  status: 'loading' | 'ready' | 'error';
  hasSnapshot: boolean;
  canAssign: boolean;
  assignmentHint: string | null;
  updatesPaused: boolean;
  presence: DispatcherPresenceProps['presence'];
  truckNames: ReadonlyMap<string, string>;
  dispatcherName: (id: string) => string;
  onNewRoute: () => void;
  onRefresh: () => Promise<FleetRoute[] | null>;
  dispatcherId: string | null;
  canWrite: boolean;
  availableTrucks: readonly { id: string; name: string }[];
  onSaved: (event: RouteEvent) => void;
}

export default function RoutesScreen({
  routes, activity, status, hasSnapshot, canAssign, assignmentHint, updatesPaused, presence,
  truckNames, dispatcherName, onNewRoute, onRefresh, dispatcherId, canWrite, availableTrucks, onSaved,
}: RoutesScreenProps) {
  const [selectedId, setSelectedId] = useState<string>();
  const selected = routes.find(route => route.id === selectedId);
  const observed = selected
    ? [...(activity.get(selected.id)?.values() ?? [])].sort((a, b) => b.timestamp - a.timestamp)
    : [];

  return (
    <section aria-labelledby="routes-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="routes-title" className="text-2xl font-semibold tracking-tight">Routes</h2>
        <Button
          onPress={onNewRoute} isDisabled={!canAssign}
          className="cursor-pointer rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          New route
        </Button>
      </div>
      <DispatcherPresence presence={presence} truckNames={truckNames} />

      {status === 'loading' && <p role="status" className="mb-3 text-sm text-muted">Loading routes…</p>}
      {status === 'error' && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-danger-soft px-3 py-2">
          <p role="alert" className="text-sm text-danger">{hasSnapshot ? 'Could not refresh routes. Showing the last available list.' : 'Could not load routes.'}</p>
          <Button onPress={() => void onRefresh()} className="text-sm font-semibold text-danger underline">Retry routes</Button>
        </div>
      )}
      {updatesPaused && <p role="status" className="mb-3 text-sm text-warning">Live route updates paused.</p>}
      {assignmentHint && <p className="mb-3 text-sm text-muted">{assignmentHint}</p>}

      {hasSnapshot && routes.length === 0 && <p className="rounded-xl border border-outline bg-surface p-5 text-sm text-muted">No routes assigned yet.</p>}
      {routes.length > 0 && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="overflow-x-auto rounded-xl border border-outline bg-surface">
            <Table
              aria-label="Fleet routes" className="w-full min-w-100 border-collapse text-left text-sm"
              selectionMode="single" selectionBehavior="replace"
              selectedKeys={selectedId ? [selectedId] : []}
              onSelectionChange={keys => setSelectedId(keys === 'all' ? undefined : String([...keys][0] ?? '') || undefined)}
            >
              <TableHeader className="border-b border-outline bg-canvas text-xs text-muted">
                <Column isRowHeader className="px-4 py-3">Destination</Column>
                <Column className="px-4 py-3">Truck</Column>
                <Column className="px-4 py-3">Status</Column>
                <Column className="px-4 py-3">Priority</Column>
              </TableHeader>
              <TableBody items={routes}>
                {route => (
                  <Row id={route.id} className="cursor-pointer border-b border-outline outline-none last:border-0 data-[focused]:bg-canvas data-[selected]:bg-accent-soft">
                    <Cell className="break-words px-4 py-3 font-medium">{route.destination}</Cell>
                    <Cell className="px-4 py-3">{truckNames.get(route.truckId) ?? route.truckId}</Cell>
                    <Cell className="px-4 py-3"><RouteStatus status={route.status} /></Cell>
                    <Cell className="px-4 py-3 capitalize">{route.priority}</Cell>
                  </Row>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="rounded-xl border border-outline bg-surface p-4">
            {selected ? (
              <>
                <h3 className="break-words text-base font-semibold">{selected.destination}</h3>
                <dl className="mt-3 grid gap-2 text-sm">
                  <div><dt className="text-xs text-muted">Assigned by</dt><dd>{dispatcherName(selected.assignedBy)}</dd></div>
                  <div><dt className="text-xs text-muted">Assigned at</dt><dd>{new Date(selected.assignedAt).toLocaleString()}</dd></div>
                  {selected.lastModifiedBy && (
                    <div>
                      <dt className="text-xs text-muted">Last updated by</dt>
                      <dd>{dispatcherName(selected.lastModifiedBy)}{selected.lastModifiedAt !== undefined && ` · ${new Date(selected.lastModifiedAt).toLocaleString()}`}</dd>
                    </div>
                  )}
                  {selected.reassignedBy && (
                    <div>
                      <dt className="text-xs text-muted">Reassigned by</dt>
                      <dd>{dispatcherName(selected.reassignedBy)}{selected.reassignedAt !== undefined && ` · ${new Date(selected.reassignedAt).toLocaleString()}`}</dd>
                    </div>
                  )}
                  {selected.notes && <div><dt className="text-xs text-muted">Notes</dt><dd className="whitespace-pre-wrap break-words">{selected.notes}</dd></div>}
                </dl>
                <RouteActions
                  key={selected.id} route={selected} dispatcherId={dispatcherId} canWrite={canWrite}
                  availableTrucks={availableTrucks} activity={activity.get(selected.id)} truckNames={truckNames}
                  dispatcherName={dispatcherName} onRefresh={onRefresh} onSaved={onSaved}
                />
                <h4 className="mt-4 text-sm font-semibold">Observed activity</h4>
                {observed.length ? (
                  <ul className="mt-2 space-y-2 text-sm">
                    {observed.map(entry => (
                      <li key={entry.version}>
                        <p>{entry.action} · {dispatcherName(entry.actor)}</p>
                        <p className="text-xs text-muted">{new Date(entry.timestamp).toLocaleTimeString()}</p>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-1 text-sm text-muted">No live changes observed in this session.</p>}
              </>
            ) : <p className="text-sm text-muted">Select a route to see its details.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
