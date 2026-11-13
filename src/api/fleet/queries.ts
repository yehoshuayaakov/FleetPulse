import { fleetSnapshotSchema, type FleetSnapshot } from '../../sharedSchemas/fleetSchema';
import { HttpError, requestJson } from '../http';
import { truckMileageSchema } from './schemas';

const MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY = 1000;
const MAX_TIMER_DELAY = 2_147_483_647;

function retryDelay(header: string | null): number {
  if (!header) return DEFAULT_RETRY_DELAY;

  let delay: number;
  if (/^\d+$/.test(header)) {
    delay = Number(header) * 1000;
  } else if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i.test(header)) {
    delay = Math.max(0, Date.parse(header) - Date.now());
  } else {
    return DEFAULT_RETRY_DELAY;
  }

  return Number.isFinite(delay) && delay <= MAX_TIMER_DELAY
    ? delay
    : DEFAULT_RETRY_DELAY;
}

function waitForRetry(delay: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', cancel);
      resolve();
    }, delay);

    function cancel() {
      clearTimeout(timer);
      reject(signal.reason);
    }

    signal.addEventListener('abort', cancel, { once: true });
  });
}

export async function loadFleet(signal: AbortSignal): Promise<FleetSnapshot> {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    try {
      const data = await requestJson('/api/fleet', { signal });
      return fleetSnapshotSchema.parse(data);
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 503 || attempt >= MAX_RETRIES) {
        throw error;
      }
      await waitForRetry(retryDelay(error.headers.get('Retry-After')), signal);
    }
  }
}

export async function loadTruckMileage(truckId: string, signal: AbortSignal): Promise<number> {
  signal.throwIfAborted();
  const response = await requestJson(`/api/fleet/${encodeURIComponent(truckId)}`, { signal });
  const detail = truckMileageSchema.parse(response);
  if (detail.id !== truckId) throw new Error('Truck detail does not match the requested truck');
  return detail.mileage;
}
