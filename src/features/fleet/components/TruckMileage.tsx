import { useEffect, useState } from 'react';
import { Button } from 'react-aria-components';
import { loadTruckMileage } from '../../../api/fleet/queries';

type MileageState =
  | { status: 'loading' | 'error' }
  | { status: 'ready'; mileage: number };

export function TruckMileage({ truckId }: { truckId: string }) {
  const [state, setState] = useState<MileageState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    loadTruckMileage(truckId, controller.signal).then(
      mileage => {
        if (!controller.signal.aborted) setState({ status: 'ready', mileage });
      },
      () => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      },
    );
    return () => controller.abort();
  }, [truckId, attempt]);

  return (
    <div>
      <dt className="text-xs">Mileage</dt>
      <dd className="tabular-nums text-ink">
        {state.status === 'loading' && <span role="status">Loading mileage…</span>}
        {state.status === 'ready' && `${state.mileage.toLocaleString()} km`}
        {state.status === 'error' && (
          <>
            <span role="alert" className="text-danger">Could not load mileage.</span>
            <Button
              onPress={() => {
                setState({ status: 'loading' });
                setAttempt(previous => previous + 1);
              }}
              className="ml-2 cursor-pointer rounded-sm font-medium text-accent underline outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Retry mileage
            </Button>
          </>
        )}
      </dd>
    </div>
  );
}
