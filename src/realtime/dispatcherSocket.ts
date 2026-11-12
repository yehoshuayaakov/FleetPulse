import { dispatcherEventSchema, type DispatcherPeerEvent } from '../globalSchemas/dispatcherSchemas';
import { routeEventSchema, type RouteEvent } from '../globalSchemas/routeSchema';
import { truckAlertEventSchema, type TruckAlert } from '../globalSchemas/truckAlertSchema';

const INITIAL_RETRY_MS = 1000;
const MAX_RETRY_MS = 30_000;
const REGISTRATION_TIMEOUT_MS = 10_000;

export type DispatcherConnection =
  | { status: 'connecting' | 'reconnecting'; dispatcherId: null }
  | { status: 'connected'; dispatcherId: string };

interface DispatcherHandlers {
  onConnection: (connection: DispatcherConnection) => void;
  onPeerEvent: (event: DispatcherPeerEvent) => void;
  onRouteEvent?: (event: RouteEvent) => void;
  onAlert?: (alert: TruckAlert) => void;
}

function parseEvent(data: unknown) {
  if (typeof data !== 'string') return null;
  try {
    const payload: unknown = JSON.parse(data);
    const dispatcher = dispatcherEventSchema.safeParse(payload);
    if (dispatcher.success) return dispatcher.data;
    const route = routeEventSchema.safeParse(payload);
    if (route.success) return route.data;
    const alert = truckAlertEventSchema.safeParse(payload);
    return alert.success ? alert.data : null;
  } catch {
    return null;
  }
}

export function connectDispatcher(name: string, { onConnection, onPeerEvent, onRouteEvent, onAlert }: DispatcherHandlers) {
  const url = new URL('/ws', window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  let socket: WebSocket | undefined;
  let dispatcherId: string | null = null;
  let viewingTruckId: string | null = null;
  let retryDelay = INITIAL_RETRY_MS;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let registrationTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  function announceViewing() {
    if (dispatcherId && socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'viewing_truck', truckId: viewingTruckId }));
    }
  }

  function open() {
    const connection = new WebSocket(url);
    socket = connection;
    registrationTimer = setTimeout(() => connection.close(), REGISTRATION_TIMEOUT_MS);

    connection.onopen = () => {
      connection.send(JSON.stringify({ type: 'register_dispatcher', name }));
    };
    connection.onmessage = ({ data }) => {
      const event = parseEvent(data);
      if (!event) return;
      if (event.type === 'registered') {
        if (dispatcherId) return;
        clearTimeout(registrationTimer);
        dispatcherId = event.dispatcherId;
        retryDelay = INITIAL_RETRY_MS;
        onConnection({ status: 'connected', dispatcherId });
        announceViewing();
        return;
      }
      if (event.type === 'truck_alert') {
        if (dispatcherId) onAlert?.(event.alert);
        return;
      }
      if ('route' in event) {
        if (dispatcherId) onRouteEvent?.(event);
        return;
      }
      if (!dispatcherId || event.dispatcherId === dispatcherId) return;
      onPeerEvent(event);
      if (event.type === 'dispatcher_joined') announceViewing();
    };
    connection.onerror = () => connection.close();
    connection.onclose = () => {
      clearTimeout(registrationTimer);
      dispatcherId = null;
      if (stopped) return;

      onConnection({ status: 'reconnecting', dispatcherId: null });
      retryTimer = setTimeout(open, retryDelay);
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
    };
  }

  open();
  return {
    setViewingTruck(truckId: string | null) {
      if (viewingTruckId === truckId) return;
      viewingTruckId = truckId;
      announceViewing();
    },
    close() {
      stopped = true;
      clearTimeout(retryTimer);
      clearTimeout(registrationTimer);
      if (!socket) return;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
    },
  };
}
