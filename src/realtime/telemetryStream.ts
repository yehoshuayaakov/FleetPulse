import { z } from 'zod';
import {
  normalReadingSchema,
  positionFixSchema,
  type TelemetryUpdate,
} from '../globalSchemas/telemetrySchemas';

const envelopeSchema = z.object({
  type: z.enum(['telemetry', 'gps_batch']),
  readings: z.array(z.unknown()),
});

export type TelemetryStatus = 'connecting' | 'connected' | 'reconnecting' | 'unavailable';

export function decodeTelemetry(data: string): TelemetryUpdate | null {
  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    return null;
  }

  const event = envelopeSchema.safeParse(payload);
  if (!event.success) return null;

  const update: TelemetryUpdate = { positions: [], readings: [] };
  for (const reading of event.data.readings) {
    if (event.data.type === 'gps_batch') {
      const fix = positionFixSchema.safeParse(reading);
      if (fix.success) update.positions.push(fix.data);
      continue;
    }

    const normal = normalReadingSchema.safeParse(reading);
    if (!normal.success) continue;
    const { truckId, timestamp, location } = normal.data;
    update.readings.push(normal.data);
    if (location) update.positions.push({ truckId, timestamp, location });
  }
  return update.positions.length || update.readings.length ? update : null;
}

interface TelemetryHandlers {
  onUpdate: (update: TelemetryUpdate) => void;
  onStatus: (status: TelemetryStatus) => void;
}

export function subscribeToTelemetry({ onUpdate, onStatus }: TelemetryHandlers) {
  const source = new EventSource('/api/telemetry/stream');
  source.onopen = () => onStatus('connected');
  source.onerror = () => onStatus(
    source.readyState === EventSource.CLOSED ? 'unavailable' : 'reconnecting',
  );
  source.onmessage = event => {
    const update = decodeTelemetry(event.data);
    if (update) onUpdate(update);
  };

  return () => {
    source.onopen = null;
    source.onerror = null;
    source.onmessage = null;
    source.close();
  };
}
