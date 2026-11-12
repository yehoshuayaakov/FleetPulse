import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectDispatcher } from './dispatcherSocket';

class FakeSocket {
  static readonly OPEN = 1;
  static sockets: FakeSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => this.disconnect());

  constructor(readonly url: URL) {
    FakeSocket.sockets.push(this);
  }

  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }

  receive(event: unknown) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }

  disconnect() {
    this.readyState = 3;
    this.onclose?.();
  }

  sent() {
    return this.send.mock.calls.map(([data]) => JSON.parse(data));
  }
}

describe('dispatcher socket', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.sockets = [];
    vi.stubGlobal('window', { location: { href: 'https://fleet.example/fleet' } });
    vi.stubGlobal('WebSocket', FakeSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('registers by name and sends the current view only after acknowledgement', () => {
    const onConnection = vi.fn();
    const onPeerEvent = vi.fn();
    const client = connectDispatcher('Alice', { onConnection, onPeerEvent });
    const socket = FakeSocket.sockets[0];
    expect(socket.url.href).toBe('wss://fleet.example/ws');

    client.setViewingTruck('truck_1');
    socket.open();
    expect(socket.sent()).toEqual([{ type: 'register_dispatcher', name: 'Alice' }]);
    socket.receive({ type: 'registered', dispatcherId: 'dispatcher_a' });
    expect(onConnection).toHaveBeenCalledWith({ status: 'connected', dispatcherId: 'dispatcher_a' });
    expect(socket.sent().at(-1)).toEqual({ type: 'viewing_truck', truckId: 'truck_1' });

    client.setViewingTruck('truck_1');
    expect(socket.sent()).toHaveLength(2);
    client.setViewingTruck(null);
    expect(socket.sent().at(-1)).toEqual({ type: 'viewing_truck', truckId: null });

    const join = { type: 'dispatcher_joined', dispatcherId: 'dispatcher_b', name: 'Bob' };
    socket.receive(join);
    expect(socket.sent()).toHaveLength(4);
    expect(socket.sent().at(-1)).toEqual({ type: 'viewing_truck', truckId: null });
    expect(onPeerEvent).toHaveBeenCalledExactlyOnceWith(join);
    socket.onmessage?.({ data: '{invalid' });
    socket.receive({ type: 'dispatcher_viewing', dispatcherId: 'dispatcher_b' });
    expect(onPeerEvent).toHaveBeenCalledTimes(1);
    client.close();
  });

  it('reregisters after reconnect and reannounces the latest selection under a new ID', () => {
    const onConnection = vi.fn();
    const client = connectDispatcher('Alice', { onConnection, onPeerEvent: vi.fn() });
    const first = FakeSocket.sockets[0];
    first.open();
    first.receive({ type: 'registered', dispatcherId: 'dispatcher_old' });
    first.disconnect();

    expect(onConnection).toHaveBeenLastCalledWith({ status: 'reconnecting', dispatcherId: null });
    client.setViewingTruck('truck_2');
    vi.advanceTimersByTime(999);
    expect(FakeSocket.sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);

    const second = FakeSocket.sockets[1];
    second.open();
    second.receive({ type: 'registered', dispatcherId: 'dispatcher_new' });
    expect(second.sent()).toEqual([
      { type: 'register_dispatcher', name: 'Alice' },
      { type: 'viewing_truck', truckId: 'truck_2' },
    ]);
    expect(onConnection).toHaveBeenLastCalledWith({ status: 'connected', dispatcherId: 'dispatcher_new' });
    client.close();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('backs off from one second to at most thirty and cancels pending retries on cleanup', () => {
    const client = connectDispatcher('Alice', { onConnection: vi.fn(), onPeerEvent: vi.fn() });
    for (const [index, delay] of [1000, 2000, 4000, 8000, 16000, 30000, 30000].entries()) {
      FakeSocket.sockets[index].disconnect();
      vi.advanceTimersByTime(delay - 1);
      expect(FakeSocket.sockets).toHaveLength(index + 1);
      vi.advanceTimersByTime(1);
      expect(FakeSocket.sockets).toHaveLength(index + 2);
    }

    FakeSocket.sockets.at(-1)!.disconnect();
    client.close();
    vi.advanceTimersByTime(30_000);
    expect(FakeSocket.sockets).toHaveLength(8);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('forwards versioned route events only after registration and ignores malformed updates', () => {
    const onRouteEvent = vi.fn();
    const client = connectDispatcher('Alice', { onConnection: vi.fn(), onPeerEvent: vi.fn(), onRouteEvent });
    const socket = FakeSocket.sockets[0];
    const route = {
      id: 'route_1', truckId: 'truck_1', destination: 'Stop A', status: 'in-progress', priority: 'normal',
      notes: '', assignedBy: 'dispatcher_b', assignedAt: 1000, _version: 2,
    };
    const update = { type: 'route_updated', route, updatedBy: 'dispatcher_b', timestamp: 2000 };
    socket.open();
    socket.receive(update);
    socket.receive({ type: 'registered', dispatcherId: 'dispatcher_a' });
    socket.receive({ ...update, route: { ...route, _version: '2' } });
    socket.receive(update);

    expect(onRouteEvent).toHaveBeenCalledExactlyOnceWith(update);
    client.close();
  });

  it('routes only valid alert events after registration', () => {
    const onAlert = vi.fn();
    const onPeerEvent = vi.fn();
    const client = connectDispatcher('Alice', { onConnection: vi.fn(), onPeerEvent, onAlert });
    const socket = FakeSocket.sockets[0];
    const alert = { id: 'alert_1', truckId: 'truck_1', message: 'Hold', severity: 'info', timestamp: 1000, acknowledged: false };
    socket.open();
    socket.receive({ type: 'truck_alert', alert });
    socket.receive({ type: 'registered', dispatcherId: 'dispatcher_a' });
    socket.receive({ type: 'truck_alert', alert: { ...alert, truckId: null } });
    socket.receive({ type: 'truck_alert', alert });

    expect(onAlert).toHaveBeenCalledExactlyOnceWith(alert);
    expect(onPeerEvent).not.toHaveBeenCalled();
    client.close();
  });

  it('closes a socket that never acknowledges registration', () => {
    const onConnection = vi.fn();
    const client = connectDispatcher('Alice', { onConnection, onPeerEvent: vi.fn() });
    const first = FakeSocket.sockets[0];
    first.open();

    vi.advanceTimersByTime(9999);
    expect(first.close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(first.close).toHaveBeenCalledOnce();
    expect(onConnection).toHaveBeenLastCalledWith({ status: 'reconnecting', dispatcherId: null });
    client.close();
  });
});
