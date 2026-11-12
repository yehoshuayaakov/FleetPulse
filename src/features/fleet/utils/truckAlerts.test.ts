import { expect, it } from 'vitest';
import type { TruckAlert } from '../../../globalSchemas/truckAlertSchema';
import { mergeTruckAlert, type TruckAlerts } from './truckAlerts';

const alert: TruckAlert = {
  id: 'alert_1', truckId: 'truck_1', message: 'Wait at the gate', severity: 'info',
  sentBy: 'dispatcher_a', timestamp: 1000, acknowledged: false,
};

it('merges the write response and socket broadcast into one alert', () => {
  const alerts = mergeTruckAlert(new Map(), alert);
  expect(mergeTruckAlert(alerts, { ...alert })).toBe(alerts);
  expect(alerts.get('truck_1')).toEqual([alert]);
});

it('keeps alerts ordered and bounded independently for each truck', () => {
  let alerts: TruckAlerts = mergeTruckAlert(new Map(), { ...alert, id: 'other', truckId: 'truck_2' });
  for (let index = 25; index >= 1; index--) {
    alerts = mergeTruckAlert(alerts, { ...alert, id: 'alert_' + index, timestamp: index });
  }
  expect(alerts.get('truck_1')?.map(item => item.timestamp)).toEqual(
    Array.from({ length: 20 }, (_, index) => 25 - index),
  );
  expect(alerts.get('truck_2')).toHaveLength(1);
});
