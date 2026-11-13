import { describe, expect, it } from 'vitest';
import { applyPeerEvent, groupViewers, presentPeers, type DispatcherPeers } from './presenceState';

const empty: DispatcherPeers = new Map();

function join(peers: DispatcherPeers, dispatcherId: string, name: string) {
  return applyPeerEvent(peers, { type: 'dispatcher_joined', dispatcherId, name });
}

function view(peers: DispatcherPeers, dispatcherId: string, truckId: string | null) {
  return applyPeerEvent(peers, { type: 'dispatcher_viewing', dispatcherId, truckId });
}

describe('dispatcher peers', () => {
  it('groups multiple viewers and moves or clears each independently', () => {
    const alice = join(empty, 'dispatcher_a', 'Alice');
    const both = join(alice, 'dispatcher_b', 'Bob');
    const viewers = view(view(both, 'dispatcher_a', 'truck_1'), 'dispatcher_b', 'truck_1');
    expect(groupViewers(presentPeers(viewers)).get('truck_1')).toEqual(['Alice', 'Bob']);

    const moved = view(viewers, 'dispatcher_b', 'truck_2');
    expect(groupViewers(presentPeers(moved))).toEqual(new Map([
      ['truck_1', ['Alice']], ['truck_2', ['Bob']],
    ]));

    const cleared = view(moved, 'dispatcher_b', null);
    expect(groupViewers(presentPeers(cleared))).toEqual(new Map([['truck_1', ['Alice']]]));
    expect(presentPeers(cleared)).toHaveLength(2);
  });

  it('discovers a viewing peer by ID and applies a later name without clearing the view', () => {
    const seen = view(empty, 'dispatcher_abc123', 'truck_1');
    expect(presentPeers(seen)).toEqual([{ id: 'dispatcher_abc123', truckId: 'truck_1', label: 'Dispatcher abc123' }]);
    const known = join(seen, 'dispatcher_abc123', 'Alice');
    expect(presentPeers(known)).toEqual([{ id: 'dispatcher_abc123', truckId: 'truck_1', label: 'Alice' }]);
  });

  it('removes only the old session on a delayed or duplicate leave', () => {
    const old = view(join(empty, 'dispatcher_old', 'Alice'), 'dispatcher_old', 'truck_1');
    const both = view(join(old, 'dispatcher_new', 'Alice'), 'dispatcher_new', 'truck_1');
    expect(groupViewers(presentPeers(both)).get('truck_1')).toEqual(['Alice (old)', 'Alice (new)']);

    const leave = { type: 'dispatcher_left', dispatcherId: 'dispatcher_old' } as const;
    const peers = applyPeerEvent(both, leave);
    expect(presentPeers(peers)).toEqual([{ id: 'dispatcher_new', truckId: 'truck_1', label: 'Alice' }]);
    expect(applyPeerEvent(peers, leave)).toBe(peers);
  });
});
