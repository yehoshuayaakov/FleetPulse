import type { TruckAlert } from '../../../sharedSchemas/truckAlertSchema';

const ALERTS_PER_TRUCK = 20;

export type TruckAlerts = ReadonlyMap<string, readonly TruckAlert[]>;

export function mergeTruckAlert(alerts: TruckAlerts, alert: TruckAlert): TruckAlerts {
  const current = alerts.get(alert.truckId) ?? [];
  if (current.some(entry => entry.id === alert.id)) return alerts;

  const newest = [...current, alert]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, ALERTS_PER_TRUCK);
  return new Map(alerts).set(alert.truckId, newest);
}
