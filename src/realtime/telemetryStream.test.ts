import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeTelemetry, subscribeToTelemetry } from './telemetryStream';

const validFix = { truckId: 'truck_1', timestamp: 40.25, location: { lat: 32.08, lng: 34.78 } };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('decodeTelemetry', () => {
  it('keeps valid normal fields when coordinates or speed are malformed', () => {
    const received = decodeTelemetry(JSON.stringify({
      type: 'telemetry',
      readings: [
        { ...validFix, speed: 999 },
        { ...validFix, truckId: 'truck_2', location: { lat: 100, lng: 34.78 }, speed: 'bad', fuel: 20 },
        { ...validFix, truckId: 'truck_3', timestamp: null },
        { truckId: 'truck_4', timestamp: 40, speed: 'bad' },
      ],
    }));

    expect(received?.positions).toEqual([validFix]);
    expect(received?.readings).toHaveLength(2);
    expect(received?.readings[0].speed).toBe(999);
    expect(received?.readings[1]).toMatchObject({ truckId: 'truck_2', fuel: 20 });
    expect(received?.readings[1].speed).toBeUndefined();
    expect(received?.readings[1].location).toBeUndefined();
  });

  it('decodes a GPS batch as positions without forwarding its sensors', () => {
    const received = decodeTelemetry(JSON.stringify({
      type: 'gps_batch',
      readings: [
        { ...validFix, speed: 999 },
        { ...validFix, truckId: 'truck_2', location: { lat: 100, lng: 34.78 } },
        { ...validFix, truckId: 'truck_3', timestamp: null },
      ],
    }));

    expect(received).toEqual({ positions: [validFix], readings: [] });
  });

  it.each(['{invalid', '{"type":"connected"}', '{"type":"heartbeat"}', '{"type":"telemetry"}'])(
    'ignores a non-reading payload: %s',
    payload => expect(decodeTelemetry(payload)).toBeNull(),
  );
});

it('reports EventSource lifecycle and cleans up without starting another stream on error', () => {
  const source = {
    readyState: 0,
    onopen: null as (() => void) | null,
    onerror: null as (() => void) | null,
    onmessage: null as ((event: { data: string }) => void) | null,
    close: vi.fn(),
  };
  const eventSource = Object.assign(vi.fn(function () { return source; }), { CLOSED: 2 });
  vi.stubGlobal('EventSource', eventSource);
  const onUpdate = vi.fn();
  const onStatus = vi.fn();
  const unsubscribe = subscribeToTelemetry({ onUpdate, onStatus });

  expect(eventSource).toHaveBeenCalledExactlyOnceWith('/api/telemetry/stream');
  source.onopen?.();
  source.onmessage?.({ data: JSON.stringify({ type: 'telemetry', readings: [validFix] }) });
  source.onmessage?.({ data: '{"type":"heartbeat"}' });
  source.onerror?.();
  source.onopen?.();
  source.readyState = 2;
  source.onerror?.();

  expect(onStatus.mock.calls.flat()).toEqual(['connected', 'reconnecting', 'connected', 'unavailable']);
  expect(onUpdate).toHaveBeenCalledExactlyOnceWith({ positions: [validFix], readings: [validFix] });
  expect(eventSource).toHaveBeenCalledTimes(1);
  unsubscribe();
  expect(source.close).toHaveBeenCalledOnce();
  expect(source.onopen).toBeNull();
  expect(source.onerror).toBeNull();
  expect(source.onmessage).toBeNull();
});
