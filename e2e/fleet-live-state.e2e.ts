import { expect, test } from '@playwright/test';
import type { FleetSnapshot } from '../src/sharedSchemas/fleetSchema';

interface TestReading {
  truckId: string;
  status: 'active' | 'maintenance';
  speed: number;
  fuel: number;
  engineTemp: number;
}

declare global {
  interface Window {
    fleetTelemetryTest: {
      emit: (reading: TestReading) => void;
      connections: () => { active: number; created: number };
    };
  }
}

test('Fleet filters and route eligibility follow the same live truck status across navigation', async ({ page, request }) => {
  expect((await request.post('/api/reset')).ok()).toBe(true);
  const snapshot: FleetSnapshot = {
    timestamp: Date.now(),
    fleet: [{
      id: 'truck_1', name: 'Truck Alpha', status: 'active',
      location: { lat: 32.08, lng: 34.78 }, speed: 48, fuel: 60, engineTemp: 80,
      heading: 30, currentRouteId: null, _version: 1,
    }],
  };
  await page.route('**/api/fleet', route => route.fulfill({ json: snapshot }));
  await page.addInitScript(() => {
    const active = new Set<TestEventSource>();
    let created = 0;

    class TestEventSource {
      onopen: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;

      constructor() {
        created += 1;
        active.add(this);
        queueMicrotask(() => {
          if (active.has(this)) this.onopen?.();
        });
      }

      close() {
        active.delete(this);
      }
    }

    Object.defineProperty(window, 'EventSource', { value: TestEventSource });
    window.fleetTelemetryTest = {
      connections: () => ({ active: active.size, created }),
      emit: reading => {
        const data = JSON.stringify({
          type: 'telemetry',
          readings: [{ ...reading, timestamp: Date.now() }],
        });
        for (const source of active) source.onmessage?.({ data });
      },
    };
  });

  await page.goto('/');
  await expect(page.getByText('Telemetry connected', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Display name' }).fill('Fleet dispatcher');
  await page.getByRole('button', { name: 'Join as dispatcher' }).click();
  await expect(page.getByRole('list', { name: 'Dispatcher sessions' })).toContainText('Fleet dispatcher');

  const connections = () => page.evaluate(() => window.fleetTelemetryTest.connections());
  const initialConnections = await connections();
  expect(initialConnections.active).toBe(1);

  const marker = page.getByRole('button', { name: /^Select Truck Alpha on grid/ });
  const card = page.getByRole('region', { name: 'Truck list' }).getByRole('heading', { name: /Truck Alpha/ });
  await expect(marker).toBeVisible();
  await expect(card).toBeVisible();

  await page.getByRole('link', { name: 'Routes', exact: true }).click();
  await page.getByRole('button', { name: 'New route' }).click();
  const dialog = page.getByRole('dialog', { name: 'Assign route' });
  await dialog.getByRole('button', { name: /Truck/ }).click();
  await expect(page.getByRole('option', { name: /Truck Alpha/ })).toBeEnabled();

  const emitStatus = (status: TestReading['status']) => page.evaluate(status => {
    window.fleetTelemetryTest.emit({ truckId: 'truck_1', status, speed: 0, fuel: 60, engineTemp: 80 });
  }, status);
  await emitStatus('maintenance');
  await expect(page.getByRole('option', { name: /Truck Alpha/ })).toBeDisabled();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toBeHidden();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('link', { name: 'Fleet', exact: true }).click();
  await page.getByRole('toolbar', { name: 'Status', exact: true }).getByRole('button', { name: 'Maintenance' }).click();
  await expect(marker).toBeVisible();
  await expect(card).toBeVisible();

  await emitStatus('active');
  await expect(marker).toHaveCount(0);
  await expect(card).toHaveCount(0);
  await expect(page.getByText('No trucks match these filters.')).toBeVisible();
  expect(await connections()).toEqual(initialConnections);
});
