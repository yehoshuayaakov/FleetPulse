import { useEffect, useMemo, useRef, useState } from 'react';
import type { RouteEvent } from '../../../globalSchemas/routeSchema';
import type { TruckAlert } from '../../../globalSchemas/truckAlertSchema';
import { connectDispatcher, type DispatcherConnection } from '../../../realtime/dispatcherSocket';
import { applyPeerEvent, groupViewers, presentPeers, type DispatcherPeers } from '../utils/presenceState';

const emptyPeers: DispatcherPeers = new Map();

export function useDispatcherPresence(truckId: string | null, onRouteEvent: (event: RouteEvent) => void, onAlert: (alert: TruckAlert) => void) {
  const [name, setName] = useState<string | null>(null);
  const [connection, setConnection] = useState<DispatcherConnection | null>(null);
  const [peers, setPeers] = useState<DispatcherPeers>(emptyPeers);
  const socket = useRef<ReturnType<typeof connectDispatcher> | null>(null);

  useEffect(() => {
    if (name === null) return;

    const client = connectDispatcher(name, {
      onConnection: next => {
        setConnection(next);
        if (next.status !== 'connected') setPeers(emptyPeers);
      },
      onPeerEvent: event => setPeers(previous => applyPeerEvent(previous, event)),
      onRouteEvent,
      onAlert,
    });
    socket.current = client;
    return () => {
      socket.current = null;
      client.close();
    };
  }, [name, onRouteEvent, onAlert]);

  useEffect(() => {
    function reportViewing() {
      socket.current?.setViewingTruck(document.visibilityState === 'visible' ? truckId : null);
    }

    reportViewing();
    document.addEventListener('visibilitychange', reportViewing);
    return () => document.removeEventListener('visibilitychange', reportViewing);
  }, [name, truckId]);

  const visiblePeers = useMemo(() => presentPeers(peers), [peers]);
  const viewersByTruck = useMemo(() => groupViewers(visiblePeers), [visiblePeers]);

  function register(displayName: string) {
    setConnection({ status: 'connecting', dispatcherId: null });
    setName(displayName);
  }

  return { name, connection, peers: visiblePeers, viewersByTruck, register };
}
