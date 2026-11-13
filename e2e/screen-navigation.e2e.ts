import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 560 } });

test('returning to Fleet starts at the top and keeps the selected truck visible', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Display name' }).fill('Navigation dispatcher');
  await page.getByRole('button', { name: 'Join as dispatcher' }).click();
  const dispatchers = page.getByRole('list', { name: 'Dispatcher sessions' });
  await expect(dispatchers).toContainText('Navigation dispatcher');
  const fleetHeading = page.getByRole('heading', { name: 'Fleet overview' });
  const routesHeading = page.getByRole('heading', { name: 'Routes', exact: true });
  const fleetLink = page.getByRole('link', { name: 'Fleet', exact: true });
  const routesLink = page.getByRole('link', { name: 'Routes', exact: true });
  const truckList = page.getByRole('region', { name: 'Truck list' }).getByRole('list').first();
  const selectedTruck = truckList.getByRole('button', { name: /Truck Lima Hide details/ });
  const scrollY = () => page.evaluate(() => window.scrollY);
  const listScroll = () => truckList.evaluate(list => list.scrollTop);

  await page.getByRole('button', { name: /^Select Truck Lima on grid/ }).press('Enter');
  await expect(selectedTruck).toBeVisible();
  await expect.poll(listScroll).toBeGreaterThan(0);

  await routesLink.click();
  await expect(routesHeading).toBeVisible();
  await expect(dispatchers).toContainText('Navigation dispatcher');
  await expect(dispatchers).not.toContainText('Viewing Truck Lima');
  await fleetLink.click();
  await expect(fleetHeading).toBeInViewport();
  await expect(selectedTruck).toBeInViewport();
  await expect(dispatchers).toContainText('Viewing Truck Lima');
  await expect.poll(listScroll).toBeGreaterThan(0);
  await expect.poll(scrollY).toBe(0);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(scrollY).toBeGreaterThan(0);
  await routesLink.evaluate((link: HTMLAnchorElement) => link.click());
  await expect(routesHeading).toBeVisible();
  await expect(dispatchers).toContainText('Navigation dispatcher');
  await expect(dispatchers).not.toContainText('Viewing Truck Lima');
  await page.goBack();
  await expect(fleetHeading).toBeInViewport();
  await expect(selectedTruck).toBeInViewport();
  await expect(dispatchers).toContainText('Viewing Truck Lima');
  await expect.poll(listScroll).toBeGreaterThan(0);
  await expect.poll(scrollY).toBe(0);
});
