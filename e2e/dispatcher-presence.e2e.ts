import { expect, test, type Page } from '@playwright/test';
import type { FleetSnapshot } from '../src/sharedSchemas/fleetSchema';

const fleet: FleetSnapshot = {
  timestamp: Date.now(),
  fleet: [{
    id: 'truck_1', name: 'Truck Alpha', status: 'active',
    location: { lat: 32.08, lng: 34.78 }, speed: 48, fuel: 60, engineTemp: 80,
    heading: 30, currentRouteId: null, _version: 1,
  }],
};

async function join(page: Page, name: string) {
  await page.route('**/api/fleet', route => route.fulfill({ json: fleet }));
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Display name' }).fill(name);
  await page.getByRole('button', { name: 'Join as dispatcher' }).click();
  const dispatchers = page.getByRole('list', { name: 'Dispatcher sessions' });
  await expect(dispatchers.getByText(name, { exact: true })).toBeVisible();
  return dispatchers;
}

test('a late joiner sees the earlier dispatcher by name and tracks their visible truck', async ({ page: alice, browser }) => {
  const bobContext = await browser.newContext();
  try {
    const bob = await bobContext.newPage();
    const aliceDispatchers = await join(alice, 'Alice');
    const bobDispatchers = await join(bob, 'Bob');

    await expect(bobDispatchers.getByText('Alice', { exact: true })).toBeVisible();
    await expect(aliceDispatchers.getByText('Bob', { exact: true })).toBeVisible();
    await expect(bobDispatchers.getByRole('listitem')).toHaveCount(2);

    const aliceTag = bobDispatchers.getByRole('listitem').filter({ hasText: 'Alice' });
    const viewing = aliceTag.getByText('Viewing Truck Alpha', { exact: true });
    const bobTruck = bob.getByRole('region', { name: 'Truck list' });
    await expect(viewing).toHaveCount(0);

    const setVisibility = (visibility: DocumentVisibilityState) => alice.evaluate(state => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
      document.dispatchEvent(new Event('visibilitychange'));
    }, visibility);
    await setVisibility('visible');
    await alice.getByRole('button', { name: /^Select Truck Alpha on grid/ }).press('Enter');
    await expect(viewing).toBeVisible();
    await expect(bobTruck.getByText('Viewed by Alice', { exact: true })).toBeVisible();
    await expect(bob.getByRole('button', { name: /Select Truck Alpha on grid.*viewed by 1 dispatcher/ })).toBeVisible();

    await setVisibility('hidden');
    await expect(viewing).toHaveCount(0);
    await expect(bobTruck.getByText('Viewed by Alice', { exact: true })).toHaveCount(0);
    await expect(aliceTag.getByText('Alice', { exact: true })).toBeVisible();

    await setVisibility('visible');
    await expect(viewing).toBeVisible();
    await alice.getByRole('button', { name: /Truck Alpha Hide details/ }).click();
    await expect(viewing).toHaveCount(0);
  } finally {
    await bobContext.close();
  }
});
