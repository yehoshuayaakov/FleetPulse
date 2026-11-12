import { requestJson } from '../http';
import { routesSnapshotSchema } from './schemas';

export async function loadRoutes(signal: AbortSignal) {
  const response = await requestJson('/api/routes', { signal });
  return routesSnapshotSchema.parse(response).routes;
}
