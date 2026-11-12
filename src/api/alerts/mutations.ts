import { truckAlertSchema } from '../../globalSchemas/truckAlertSchema';
import { requestJson } from '../http';

export async function sendTruckAlert(
  truckId: string,
  input: { message: string; severity: string },
  dispatcherId: string,
) {
  const response = await requestJson(`/api/fleet/${encodeURIComponent(truckId)}/alert`, {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
    headers: { 'Content-Type': 'application/json', 'X-Dispatcher-Id': dispatcherId },
    body: JSON.stringify(input),
  });
  const alert = truckAlertSchema.parse(response);
  if (alert.truckId !== truckId) throw new Error('Alert response does not match the requested truck');
  return alert;
}
