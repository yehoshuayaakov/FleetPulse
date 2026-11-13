import { expect, test, type Page, type Response } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  const reset = await request.post('/api/reset');
  expect(reset.ok()).toBeTruthy();
});

test('a reassignment released after cancellation leaves the target free', async ({ browser }) => {
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();

  try {
    await join(alice, 'Alice');
    await join(bob, 'Bob');
    await createRoute(alice, 'Truck Alpha', 'Harbor');
    await selectRoute(bob, 'Harbor');
    await selectRoute(alice, 'Harbor');
    await confirmRouteAction(alice, 'Start route');
    await expect(alice.getByRole('row', { name: /Harbor/ })).toContainText('In progress');
    await expect(bob.getByRole('row', { name: /Harbor/ })).toContainText('In progress');

    const reassignment = holdReassignment(bob);
    const reassignDialog = await openRouteAction(bob, 'Reassign route');
    await reassignDialog.getByRole('button', { name: /Target truck/ }).click();
    await bob.getByRole('option', { name: /Truck Delta/ }).click();
    await reassignDialog.getByRole('button', { name: 'Reassign route' }).click();
    await reassignment.started;

    await confirmRouteAction(alice, 'Cancel route');
    await expect(alice.getByRole('row', { name: /Harbor/ })).toContainText('Cancelled');
    reassignment.release();
    const putStatus = await reassignment.finished;

    expect.soft(putStatus, 'a reassignment that arrives after cancellation should be rejected').not.toBe(200);
    expect.soft([400, 409], 'the rejected reassignment should report a conflict').toContain(putStatus);
    expect(await submitRoute(alice, 'Truck Delta', 'Pier'), 'the target truck should accept a new route').toBe(201);
  } finally {
    await aliceContext.close();
    await bobContext.close();
  }
});

test('a stale start is rejected after the other dispatcher reassigns', async ({ browser }) => {
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();

  try {
    await join(alice, 'Alice');
    await join(bob, 'Bob');
    await createRoute(alice, 'Truck Alpha', 'Harbor');
    await selectRoute(bob, 'Harbor');
    await selectRoute(alice, 'Harbor');
    const startDialog = await openRouteAction(alice, 'Start route');

    await reassign(bob, 'Truck Delta');
    await expect(bob.getByRole('row', { name: /Harbor/ })).toContainText('Truck Delta');

    const started = alice.waitForResponse(isRouteWrite('PATCH'));
    await startDialog.getByRole('button', { name: 'Start route' }).click();
    expect(await started.then(response => response.status())).toBe(409);
    await expect(startDialog.getByRole('button', { name: 'Review latest route' })).toBeVisible();
    await expect(alice.getByRole('row', { name: /Harbor/ })).toContainText('Assigned');
    await expect(alice.getByRole('row', { name: /Harbor/ })).toContainText('Truck Delta');
  } finally {
    await aliceContext.close();
    await bobContext.close();
  }
});

test('the later reassignment of an active route is rejected', async ({ browser }) => {
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();

  try {
    await join(alice, 'Alice');
    await join(bob, 'Bob');
    await createRoute(alice, 'Truck Alpha', 'Harbor');
    await selectRoute(bob, 'Harbor');
    await selectRoute(alice, 'Harbor');

    const aliceReassignment = holdReassignment(alice);
    const bobReassignment = holdReassignment(bob);
    await chooseReassignment(alice, 'Truck Delta');
    await chooseReassignment(bob, 'Truck Echo');
    await aliceReassignment.started;
    await bobReassignment.started;

    aliceReassignment.release();
    expect(await aliceReassignment.finished).toBe(200);
    bobReassignment.release();
    expect(await bobReassignment.finished).toBe(409);

    await expect(alice.getByRole('row', { name: /Harbor/ })).toContainText('Truck Delta');
    await expect(bob.getByRole('row', { name: /Harbor/ })).toContainText('Truck Delta');
    expect(await submitRoute(alice, 'Truck Echo', 'Pier'), 'the losing target should stay available').toBe(201);
  } finally {
    await aliceContext.close();
    await bobContext.close();
  }
});

async function join(page: Page, name: string) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Display name' }).fill(name);
  await page.getByRole('button', { name: 'Join as dispatcher' }).click();
  await expect(page.getByRole('list', { name: 'Dispatcher sessions' })).toContainText(name);
}

async function openRoutes(page: Page) {
  await page.getByRole('link', { name: 'Routes' }).click();
  await expect(page.getByRole('button', { name: 'New route' })).toBeEnabled();
}

async function selectRoute(page: Page, destination: string) {
  await openRoutes(page);
  const row = page.getByRole('row', { name: new RegExp(destination) });
  await expect(row).toBeVisible();
  if ((await row.getAttribute('aria-selected')) !== 'true') {
    await row.getByRole('rowheader', { name: destination }).click();
  }
  await expect(row).toHaveAttribute('aria-selected', 'true');
}

async function openRouteAction(page: Page, name: string) {
  await page.getByRole('group', { name: 'Route actions' }).getByRole('button', { name }).click();
  const dialog = page.getByRole('dialog', { name });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function reassign(page: Page, truck: string) {
  await chooseReassignment(page, truck);
  await expect(page.getByRole('dialog', { name: 'Reassign route' })).toBeHidden();
}

async function chooseReassignment(page: Page, truck: string) {
  const dialog = await openRouteAction(page, 'Reassign route');
  await dialog.getByRole('button', { name: /Target truck/ }).click();
  await page.getByRole('option', { name: new RegExp(truck) }).click();
  await dialog.getByRole('button', { name: 'Reassign route' }).click();
}

async function confirmRouteAction(page: Page, name: string) {
  const dialog = await openRouteAction(page, name);
  const saved = page.waitForResponse(isRouteWrite('PATCH'));
  await dialog.getByRole('button', { name }).click();
  expect((await saved).status(), `${name} should be accepted`).toBe(200);
}

async function createRoute(page: Page, truck: string, destination: string) {
  expect(await submitRoute(page, truck, destination), `${destination} should be created`).toBe(201);
  await expect(page.getByRole('dialog', { name: 'Assign route' })).toBeHidden();
  await expect(page.getByRole('row', { name: new RegExp(destination) })).toBeVisible();
}

async function submitRoute(page: Page, truck: string, destination: string) {
  await openRoutes(page);
  await page.getByRole('button', { name: 'New route' }).click();
  const dialog = page.getByRole('dialog', { name: 'Assign route' });
  await dialog.getByRole('button', { name: /Truck/ }).click();
  await page.getByRole('option', { name: new RegExp(truck, 'i') }).click();
  await dialog.getByRole('textbox', { name: 'Destination' }).fill(destination);
  const created = page.waitForResponse(isRouteWrite('POST'));
  await dialog.getByRole('button', { name: 'Assign route' }).click();
  return (await created).status();
}

function holdReassignment(page: Page) {
  let release = () => {};
  let started = () => {};
  let finish = (_status: number) => {};
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const startedPromise = new Promise<void>(resolve => {
    started = resolve;
  });
  const finished = new Promise<number>(resolve => {
    finish = resolve;
  });

  void page.route(/\/api\/routes\/[^/]+\/reassign$/, async route => {
    if (route.request().method() !== 'PUT') {
      await route.fallback();
      return;
    }
    started();
    await gate;
    const response = await route.fetch();
    finish(response.status());
    await route.fulfill({ response });
  });

  return { started: startedPromise, finished, release };
}

function isRouteWrite(method: 'POST' | 'PATCH') {
  return (response: Response) => {
    const url = new URL(response.url());
    const collection = method === 'POST' ? url.pathname === '/api/routes' : /^\/api\/routes\/[^/]+$/.test(url.pathname);
    return response.request().method() === method && collection;
  };
}
