import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadRoutes } from '../../../api/routes/queries';
import type { FleetRoute, RouteEvent } from '../../../globalSchemas/routeSchema';
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

  const refresh = useCallback(async (dispatcherId: string | null) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoad(previous => ({ ...previous, status: 'loading' }));

    try {
      const routes = await loadRoutes(controller.signal);
      if (controller.signal.aborted) return null;
      setState(previous => mergeRouteSnapshot(previous, routes));
      setLoad({ status: 'ready', hasSnapshot: true, syncedFor: dispatcherId });
      return routes;
    } catch {
      if (!controller.signal.aborted) setLoad(previous => ({ ...previous, status: 'error' }));
      return null;
    }
  }, []);

  useEffect(() => () => request.current?.abort(), []);

  const receiveEvent = useCallback((event: RouteEvent) => {
    setState(previous => mergeRouteEvent(previous, event));
  }, []);

  function acceptCreation(route: FleetRoute) {
    receiveEvent({ type: 'route_assigned', route, assignedBy: route.assignedBy, timestamp: route.assignedAt });
  }

  const assignments = useMemo(() => activeAssignments(state.routes.values()), [state.routes]);
  return { ...state, ...load, assignments, refresh, receiveEvent, acceptCreation };
}
