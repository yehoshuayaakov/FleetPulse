import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link, RouterProvider } from 'react-aria-components';
import { Navigate, Route, Routes, useHref, useLocation, useNavigate } from 'react-router';
import { WriteToasts } from '../components/ui/WriteToasts';
import { FleetScreen } from '../screens/fleet/FleetScreen';
import { useFleetCatalog, useFleetStore } from '../fleet/FleetProvider';
import { mergeTruckAlert, type TruckAlerts } from '../screens/fleet/utils/truckAlerts';
import type { TruckAlert } from '../sharedSchemas/truckAlertSchema';
import { useDispatcherPresence } from '../components/dispatcher-presence/useDispatcherPresence';
import { useRoutes } from '../screens/routes/hooks/useRoutes';

const RoutesScreen = lazy(() => import('../screens/routes/RoutesScreen'));
const RouteForm = lazy(() => import('../screens/routes/components/RouteForm'));

export function App() {
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<{ truckId: string | null } | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const onFleet = location.pathname === '/';
  const catalog = useFleetCatalog();
  const { refresh: refreshFleet } = useFleetStore();
  const routeStore = useRoutes();
  const [alerts, setAlerts] = useState<TruckAlerts>(() => new Map());
  const acceptAlert = useCallback((alert: TruckAlert) => {
    setAlerts(previous => mergeTruckAlert(previous, alert));
  }, []);
  const resetDashboard = useCallback(() => {
    routeStore.resetRoutes();
    setAlerts(new Map());
    setAssignment(null);
    void refreshFleet();
  }, [refreshFleet, routeStore.resetRoutes]);
  const presence = useDispatcherPresence(onFleet ? selectedTruckId : null, routeStore.receiveEvent, acceptAlert, resetDashboard);
  const dispatcherId = presence.connection?.dispatcherId ?? null;
  const refreshRoutes = routeStore.refresh;
  const canAssign = dispatcherId !== null && routeStore.status === 'ready' && routeStore.syncedFor === dispatcherId;
  const reconnecting = presence.connection?.status === 'reconnecting';
  const updatesPaused = reconnecting
    || (dispatcherId !== null && routeStore.syncedFor !== dispatcherId);

  useLayoutEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (!reconnecting) void refreshRoutes(dispatcherId);
  }, [dispatcherId, reconnecting, refreshRoutes]);

  useEffect(() => {
    if (catalog) setSelectedTruckId(id => catalog.some(truck => truck.id === id) ? id : null);
  }, [catalog]);

  const truckNames = useMemo(() => new Map(catalog?.map(truck => [truck.id, truck.name])), [catalog]);
  const assignments = routeStore.assignments;
  const routeChoices = useMemo(() => (catalog ?? []).map(truck => {
    const assignment = assignments.get(truck.id);
    return {
      id: truck.id,
      name: truck.name,
      status: truck.status,
      routeStatus: assignment?.status,
      available: truck.status !== 'maintenance' && !assignment,
    };
  }), [catalog, assignments]);
  const availableTrucks = useMemo(() => routeChoices.filter(truck => truck.available), [routeChoices]);

  function dispatcherName(id: string) {
    return id === dispatcherId ? presence.name ?? id : presence.peers.find(peer => peer.id === id)?.label ?? id;
  }

  return (
    <RouterProvider navigate={navigate} useHref={useHref}>
      <div className="min-h-screen bg-canvas font-sans text-ink">
        <header className="border-b border-outline bg-surface">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
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
        <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
          <Routes>
            <Route path="/" element={
              <FleetScreen
                selectedId={selectedTruckId} setSelectedId={setSelectedTruckId}
                presence={presence} truckNames={truckNames}
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
                <RoutesScreen
                  routes={[...routeStore.routes.values()]} activity={routeStore.activity}
                  status={routeStore.status} hasSnapshot={routeStore.hasSnapshot}
                  presence={presence} truckNames={truckNames} dispatcherName={dispatcherName}
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
              initialTruckId={assignment.truckId} trucks={routeChoices}
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
