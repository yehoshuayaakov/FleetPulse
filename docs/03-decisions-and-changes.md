# FleetPulse decisions and changes

The [build sections](02-implementation-plan.md#build-sections) are the working specs. Record significant decisions, contract findings, or implementation deviations here. Update the affected spec and test map in the same change and add verification evidence as work lands.

## Open decisions

None.

## Decision record

### 2026-11-12 · Documentation review

| Section | Decision | Reason or evidence |
| --- | --- | --- |
| 1 · Fleet snapshot | Fix the Tel Aviv grid at ±0.05° from `32.0853, 34.7818`. Clamp the rendered point at the edge and retain the source coordinates. | The mock steers trucks back when they cross a radius of 0.05°. A fixed grid prevents the rest of the markers from shifting. |
| 2–3 · GPS and health | Order position by timestamp. Use normal-reading receipt order for freshness and valid sensors. Start the stale clock at first SSE open. | The mock can send an older position in a normal reading. The test map covers receipt-based recovery and batch advancement on a stale truck. |
| 3 · Fuel | Silently hold the accepted value through two consecutive normal zeros and display zero on the third. A positive REST snapshot clears the pending count. | See Silent fuel zero confirmation below. |
| 4 · Vehicle detail | Extract mileage only from the truck detail response. | Its location and sensor values can race with live updates. |
| 5 · Presence | Require a nonblank display name and let the server issue the session ID each time. | A delayed leave can remove a reconnected session that reuses its ID. |
| 6 · Assignment | Leave the card destination blank until routes load. Fleet and Routes both assign any truck that is unassigned and not in maintenance. | Most trucks start active without a route. |
| 7 · Route edits | Send the route version in `If-Match`. | The fleet truck version is updated by telemetry simulation. |

For future entries, record the date, section, decision or change, reason, and verification status. Move resolved open decisions into the record.

### 2026-11-12 · Section 1 implementation

- The Fleet view exposes **Refresh snapshot** so dispatchers can update the initial REST view and retain the previous snapshot if a refresh fails.
- Grid marker activation scrolls the matching card into view when the desktop card list overflows. The narrow layout places the list below the grid.
- Section 1 passed the build, Vitest, and a Chrome check with the local mock and controlled fetch failures. See [Section 1 verification](04-test-map.md#section-1-verification).

### 2026-11-12 · Speed plausibility

- Use an inclusive valid speed range of 0–250 km/h for normal telemetry. A named upper limit catches the mock's 999 km/h fault and other implausibly high values. A speed fault affects only the speed field. Section 3 keeps the known 999 sequence and adds boundary coverage.

### 2026-11-12 · Section 2 implementation

- REST and SSE positions use the same per-truck timestamp merge. A live fix received before a late REST response remains visible if it has the newer timestamp.
- The mock can generate fractional timestamps when it simulates out-of-order data. The parser accepts finite fractional timestamps and the merge handles their ordering.
- The Fleet view shows connection and recovery state separately from the timestamp for its REST truck metrics. Live freshness and sensor handling are covered in Section 3.
- Section 2 passed the build, 24 unit tests, and Chrome checks against the real mock and controlled SSE fixtures. See [Section 2 verification](04-test-map.md#section-2-verification).

### 2026-11-12 · API module layout

- Group REST code by resource and keep query functions, mutations, and Zod API schemas in separate files. The Fleet split keeps its existing retry, cancellation, and validation behavior. Routes and Alerts will follow the same layout when they land.
- Keep the current REST request layer for now. Revisit TanStack Query when shared route reads and writes provide a concrete reason to add caching and invalidation. The existing event and conflict rules still apply either way.
- The TypeScript/Vite build and all 24 tests passed after the split.

### 2026-11-12 · Shared schema ownership

- The user moved the shared location schema to `src/globalSchemas/locationSchema.ts`. Fleet REST and SSE now import from this common owner.
- Apply the same principle to future sibling areas. Promote genuinely shared definitions to their nearest common layer and keep resource-specific and feature-specific definitions with their owners.

### 2026-11-12 · Section 3 implementation

- Freshness and stale-gap detection use monotonic receipt time. Position age uses the accepted GPS timestamp, and last-valid speed age uses the time that speed was received.
- A normal packet can update valid metrics independently of GPS ordering. Batch packets only contribute positions. Snapshot refreshes can fill missing values while preserving live readings and freshness.
- Shared telemetry and operational-status schemas live in `src/globalSchemas/`. Resource schemas and the stream parser both use that common layer.
- The build, 41 tests, and real-mock and fixture checks in Chrome passed. See [Section 3 verification](04-test-map.md#section-3-verification).

### 2026-11-12 · Section 4 implementation

- The expanded card reuses the same accepted telemetry as the collapsed card and adds RAC meters. The speed meter uses the plausibility range. Fuel uses 0–100% and the temperature bar uses a fixed visual range of −40–150 °C, with the actual accepted temperature retained in the label.
- Mileage loads only while its truck card is expanded. On collapse or selection change, the detail request is cancelled and any late result is ignored. The detail response is checked against the selected truck ID and contributes only mileage.
- The build, 44 tests, and Chrome checks passed. See [Section 4 verification](04-test-map.md#section-4-verification).

### 2026-11-12 · Fleet visual review

- Grouped telemetry status with the snapshot time, sized the desktop grid to fit within typical laptop viewports, and added a marker status legend. The geographic bounds remain fixed.
- Checked 1440 × 900 and 1280 × 768 desktop views and a 390 px phone view in Chrome. The expanded phone card remained readable with stale telemetry, a speed fault, and provisional fuel. The build and all 44 tests passed.

### 2026-11-12 · Silent fuel zero confirmation

- Supersedes the original four-second fuel rule. The first two consecutive normal zeros preserve the last accepted value silently. The third displays 0%. This filters brief zero readings while avoiding a provisional warning for an implausible instant drop. Three zeros confirm the displayed reading. Back-to-back mock faults can still produce that sequence.
- Freshness and the eight-second gap still use receipt time. Only valid normal zero samples count. A pending count resets after invalid fuel, a nonzero reading, a disconnect, or a stale gap. A confirmed zero persists until a normal nonzero reading. REST snapshot zeros leave the pending count unchanged. A positive snapshot clears a pending count and fills missing fuel while preserving accepted values. Positive values below 1% display as <1% to distinguish them from zero.
- The build and all 48 tests passed. Chrome verified the controlled three-zero sequence, unchanged warning color, invalid-field feedback, and positive recovery. A real mock glitch also held its fuel value silently and resumed on the next nonzero reading.
- The assignment tip says to handle anomalies thoughtfully rather than ignore them. Withholding the first two zeros is that handling: the sample is counted, kept out of the displayed percentage, and shown as `0%` only if it persists. A stuck speed stays visible because the rest of the truck can still be trusted while that number is old. A card notice during the first two zeros stays open and can be revisited at the end if time remains.

### 2026-11-12 · Section 5 implementation

- Dispatcher WebSocket state lives in the app shell. Registration has a ten-second deadline. Reconnect starts at one second, doubles to a maximum of thirty seconds, and resets after registration succeeds.
- The visible selected truck is announced after registration, on selection or visibility change, and when a peer joins. The observer derives card names and marker counts from one viewing state per known session ID. The mock has no roster snapshot, so a peer can be identified by ID before its name is known.
- The build, 55 tests, and four-session Chrome check passed. The Routes navigation test remains part of Section 6. See [Section 5 verification](04-test-map.md#section-5-verification).

### 2026-11-12 · Feature file layout

- Grouped Fleet and Presence by responsibility. Views and their UI pieces live in components, React state and lifecycle code in hooks, feature validation in schemas, and pure functions in utils. Keep utility tests next to the functions they cover. Future features use the same pattern where it fits.
- Kept utilities flat at their current size. The build and all 58 tests passed after moving the files.

### 2026-11-12 · Application router

- Use React Router 7 for Fleet and Routes. Fleet is `/` and the route list is `/routes`. Both support direct URLs and browser back and forward. `react-router` is already installed.
- Render RAC links through React Aria's router provider, using React Router's `navigate` and `useHref`. Keep dispatcher registration and the shared route store above the outlet so navigation preserves the session. Report no viewed truck while the matched view is not Fleet.

### 2026-11-12 · Section 6 implementation

- React Router provides Fleet at `/` and Routes at `/routes`. The app shell owns fleet and dispatcher state, so navigation preserves registration and leaving Fleet clears the viewing announcement.
- Kept the existing REST layer for the shared, version-aware route store. Route snapshots and WebSocket events merge by version. The Routes screen and assignment form load on demand.
- Route priorities are Normal and High, with Normal selected by default. Create requests time out after ten seconds and are never automatically replayed. An unconfirmed write prompts a route refresh and preserves the draft.
- The build, all 64 tests, and the two-session Chrome walkthrough passed. See [Section 6 verification](04-test-map.md#section-6-verification).

### 2026-11-12 · Final test sweep

- When the required flows are finished, review the whole project for untested flows and critical handlers. Fill gaps with tests that call the real behavior and would fail if it regressed. The route-event socket path is one known gap. The two-tab Chrome walkthrough remains the check for behavior that needs two live sessions.

### 2026-11-12 · Section 7 implementation

- Assigned routes allow start, cancel, and reassign. In-progress routes allow complete, cancel, and reassign. Completed and cancelled routes remain available for review.
- Status changes capture the route version when the action opens. Conflicts keep the requested action and require explicit review and a separate submit. The latest actor comes from the matching observed version or identifiable route metadata.
- Reassignment checks the latest observed version in the client before writing. The mock's PUT checks target availability and has no source version precondition, so a race during submission remains possible.
- Two-session Chrome checks verified both real status 409 paths, an occupied target, and truck release after completion or cancellation. The build and all 68 tests passed. See [Section 7 verification](04-test-map.md#section-7-verification).

### 2026-11-12 · Section 8 implementation

- The alert form offers Info, Warning, and Critical, defaulting to Info. It loads on first use. Closing and reopening the alert form in the same expanded truck card preserves the draft.
- A confirmed alert means the mock accepted it. Keep the latest 20 alerts per truck observed in the current session. Merge REST and WebSocket delivery by alert ID and show the outcome toast only to the sender.
- A rejected or unconfirmed alert retains its draft. After a lost response, the dispatcher can inspect recent alerts before deciding whether to send again.
- The render error boundary offers a keyboard-accessible reload. See [Section 8 verification](04-test-map.md#section-8-verification).

### 2026-11-12 · Final scope decisions

- Keep the first two normal fuel zeros silent, as agreed. The third consecutive zero confirms the reading.
- The final sweep added route snapshot failure and malformed-payload cases, plus a socket test for accepted and rejected route events. It also added priority and notes to the expanded truck card so dispatchers can review the assignment from Fleet.
- Git preserves the supplied mock copy byte for byte across checkout line-ending settings. The clean clone passed installation, the build, 77 tests, and the Chrome walkthrough. See [Section 9 verification](04-test-map.md#section-9-verification).

### 2026-11-12 · Fleet layout and dispatcher validation

- Give the coordinate grid the wider desktop column and let it fill that space. Keep the truck list alongside it on desktop and below it on phones.
- Match each truck's numbered marker and card badge with a stable color. A separate marker dot and the tooltip and card labels convey operational status.
- Align **Online dispatchers** with the display-name input and join button when they share a row. Reserve one line below the input for the validation message. Chrome verified that the presence row and map stay in place when the error appears or clears at 1366, 390, and 320 px widths. At 1366 × 768, the plot grew from 246 × 246 to 730 × 384 and fit in the visible area.
- The running mock returned an empty route list. The README describes creating the first route and the mock's in-memory storage.

### 2026-11-12 · Truck card disclosure

- Label the card trigger **Show details** or **Hide details**. Put the assignment hint on collapsed cards for unassigned trucks that are not in maintenance, and the **Assign route** button in their expanded details.
- Chrome verified keyboard expansion, collapse, and the hint at desktop and 320 px widths. The assignment button opened the shared form with the selected truck prefilled.

### 2026-11-12 · Marker status and truck colors

- Use the status color for the marker fill. Keep the white border and use the truck's card badge color for the outer ring. Selection and keyboard focus have their own outline.
- Chrome verified the fill, border, and ring on all 12 markers and checked the selection and focus outlines. The production build passed.

### 2026-11-12 · Status-only markers

- Use 28 px numbered circles on the map. The marker and numbered card badge use the same operational status colors: green for active, light gray with a dark border for idle, and amber for maintenance. Selection and keyboard focus use the accent outline.

### 2026-11-12 · Sweep defect checks

- `npm run test:e2e` covers the two sweep defects with two browser sessions on a separate mock. `npm test` remains Vitest.
- A reassignment PUT now requires the reviewed route version and rejects a completed or cancelled route, so a late reassignment cannot attach a cancelled route to the target truck. This is a deliberate change to the mock's reassignment handler.
- An open tab handles `fleet_reset` by replacing its route list, clearing peer presence and alerts, and reloading the fleet snapshot.

### 2026-11-12 · Dispatcher tags

- Give each online session a separate bordered tag. Mark the local session as **You** and use **Viewing** before the truck name inside that dispatcher's tag.
- Chrome verified three separate tags and independent viewing updates at desktop and 320 px widths.

### 2026-11-13 · Shared schemas

- Rename `src/globalSchemas` to `src/sharedSchemas`. A schema lives there when two areas share the contract.
- Move the truck record and fleet snapshot to `src/sharedSchemas/fleetSchema.ts`. The fleet API and the telemetry merge both use them. Mileage stays in `src/api/fleet/schemas.ts`.

### 2026-11-12 · Screen layout and navigation scroll

- Group Fleet and Routes under `src/screens/`. Both screens render the shared dispatcher presence component. The app shell owns the live connection across screen changes.
- Start each screen at the top on navigation and browser Back. Scroll the selected truck into view inside the truck list so it does not move the page.
- The Chrome regression reproduced the Fleet heading disappearing before the fix. It passed after the change, including the Fleet link, browser Back, and dispatcher session continuity.

## Shared fleet state

- Place the store, GPS and sensor merge rules, and their tests under `src/fleet/`. Mount the store once per dashboard and subscribe with React's `useSyncExternalStore`.
- Fleet reads the live view. App uses the stable catalog of truck IDs, names, and operational statuses for route choices and dispatcher labels. Keep filter state in Fleet and the selected truck ID in App for navigation and presence.
- Keep a single SSE connection, refresh request, and freshness timer in the store lifecycle. Abort superseded requests and ignore callbacks from replaced connections. The provider starts and stops the lifecycle through its effect.

## Dispatcher names for late joiners

The mock includes the registered display name in each viewing event. Existing tabs reannounce their current view when another dispatcher joins, including when no truck is open. The joining tab uses the name on that event, and an older mock that omits the name can still supply the session ID and view. The name comes from the sender's registration.
