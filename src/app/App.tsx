import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link, RouterProvider } from 'react-aria-components';
import { Navigate, Route, Routes, useHref, useLocation, useNavigate } from 'react-router';
import { WriteToasts } from '../components/ui/WriteToasts';
import { FleetView } from '../features/fleet/components/FleetView';
import { useFleetData } from '../features/fleet/hooks/useFleetData';
import { mergeTruckAlert, type TruckAlerts } from '../features/fleet/utils/truckAlerts';
import type { TruckAlert } from '../globalSchemas/truckAlertSchema';
import { DispatcherPresence } from '../features/presence/components/DispatcherPresence';
import { useDispatcherPresence } from '../features/presence/hooks/useDispatcherPresence';
import { useRoutes } from '../features/routes/hooks/useRoutes';

const RoutesView = lazy(() => import('../features/routes/components/RoutesView'));
const RouteForm = lazy(() => import('../features/routes/components/RouteForm'));

export function App() {
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<{ truckId: string | null } | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const onFleet = location.pathname === '/';
  const fleet = useFleetData(setSelectedTruckId);
  const routeStore = useRoutes();
  const [alerts, setAlerts] = useState<TruckAlerts>(() => new Map());
  const acceptAlert = useCallback((alert: TruckAlert) => {
    setAlerts(previous => mergeTruckAlert(previous, alert));
  }, []);
  const presence = useDispatcherPresence(onFleet ? selectedTruckId : null, routeStore.receiveEvent, acceptAlert);
  const dispatcherId = presence.connection?.dispatcherId ?? null;
  const refreshRoutes = routeStore.refresh;
  const canAssign = dispatcherId !== null && routeStore.status === 'ready' && routeStore.syncedFor === dispatcherId;
  const reconnecting = presence.connection?.status === 'reconnecting';
  const updatesPaused = reconnecting
    || (dispatcherId !== null && routeStore.syncedFor !== dispatcherId);

  useEffect(() => {
    if (!reconnecting) void refreshRoutes(dispatcherId);
  }, [dispatcherId, reconnecting, refreshRoutes]);

  const truckNames = new Map(fleet.trucks?.map(truck => [truck.id, truck.name]));
  const availableTrucks = (fleet.trucks ?? []).filter(truck =>
    truck.status !== 'maintenance' && !routeStore.assignments.has(truck.id),
  );
  const presenceRow = (
    <DispatcherPresence
      presence={presence} truckNames={truckNames} selectedTruckId={onFleet ? selectedTruckId : null}
    />
  );

  function dispatcherName(id: string) {
    return id === dispatcherId ? presence.name ?? id : presence.peers.find(peer => peer.id === id)?.label ?? id;
  }

  return (
    <RouterProvider navigate={navigate} useHref={useHref}>
      <div className="min-h-screen bg-canvas font-sans text-ink">
        <header className="border-b border-outline bg-surface">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
            <h1 className="text-xl font-semibold tracking-tight text-accent">FleetPulse</h1>
            <nav aria-label="Main navigation" className="flex gap-1">
              {([{ href: '/', label: 'Fleet' }, { href: '/routes', label: 'Routes' }]).map(({ href, label }) => (
                <Link
                  key={href} href={href} aria-current={location.pathname === href ? 'page' : undefined}
                  className={`cursor-pointer rounded-lg px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent ${location.pathname === href ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-canvas'}`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
          <Routes>
            <Route path="/" element={
              <FleetView
                fleet={fleet} selectedId={selectedTruckId} setSelectedId={setSelectedTruckId}
                viewersByTruck={presence.viewersByTruck} presenceRow={presenceRow}
                assignments={routeStore.hasSnapshot ? routeStore.assignments : null}
                assignmentWarning={routeStore.status === 'error' || updatesPaused}
                onRetryAssignments={routeStore.status === 'error' ? () => void refreshRoutes(dispatcherId) : undefined}
                canAssign={canAssign}
                onAssign={truckId => setAssignment({ truckId })}
                alerts={alerts} dispatcherId={dispatcherId} onAlert={acceptAlert} dispatcherName={dispatcherName}
              />
            } />
            <Route path="/routes" element={
              <Suspense fallback={<p role="status" className="text-sm text-muted">Loading Routes…</p>}>
                <RoutesView
                  routes={[...routeStore.routes.values()]} activity={routeStore.activity}
                  status={routeStore.status} hasSnapshot={routeStore.hasSnapshot}
                  presenceRow={presenceRow} truckNames={truckNames} dispatcherName={dispatcherName}
                  canAssign={canAssign && availableTrucks.length > 0} updatesPaused={updatesPaused}
                  assignmentHint={presence.connection === null ? 'Join as a dispatcher to assign routes.'
                    : canAssign && availableTrucks.length === 0 ? 'No trucks are available for assignment.' : null}
                  onNewRoute={() => setAssignment({ truckId: null })}
                  onRefresh={() => refreshRoutes(dispatcherId)}
                  dispatcherId={dispatcherId} canWrite={canAssign} availableTrucks={availableTrucks}
                  onSaved={routeStore.receiveEvent}
                />
              </Suspense>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        {assignment && (
          <Suspense fallback={<p role="status" className="fixed bottom-4 right-4 rounded-lg bg-surface px-3 py-2 text-sm text-muted shadow">Loading assignment form…</p>}>
            <RouteForm
              initialTruckId={assignment.truckId} trucks={availableTrucks}
              dispatcherId={dispatcherId} canWrite={canAssign}
              onRefresh={() => refreshRoutes(dispatcherId)} onCreated={routeStore.acceptCreation}
              onClose={() => setAssignment(null)} dispatcherName={dispatcherName}
            />
          </Suspense>
        )}
        <WriteToasts />
      </div>
    </RouterProvider>
  );
}
