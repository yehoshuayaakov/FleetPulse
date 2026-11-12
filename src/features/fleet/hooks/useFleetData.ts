import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { loadFleet } from '../../../api/fleet/queries';
import type { FleetSnapshot } from '../../../api/fleet/schemas';
import { useFleetTelemetry } from './useFleetTelemetry';

type LoadState = {
  status: 'loading' | 'ready' | 'error';
  snapshot: FleetSnapshot | null;
};

export function useFleetData(setSelectedId: Dispatch<SetStateAction<string | null>>) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading', snapshot: null });
  const [attempt, setAttempt] = useState(0);
  const { status: telemetryStatus, trucks, acceptSnapshot, reconnect } = useFleetTelemetry(load.snapshot);

  useEffect(() => {
    const controller = new AbortController();
    loadFleet(controller.signal).then(
      snapshot => {
        if (controller.signal.aborted) return;
        acceptSnapshot(snapshot);
        setLoad({ status: 'ready', snapshot });
        setSelectedId(id => snapshot.fleet.some(truck => truck.id === id) ? id : null);
      },
      () => {
        if (controller.signal.aborted) return;
        setLoad(previous => ({ ...previous, status: 'error' }));
      },
    );
    return () => controller.abort();
  }, [acceptSnapshot, attempt, setSelectedId]);

  function refresh() {
    setLoad(previous => ({ ...previous, status: 'loading' }));
    setAttempt(previous => previous + 1);
  }

  return { ...load, telemetryStatus, trucks, reconnect, refresh };
}
