import { afterEach, expect, it, vi } from 'vitest';
import { sendTruckAlert } from './mutations';

const alert = {
  id: 'alert_1', truckId: 'truck_1', message: 'Wait at the gate', severity: 'warning',
  sentBy: 'dispatcher_a', timestamp: 1000, acknowledged: false,
};
const input = { message: alert.message, severity: alert.severity };

afterEach(() => vi.unstubAllGlobals());

it('posts to the selected truck with the dispatcher header and validates the result', async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(alert, { status: 201 }));
  vi.stubGlobal('fetch', fetchMock);
  await expect(sendTruckAlert('truck_1', input, 'dispatcher_a')).resolves.toEqual(alert);
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/fleet/truck_1/alert', expect.objectContaining({
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Dispatcher-Id': 'dispatcher_a' },
    body: JSON.stringify(input),
  }));
});

it('rejects a response for a different truck without replaying the write', async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ...alert, truckId: 'truck_2' }));
  vi.stubGlobal('fetch', fetchMock);
  await expect(sendTruckAlert('truck_1', input, 'dispatcher_a')).rejects.toThrow('Alert response does not match');
  expect(fetchMock).toHaveBeenCalledOnce();
});

it('does not replay a failed write', async () => {
  const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Network error'));
  vi.stubGlobal('fetch', fetchMock);
  await expect(sendTruckAlert('truck_1', input, 'dispatcher_a')).rejects.toThrow('Network error');
  expect(fetchMock).toHaveBeenCalledOnce();
});
