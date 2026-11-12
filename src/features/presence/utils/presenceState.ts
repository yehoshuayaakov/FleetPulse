import type { DispatcherPeerEvent } from '../../../globalSchemas/dispatcherSchemas';

interface DispatcherPeer {
  id: string;
  name?: string;
  truckId: string | null;
}

export type DispatcherPeers = ReadonlyMap<string, DispatcherPeer>;

export function applyPeerEvent(peers: DispatcherPeers, event: DispatcherPeerEvent): DispatcherPeers {
  const { dispatcherId } = event;
  if (event.type === 'dispatcher_left') {
    if (!peers.has(dispatcherId)) return peers;
    const next = new Map(peers);
    next.delete(dispatcherId);
    return next;
  }

  const previous = peers.get(dispatcherId) ?? { id: dispatcherId, truckId: null };
  const peer = event.type === 'dispatcher_joined'
    ? { ...previous, name: event.name }
    : { ...previous, truckId: event.truckId };
  return new Map(peers).set(dispatcherId, peer);
}

function shortId(id: string) {
  return id.replace(/^dispatcher_/, '');
}

export function presentPeers(peers: DispatcherPeers) {
  const nameCounts = new Map<string, number>();
  for (const { name } of peers.values()) {
    if (name) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }

  return Array.from(peers.values(), peer => ({
    id: peer.id,
    truckId: peer.truckId,
    label: !peer.name ? `Dispatcher ${shortId(peer.id)}`
      : nameCounts.get(peer.name) === 1 ? peer.name : `${peer.name} (${shortId(peer.id)})`,
  }));
}

export function groupViewers(peers: readonly ReturnType<typeof presentPeers>[number][]) {
  const viewers = new Map<string, string[]>();
  for (const { truckId, label } of peers) {
    if (truckId === null) continue;
    const existing = viewers.get(truckId);
    if (existing) existing.push(label);
    else viewers.set(truckId, [label]);
  }
  return viewers;
}
