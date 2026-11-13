import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadRoutes } from '../../../api/routes/queries';
import type { FleetRoute, RouteEvent } from '../../../sharedSchemas/routeSchema';
import { activeAssignments, emptyRouteState, mergeRouteEvent, mergeRouteSnapshot } from '../utils/routeState';

interface RouteLoad {
  status: 'loading' | 'ready' | 'error';
  hasSnapshot: boolean;
  syncedFor: string | null;
}

export function useRoutes() {
  const [state, setState] = useState(emptyRouteState);
  const [load, setLoad] = useState<RouteLoad>({ status: 'loading', hasSnapshot: false, syncedFor: null });
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);

  const refresh = useCallback(async (dispatcherId: string | null) => {
    request.current?.abort();
    const controller = new AbortController();
    const token = generation.current;
    request.current = controller;
    setLoad(previous => ({ ...previous, status: 'loading' }));

    try {
      const routes = await loadRoutes(controller.signal);
      if (controller.signal.aborted || token !== generation.current) return null;
      setState(previous => mergeRouteSnapshot(previous, routes));
      setLoad({ status: 'ready', hasSnapshot: true, syncedFor: dispatcherId });
      return routes;
    } catch {
      if (!controller.signal.aborted && token === generation.current) setLoad(previous => ({ ...previous, status: 'error' }));
      return null;
    }
  }, []);

  const resetRoutes = useCallback(() => {
    generation.current += 1;
    request.current?.abort();
    setState(emptyRouteState);
    setLoad(previous => ({ status: 'ready', hasSnapshot: true, syncedFor: previous.syncedFor }));
  }, []);

  useEffect(() => () => request.current?.abort(), []);

  const receiveEvent = useCallback((event: RouteEvent) => {
    setState(previous => mergeRouteEvent(previous, event));
  }, []);

  function acceptCreation(route: FleetRoute) {
    receiveEvent({ type: 'route_assigned', route, assignedBy: route.assignedBy, timestamp: route.assignedAt });
  }

  const assignments = useMemo(() => activeAssignments(state.routes.values()), [state.routes]);
  return { ...state, ...load, assignments, refresh, resetRoutes, receiveEvent, acceptCreation };
}
