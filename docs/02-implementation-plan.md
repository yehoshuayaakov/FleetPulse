# FleetPulse implementation plan

Read the [specification](01-spec.md), [decision and change log](03-decisions-and-changes.md), and [test map](04-test-map.md) alongside this plan. Work proceeds by acceptance criteria, with tests landing alongside the behavior they cover.

## Architecture

Use React, TypeScript, Vite, and Vitest. The Vite dev server proxies `/api` and `/ws` to the CommonJS mock on port 3000. A single `npm start` runs both processes. Keep the mock separate from client code and leave its behavior as printed in the assignment.

| Boundary | Owns |
| --- | --- |
| REST client | Snapshot and detail reads, retries, route writes, and alert writes. Supply the registered dispatcher ID on writes. |
| SSE client | EventSource connection and validation of telemetry and GPS batch messages. |
| Fleet store | Dashboard-level SSE and snapshot lifecycle, freshness timer, live fleet view, and truck catalog for Routes. |
| WebSocket client | Registration, connection lifecycle, presence, route events, and alert events. Reconcile routes after reconnect. |
| Domain logic | Normalize trucks and routes by ID. Keep telemetry, routes, presence, and alerts in testable TypeScript. Merge server updates before handing state to React views. |
| React views | Fleet grid and truck cards, Routes list and detail, one shared assignment form, connection and conflict feedback. Keep selected IDs and form drafts in UI state. |

## UI and theme

- Use React Aria Components (RAC) for navigation, buttons, tooltips, form controls, dialogs, tables, and gauges. Use semantic HTML for layout and static content. Use RAC Button and Tooltip for truck markers and RAC Meter for speed, fuel, and engine temperature.
- Use Tailwind classes with the shared tokens in `src/styles/theme.css`. Use neutral surfaces, a blue accent for selection and primary actions, and consistent status colors. Keep marker coordinates in CSS custom properties so the marker classes stay static.
- Keep operational status, signal freshness, and sensor health independent. A truck can show **Active**, **Signal stale**, and **Speed sensor fault** together. Each state has a visible text label.

## File structure

Organize Fleet and Routes by screen. Keep each screen's components, hooks, schemas, and utilities together. Shared UI and dispatcher presence belong under `components/`. Keep utility tests beside their implementation and add another folder level only when a group becomes hard to navigate.

```text
src/
  main.tsx
  app/
    App.tsx
    DashboardErrorBoundary.tsx
  sharedSchemas/
    locationSchema.ts
    telemetrySchemas.ts
    truckStatusSchema.ts
    fleetSchema.ts
    dispatcherSchemas.ts
    routeSchema.ts
    truckAlertSchema.ts
  api/
    http.ts
    http.test.ts
    fleet/
      queries.ts
      schemas.ts
      queries.test.ts
    routes/
      queries.ts
      queries.test.ts
      mutations.ts
      mutations.test.ts
      schemas.ts
    alerts/
      mutations.ts
      mutations.test.ts
  realtime/
    telemetryStream.ts
    telemetryStream.test.ts
    dispatcherSocket.ts
    dispatcherSocket.test.ts
  fleet/
    FleetProvider.tsx
    fleetStore.ts
    fleetStore.test.ts
    telemetry.ts
    telemetry.test.ts
    telemetryHealth.ts
    telemetryHealth.test.ts
  components/
    dispatcher-presence/
      DispatcherPresence.tsx
      useDispatcherPresence.ts
      presenceState.ts
      presenceState.test.ts
      registrationSchema.ts
    ui/
      MetricMeter.tsx
      WriteToasts.tsx
    RouteStatus.tsx
    StatusBadge.tsx
  screens/
    fleet/
      FleetScreen.tsx
      components/
        TruckGrid.tsx
        TruckCard.tsx
        TruckMeasurements.tsx
        TruckMileage.tsx
        TruckViewers.tsx
        TruckAlertPanel.tsx
        SendAlertForm.tsx
      schemas/
        alertSchema.ts
      utils/
        gridPosition.ts
        gridPosition.test.ts
        formatFuelPercentage.ts
        truckAlerts.ts
        truckAlerts.test.ts
    routes/
      RoutesScreen.tsx
      components/
        RouteForm.tsx
        RouteActions.tsx
      hooks/
        useRoutes.ts
      schemas/
        routeSchemas.ts
      utils/
        routeState.ts
        routeState.test.ts
        routeActions.ts
        routeActions.test.ts
  styles/
    theme.css
```

Group REST by resource under `api/`. Use `queries.ts` for reads, `mutations.ts` for writes, and `schemas.ts` for API payload validation and inferred types. Keep resource-specific payloads in their API folders. Put a field that more than one of those payloads, or a payload and a live event, share in a named file under `src/sharedSchemas`, such as `locationSchema.ts`. The truck record and fleet snapshot live in `fleetSchema.ts` because the fleet API and the telemetry merge share them. Form input schemas stay with the form feature. Keep SSE and WebSocket connection logic in `realtime/`. The shared HTTP client keeps response status, headers, and error payloads. The fleet client owns retry timing and preserves the caller's abort signal. The routes client sends the captured `If-Match` version and exposes typed conflicts. The feature owns the refresh, draft, and feedback when a conflict occurs.

### Shared dependencies

When two sibling areas share ownership of a contract, schema, or utility, extract it to the nearest common layer and have both consumers import from there. For example, Fleet REST and SSE both import `locationSchema` from `src/sharedSchemas/locationSchema.ts`. Resource-specific payload schemas stay with their API resource. Features consume the public APIs of the services they call.

## Forms

1. On submit, run the feature's Zod schema before sending any request. Use this flow for route creation, reassignment, dispatcher registration, and truck alerts. Fleet and Routes open the same create form.
2. Map Zod issue paths to the corresponding RAC fields. Use RAC `FieldError` for inline errors and keep the values entered. Configure the form to let the Zod submit handler run, then move focus to the first invalid field after it renders.
3. With valid values, call the dedicated API function or, for registration, the dispatcher socket. Guard repeat submissions while the request is pending.
4. Show server failures in the form. When a truck becomes unavailable during assignment, refresh the choices and preserve destination, priority, and notes. Mark the truck field for review. Apply route-version conflict handling to status actions as described below.

## Error handling and toast implementation

- Validate REST responses and incoming SSE and WebSocket messages at their transport boundaries. Treat invalid required REST data as a failed read or unconfirmed write. Ignore malformed events without dropping the connection. Validate batch readings independently so one bad reading cannot discard the rest. Apply valid fields independently when the reading has a usable truck ID and timestamp.
- Keep fetch errors with the region that owns the data. Reuse the existing snapshot during refresh failure and expose a retry. Keep HTTP status, payload, and headers in the API layer. A failed route resync leaves the cached list visible and marked stale until a successful refresh.
- Track SSE and WebSocket states separately. On SSE failure, keep the existing EventSource while it retries. Back off between WebSocket attempts and keep writes unavailable while registration is missing. After registration, restore presence and reconcile the route snapshot before sending a route edit.
- Introduce one shared Tailwind-styled RAC toast region with the first write in Section 6. Keep the installed RAC version's alpha toast exports in the shared component. Give toasts text labels and a keyboard-accessible dismiss button. Use action-specific titles such as **Route assigned**, **Could not reassign route**, or **Alert delivery could not be confirmed**. Let successes time out and keep important errors available in the originating form or action. Emit one outcome toast from the local write flow. WebSocket handlers update shared state without repeating the toast.
- Preserve drafts and show a persistent action-level error for write failures. For a confirmed `409`, refresh state and show the conflict. For a transport failure, timeout, or invalid response after a write was sent, treat the result as unconfirmed. Refresh route state where applicable and let the dispatcher review before retrying. Apply the same feedback conventions to later route actions and alerts.

## Data rules

- **Fleet bootstrap.** Load metadata and the initial positions via REST. If the snapshot finishes after SSE, fill in metadata while retaining telemetry that already arrived. Retry only eligible fleet reads. Respect the supplied `Retry-After` value, bound attempts, cancel waits on teardown, and keep the previous snapshot visible if available.
- **GPS.** Use each reading's timestamp, with one accepted position per truck. Apply the newest eligible batch point in one state update. Process valid normal readings in receipt order for freshness, speed, fuel, and temperature, even when the position timestamp is out of order. Start the eight-second timer at the first SSE open and reset it only on normal receipts per truck. Snapshot, batch, connected, heartbeat, and reconnect events leave it unchanged.
- **Sensors.** Accept current live speed, fuel, and temperature independently of GPS updates. Apply a named plausibility limit of `250 km/h` to normal speed readings. Keep the last valid speed when the field is outside the inclusive `0–250 km/h` range or invalid. Apply this at the field level so other usable telemetry in the same reading still updates. Silently hold the last non-zero fuel value through two consecutive normal zeros, or show unavailable if no usable value exists. Confirm zero on the third normal zero. A non-zero or invalid fuel field, disconnect, or stale gap resets the pending count. GPS batches and zero-valued REST snapshots leave the count unchanged. A positive snapshot clears a pending count and fills missing fuel while preserving accepted values. The project specifies no additional low-fuel percentage threshold.
- **Vehicle detail.** Derive gauges from current telemetry. Request mileage on selection and extract only mileage from the detail response. Abort or disregard obsolete responses. Bound retained telemetry if a chart needs history. Reuse current route state in the card.
- **Routes.** Reconcile REST snapshots, mutation responses, and socket events by route ID and version. Ignore stale writes to current state. Track observed history once per route version and derive truck assignments from nonterminal routes. Keep drafts independent of socket state. Capture the route version when a status or reassignment action opens. Send that version in `If-Match`; after a `409`, refresh via `GET /api/routes`, present the server state and actor when known, and ask for a fresh review. Never automatically retry a route write. For reassignment, check current client state and handle target conflicts from the server. The mock rejects a reassignment whose reviewed version is stale or whose route is already complete or cancelled. A development `fleet_reset` replaces the open route list and clears peer presence instead of merging the empty snapshot.
- **Presence.** After registration, report the effective view with `{ type: 'viewing_truck', truckId }`. Compute it from the current app view, the expanded truck ID, and tab visibility. Send changes while registered and reannounce the effective value after reconnect and when a peer joins. The mock relays `null` as a clear signal. A hidden tab or network failure can prevent immediate delivery, so peers also clear by session ID on `dispatcher_left`. The mock can delay that event by ten seconds. A disconnected local WebSocket marks remote presence unavailable until a new connection establishes it again.
- **Presence display.** Keep one record per server-issued session ID with its display name if known and one nullable truck ID. Retain the local display name and use a fresh ID on reconnect. Merge join and viewing events by ID and remove only the session named in a leave event. Derive the Online dispatchers row and viewers per truck from the same store. Include local presence in the row and filter it out of truck labels and counts. The mock has no roster snapshot. Reannouncements can reveal existing peers by ID, while names come from observed joins. Keep the marker and any full-list disclosure independently keyboard accessible.
- **Alerts.** Validate the message and severity locally and check that the response matches the selected truck. Deduplicate REST and socket results by alert ID. Keep up to 20 recent alerts per truck in dashboard memory. Treat success as acceptance by the mock.

## Build sections

The scaffold is complete. React, RAC, Tailwind, Zod, and the shared HTTP client are installed. The build and request-layer tests passed, and REST, SSE, and WebSocket worked through the Vite proxy.

Build the sections in order. Each section can span several commits. Implement its error states and tests as the behavior lands and use the **Done when** checks to verify it before starting the next section. Each section below is its working spec, with requirements, completion checks, and open decisions. The requirement IDs refer to the [specification](01-spec.md). Record verification in the [test map](04-test-map.md) and significant decisions or deviations in the [decision log](03-decisions-and-changes.md). Update the affected specs and tests when behavior changes.

### 1. Fleet snapshot and selection

**Status** · Complete. See the [verification evidence](04-test-map.md#section-1-verification).

**Requirements** · FL-01, FL-04

**Open decisions** · None.

- Load `GET /api/fleet` through `src/api/fleet/queries.ts`. Show loading, empty, and error states, with a retry action after failure. Keep existing data visible during a retry.
- For a fleet `503`, retry up to twice after the initial attempt. Respect `Retry-After` as seconds or an HTTP date. Use a one-second delay if the header is absent or invalid. Cancel the request and any scheduled retry when its caller is disposed.
- Render a coordinate grid beside the truck card column, with one marker and one card per truck. Show speed, fuel, engine temperature, and a textual operational status on each card. Use the shared Tailwind theme and stack the grid and cards on narrow screens. Section 5 adds the dispatcher row above the grid.
- Use a fixed Tel Aviv window centered at `32.0853, 34.7818`, extending 0.05° in each direction. Latitude spans `32.0353–32.1353` and longitude spans `34.7318–34.8318`. North is up and east is right. Keep the scale fixed as trucks move. Clamp a valid out-of-window fix to the nearest edge for display and retain its original coordinates.
- Use one selected truck ID. Activating a RAC marker button or a card's RAC control opens that truck's details and highlights its marker. Collapsing the card clears the selection. Marker hover and keyboard focus show the tooltip without changing selection.

**Done when** all 12 snapshot trucks render once in each view of the fleet, pointer and keyboard selection agree, and controlled-clock tests verify retry timing, exhaustion, and cancellation. The view identifies its data as a snapshot until Section 2 connects live telemetry. Moving one truck leaves all other marker positions unchanged.

### 2. Live GPS

**Status** · Complete. See the [verification evidence](04-test-map.md#section-2-verification).

**Requirements** · FL-02

**Open decisions** · None.

- Connect one dashboard-level SSE client in `src/realtime/telemetryStream.ts`. Handle normal telemetry and GPS batches, and close the connection on cleanup.
- Compare timestamps per truck. A batch contributes at most its newest eligible position per truck in one update. Guard the initial REST merge so a late response fills in metadata without overwriting newer live data.
- Keep position ordering independent from normal-reading freshness and sensor logic. Batch fixes are at least two seconds older than the same tick's normal timestamp. Use a fixture to verify a batch advancing a stale marker.

**Done when** positions update live and tests prove that duplicate readings, delayed batches, and a late snapshot cannot move a marker backward.

### 3. Freshness and sensor faults

**Status** · Complete. See the [verification evidence](04-test-map.md#section-3-verification).

**Requirements** · FL-02, FL-03

**Open decisions** · None.

- Show **Reconnecting to telemetry** when the stream drops and use EventSource reconnect. After eight seconds without a fresh normal reading, dim that truck's marker, label it **Signal stale**, show the age of its position, and label card values as **Last known**. A historical GPS batch can advance the position and update its age while the signal remains stale.
- A normal speed above `250 km/h`, including the mock's `999 km/h`, sets a speed fault and retains the last valid speed and timestamp. Show **Speed unavailable** if there is no valid sample. Keep applying eligible GPS, fuel, and temperature data. Hold the accepted fuel value silently through the first two normal zeros and display `0%` on the third, following the data rules above.
- Clear signal staleness on a valid normal receipt. Clear a speed fault on the next valid normal speed, even if that reading carries an older position timestamp. Connected messages, heartbeats, and GPS batches leave both warnings unchanged.

**Done when** controlled events show that a truck can have fresh GPS and a speed fault at the same time, delayed GPS cannot clear a stale signal, and transient and sustained fuel zeros produce different outcomes.

### 4. Vehicle detail

**Status** · Complete. See the [verification evidence](04-test-map.md#section-4-verification).

**Requirements** · FL-03

**Open decisions** · None.

- Add RAC meters for live speed, fuel, and engine temperature. Show the latest accepted values and surface any sensor warning alongside the affected meter.
- Load only mileage through the selected truck's detail endpoint in `src/api/fleet/queries.ts`. Position and sensor values remain owned by the snapshot and live pipeline. Handle pending and failure states inside the detail card. Cancel or discard requests for trucks that are no longer selected.

**Done when** the meters update on live readings and rapid selection changes cannot display mileage from the previously selected truck.

### 5. Dispatcher presence

**Status** · Complete. See the [verification evidence](04-test-map.md#section-5-verification).

**Requirements** · FL-07

**Open decisions** · None.

- Require a trimmed, nonblank display name in the Zod-validated RAC form. Send `{ type: 'register_dispatcher', name }` through `src/realtime/dispatcherSocket.ts` and use the server-issued ID for this connection. Show **Online dispatchers** directly above the grid, including **You** and known peers, with the truck each dispatcher has open when available.
- Report a truck only while its detail card is expanded in the visible Fleet view. Clear on collapse, navigation away, or tab hide. Reannounce on return or reconnect.
- Derive **Viewed by** names and marker counts from one current truck per peer session. Show two names and an accessible **+N** control for larger groups. Clear only the session identified by a leave event.

**Done when** two viewers can share one truck and a third session sees both. Switching, clearing, or reconnecting one viewer preserves the other. Tooltip hover and focus send no viewing update. Verify navigation away again when the Routes view lands.

### 6. Shared routes and assignment

**Status** · Complete. See the [verification evidence](04-test-map.md#section-6-verification).

**Requirements** · FL-05, FL-06

**Open decisions** · None.

- Add URL navigation between Fleet at `/` and Routes at `/routes` with React Router and RAC links in the app shell. Both views support direct URLs and browser back and forward. Keep dispatcher registration and shared route state at the app level so navigation preserves the session and clears Fleet viewing presence when appropriate. Add a RAC route table backed by one version-aware route store shared with Fleet. Show the assigned route destination and status on each truck card, using the same route store as the table. Leave the destination blank until route data loads. Show **Unassigned** only when the list confirms it. Include available route metadata and observed activity in route details.
- Merge REST snapshots and WebSocket updates by route ID and version. Resync after reconnect and deduplicate audit entries.
- Show **Assign route** inside the expanded card when the truck is unassigned and not in maintenance, whether it is idle or active. The collapsed card points dispatchers to **Show details** to find that action. Open the same Zod-validated form as **New route**, with the truck preselected. The truck selector lists every truck with its operational status and disables maintenance trucks and trucks that already have a route. Use `src/api/routes/queries.ts` for reads and `src/api/routes/mutations.ts` for writes. If creation returns `409`, refresh the assignments, show the existing route and dispatcher when available, and keep the destination, priority, and notes. Use the returned route version as the starting point for later edits.

**Done when** either entry point can create a route that appears in both tabs. Invalid input sends no request. Route creation produces one outcome toast. Simultaneous assignment to the same truck leaves the losing dispatcher with a conflict message and their draft.

### 7. Route actions and conflict recovery

**Status** · Complete. See the [verification evidence](04-test-map.md#section-7-verification).

**Requirements** · FL-05, FL-06

**Open decisions** · None.

- Assigned routes can start, cancel, or reassign. In-progress routes can complete, cancel, or reassign. Terminal routes offer no mutation actions. Each action opens a RAC review dialog, including confirmation for cancellation and reassignment. Completing or cancelling releases the truck in both views.
- Capture the route's server-issued `_version` when a status action opens and send it in `If-Match`. The server advances the route version after successful changes. The truck `_version` on the fleet payload is a separate counter. Use the route version for `If-Match`. On a conflict, refresh the route, preserve the draft, show the actor when known, and require a fresh review before another write.
- Handle an occupied target during reassignment and document the mock's lack of a source-route version check.

**Done when** Tab A can open a status action, Tab B can reassign the route, and Tab A sees the new assignment and keeps its draft when it submits. Verify one toast for each action outcome and cover reassignment during PATCH processing with a controlled test.

### 8. Truck alerts and failure states

**Status** · Complete. See the [verification evidence](04-test-map.md#section-8-verification).

**Requirements** · FL-08 and remaining UI failure states

**Open decisions** · None.

- Add a RAC alert form to the expanded card. Load it when first opened and offer Info, Warning, and Critical severity, defaulting to Info. Validate on submit with Zod and use `src/api/alerts/mutations.ts` to send the alert for the named truck.
- Show inline errors and pending feedback, then one outcome toast for the sender. Preserve the draft and persistent feedback after a failure. Deduplicate the REST response and WebSocket broadcast by alert ID.
- Add the dashboard error boundary for render failures and verify connection feedback and keyboard access across both views.

**Done when** blank alerts send no request, one successful alert appears once per tab, and failed submissions keep the entered message.

### 9. Submission verification

**Status** · Complete. See the [verification evidence](04-test-map.md#section-9-verification).

**Requirements** · FL-09

**Open decisions** · None.

- Sweep the finished project and confirm that every flow and critical handler has a test that exercises the real behavior. A test that only renders, or mocks the outcome it claims to prove, does not count. Add the missing cases before submission. Keep the two-tab Chrome walkthrough for behavior that depends on two live sessions.
- Run `npm install`, `npm start`, `npm run build`, and `npm test` from a clean checkout. Verify at least eight meaningful behavior tests and run the dispatcher walkthroughs in Chrome.
- Reconcile the test map with actual evidence. Finish README setup, architecture, conflict walkthrough, and limitations. Update the AI usage journal.

**Done when** a reviewer can start the project, see the fleet and route updates, and reproduce the conflict and multi-viewer behavior using the README.


### 10. Shared fleet state

**Status** · Implemented. See the [verification evidence](04-test-map.md#section-10-verification).

**Requirements** · Preserve FL-01 through FL-05 and Fleet viewing presence while moving live fleet state out of the app shell. Fleet and Routes must see the same current fleet. A GPS, sensor, or freshness update that leaves truck identity and operational status unchanged must leave the Routes and assignment dialog fleet inputs unchanged.

**Implementation choice** · Use React's built-in `useSyncExternalStore` and a small fleet store in `src/fleet/`.

**Open decisions** · Decide whether the Fleet grid and cards need individual subscriptions after measuring the first migration. Fleet diagnostics can use the same store if added later.

1. **Create the shared fleet store.** Use a domain folder such as `src/fleet/` because Fleet, Routes, and the app shell all consume the data. Move the existing GPS and sensor merge functions and their tests there so the store can use them without importing from a screen. Keep the REST call in `src/api/fleet/` and SSE decoding and subscription in `src/realtime/`. Create one store instance per mounted dashboard. Expose a stable `subscribe` function that returns an unsubscribe function, plus `getCatalogSnapshot` and `getFleetSnapshot` readers. Connect each reader with `useSyncExternalStore`. Both readers return cached, immutable snapshots. Commit the new state before notifying subscribers, and keep the catalog snapshot reference stable unless a truck ID, name, or operational status changes. `FleetProvider` supplies the stable store instance and starts its lifecycle in one effect. Keep the REST and SSE transports in their dedicated modules.
2. **Move the fleet lifecycle.** Replace the state currently owned by `useFleetData` and `useFleetTelemetry`. The store owns the validated snapshot, loading and connection status, the latest accepted position and sensor state per truck, and freshness. The store lifecycle owns one EventSource, the refresh request, and the freshness timer. Apply each decoded packet as a single update. On unmount, abort the request, clear timers, and close SSE. Test Strict Mode cleanup and startup. Preserve last-known values after failed refresh, automatic SSE reconnect, manual reconnect when the stream is closed, and the existing `fleet_reset` refresh. Guard against late requests or callbacks from an earlier lifecycle. Preserve GPS timestamp ordering, receipt-time freshness, and speed and fuel anomaly behavior using the existing merge functions.
3. **Give each consumer the data it needs.** Expose a stable truck catalog of IDs, names, and live operational statuses. Preserve the catalog reference when those fields stay the same. App can use it for names and combine it with the existing route assignment map for eligibility and route choices. Fleet reads the full current truck view and load status directly through a hook. Keep the filter in `FleetScreen` and pass the same visible list to the grid and cards. Keep the selected truck ID in App because navigation and dispatcher viewing use it. Clear selection only when a successful fleet snapshot removes the truck, and preserve the filter's current behavior of keeping the expanded truck visible. The store is the source for all trucks, including those hidden by filters.
4. **Verify isolation and behavior.** With a controlled stream, assert that a GPS-only update, a speed-only update, and a freshness tick update the relevant Fleet view while the catalog reference stays stable. Assert that a live operational status change reaches route eligibility and a route assignment changes the picker and the assignment filter. Recheck initial and failed refresh, late snapshot merge, SSE reconnect, stale recovery, filter consistency, and Fleet → Routes → Fleet navigation with dispatcher presence and one live stream. Run the existing Vitest and Playwright suites and compare React Profiler recordings before and after with Routes open.
5. **Measure before adding finer Fleet subscriptions.** If Fleet itself needs narrower updates, derive visible IDs once from status, fuel, location, and assignment data. Let the grid subscribe to marker data and let each card subscribe by truck ID. Keep selector results stable when the fields a consumer reads stay the same. Check that freshness and age labels still update when needed.

**Done when** Fleet and Routes share one fleet lifecycle, ordinary GPS and sensor updates no longer trigger an app-shell render through fleet state, operational status and route changes still reach eligibility, and the existing filter, telemetry, and navigation checks pass.
