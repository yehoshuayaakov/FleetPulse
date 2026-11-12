# FleetPulse test map

The table maps each requirement to behavior exercised by Vitest and Chrome. The section notes record the specific cases and results.

| Requirement | Vitest coverage | Chrome verification |
| --- | --- | --- |
| FL-01 | Fixed projection, bounds, edge clamping, and stable scale when another truck moves. | The mock loads 12 unique markers and cards. Pointer and keyboard select the same truck. Tooltips and narrow layout work. |
| FL-02 | Batch reduction, timestamp ordering, late snapshots, field isolation, per-truck freshness, and stream lifecycle. | Real markers move. Fixtures cover stale markers, batch advancement, reconnect, and recovery on a normal receipt. |
| FL-03 | Speed plausibility and recovery, silent zero confirmation and count resets, mileage parsing and truck identity. | Gauges update, sensor feedback matches the held value, and scoped retry or rapid selection leaves the current card consistent. |
| FL-04 | Retry-After formats, bounded attempts, cancellation, and invalid response handling. | The initial error has a retry. A failed refresh retains the previous fleet. |
| FL-05 | Route merging, assignment release, read validation, mutation contracts, and action availability. | Create from Fleet or Routes, check truck eligibility, validate create and reassign before writing, and see changes in both sessions. Competing writes to one truck yield a 201 and a 409. |
| FL-06 | Captured route version in If-Match, typed conflict payloads, validated socket updates, deduplicated activity, and actor selection. | Reassignment races before and during status PATCH. The dialog preserves the action and identifies the actor when available. Retrying requires a fresh review. |
| FL-07 | Registration, viewing, reconnect, delayed leave, and per-session viewer grouping. | Two dispatchers open the same truck. An observer sees both names and the count. Switching, hiding, collapse, and leaving Fleet update that count. |
| FL-08 | Alert target and response validation, dispatcher header, no replay, event validation, and bounded deduplication. | Whitespace sends no request. Both tabs see one alert and the sender gets one toast. Rejection and response loss preserve drafts. |
| FL-09 | Run the complete Vitest suite. | Clean-checkout install, startup, production build, and the Chrome walkthrough. |

## Section 1 verification

- **FL-01** · `src/features/fleet/utils/gridPosition.test.ts` covers center, corners, edge clamping, and a stable projection. In Chrome, the live mock returned 12 distinct markers and cards. Keyboard focus and pointer hover showed tooltips. Keyboard and pointer activation selected the matching truck, and collapsing cleared its marker selection. Selecting a truck below the fold scrolled its card into view. At 390 px, the card list stacked below the grid without horizontal overflow.
- **FL-04** · `src/api/fleet/queries.test.ts` covers both `Retry-After` formats, fallback delay, exhaustion, cancellation, invalid payloads, and non-retriable HTTP errors. Chrome fixtures covered an initial load error, an empty response, a failed refresh with the previous fleet retained, and successful manual retry.
- `npm run build` and `npm test` passed. The suite contains 12 tests across three files. The build reports non-blocking Rollup annotation warnings from Zod.

## Section 2 verification

- **FL-02 GPS ordering.** `src/features/fleet/utils/telemetry.test.ts` covers a 30-point batch, duplicate and out-of-order timestamps, independent truck positions, an older REST response arriving after live GPS, and an older batch arriving after REST.
- **FL-02 SSE.** `src/realtime/telemetryStream.test.ts` covers malformed and control messages, valid fixes alongside invalid readings and a speed fault, fractional timestamps, connection states, and cleanup.
- Chrome showed movement on the real mock stream while retaining 12 markers. Controlled SSE fixtures verified the late snapshot, batch, duplicate and delayed fixes, automatic reconnect, and manual reconnect from a closed stream.
- `npm run build` and `npm test` passed with 24 tests across five files. The existing Zod annotation warnings remain non-blocking.

## Section 3 verification

- **FL-02 freshness.** `src/features/fleet/utils/telemetryHealth.test.ts` covers the eight-second boundary, a batch moving a stale marker, an out-of-order normal receipt restoring freshness without rewinding GPS, and late snapshots preserving live values.
- **FL-03 health.** Tests cover speeds of 0 and 250, rejected or malformed speeds including 999, repeated faults preserving the last valid timestamp, first-sample unavailability, transient and sustained fuel zeros, disconnect and stale-gap resets, and malformed field isolation.
- Chrome verified live sensor changes on the real mock. A controlled clock and SSE fixture verified independent truck freshness, stale marker dimming and age, retained readings during faults, batch position recovery, and reconnect without prematurely clearing staleness.
- `npm run build` and `npm test` passed with 41 tests across six files. The existing Zod annotation warnings remain non-blocking.

## Section 4 verification

- **FL-03 detail reads.** `src/api/fleet/queries.test.ts` covers mileage-only parsing, the selection signal, URL encoding, mismatched truck identity, and invalid mileage.
- Chrome against the real mock verified three named RAC meters, live meter changes, and mileage for the opened truck.
- Chrome fixtures verified loading and retry scoped to the expanded card, signal cancellation on selection change, rejection of a late previous-truck result even when the transport ignores cancellation, and isolation from unrelated fields in the detail response. They also verified speed-fault text linked to the meter, temperature display beyond its visual range, and the 390 px layout.
- `npm run build` and `npm test` passed with 44 tests across six files. The existing Zod annotation warnings remain non-blocking.

## Section 5 verification

- **FL-07 state and transport.** `src/features/presence/utils/presenceState.test.ts` covers multiple viewers, switching and clearing independently, unknown IDs, and a delayed or duplicate leave. `src/realtime/dispatcherSocket.test.ts` covers name-only registration, selection after acknowledgement, malformed messages, reconnect identity and reannouncement, capped backoff, handshake timeout, and timer cleanup.
- Four isolated Chrome sessions using the actual mock verified required and trimmed names, the online row, two viewers and matching marker count, a keyboard-openable full list for three viewers, tooltip-only hover and focus, independent switching, visibility changes, collapse, and reconnect. A delayed-leave fixture sent to the observer left the new session and other viewers intact. The narrow layout had no horizontal overflow.
- The build and all 55 tests passed. Verify navigation away from Fleet again when the Routes view lands.

## Section 6 verification

- **FL-05/06 state and API.** `src/features/routes/utils/routeState.test.ts` covers version ordering, duplicate REST/WebSocket results, late snapshots, and released assignments. `src/api/routes/mutations.test.ts` covers the dispatcher header, validated creation result, and typed 409 metadata.
- Two Chrome sessions with the real mock verified direct `/routes` access, browser back and forward, the same dispatcher session across navigation, and clearing and reannouncing Fleet viewing.
- Chrome verified creation from an idle Fleet card and for an active unassigned truck from Routes, validation blocking the request, cross-tab updates, one audit entry per version, and initiating-tab toasts.
- Simultaneous writes produced one 201 and one 409. The losing form showed the winner's assignment and preserved its draft. A separate lost-response fixture saved a route on the server, preserved the unconfirmed draft, and sent no replay. Reconnect loaded the route snapshot again.
- The build and all 64 tests passed. Routes and the assignment form load on demand. The initial production chunk is about 533 kB minified, so Vite still reports its 500 kB size warning.

## Section 7 verification

- **FL-05/06.** `src/features/routes/utils/routeActions.test.ts` checks action availability and actor selection. `src/api/routes/mutations.test.ts` verifies the route version in `If-Match`, a status conflict with only the current version, and the occupied-target response from reassignment.
- Two Chrome sessions against the mock verified a stale PATCH after reassignment, display of the winning truck and dispatcher, preservation of the requested action, and a second explicit submit with the reviewed version. Completion and cancellation released the truck in Fleet and updated both route views.
- A controlled concurrent request produced the mock's second 409 branch while PATCH was processing. The dialog identified the reassigning dispatcher from the matching live event. A separate occupied-target PUT returned 409, retained the dialog, and named the competing assignment.
- The build and all 68 tests passed. The existing Vite size and Zod annotation warnings remain non-blocking.

## Section 8 verification

- **FL-08.** The alert API tests cover the selected truck, dispatcher header, response validation, and no replay after failure. The alert state tests cover deduplication, chronological ordering, and the per-truck limit. The dispatcher socket tests reject malformed alert events and accept valid events after registration.
- Two Chrome sessions verified an inline whitespace error with no request, Warning severity on a real 201, one recent alert in each session, and a sender-only success toast. A rejection and a lost response preserved the draft. In the lost-response case, the peer still received the mock broadcast and the sender made one write.
- Chrome verified keyboard operation of the alert disclosure and the dashboard fallback. A controlled render failure showed **Reload dashboard**, and keyboard activation recovered the live fleet after the injected failure was cleared.

## Section 9 verification

- From a fresh local clone with Node 24.18.0 and npm 10.7.0, dependency installation succeeded, the build passed, and all 77 Vitest cases across 14 files passed. The installed lockfile differed only in npm 10’s handling of optional Linux libc metadata. Package versions and integrity values matched. The install audit reported zero vulnerabilities.
- Starting the clone with npm start loaded the real mock through Vite. In Chrome, the fleet showed 12 live trucks, keyboard selection and tooltips worked, two viewers appeared on one truck and switched independently, and the 390 px Fleet layout had no horizontal overflow.
- A Fleet-card route assignment appeared in both sessions, including priority and notes in the expanded card. Reassignment produced a real 409 on the stale status edit. The dialog named the other dispatcher, then used the refreshed route version after explicit review. Completion released the truck.
- Initial route load failure and reconnect refresh failure both offered scoped retry. Reconnect kept the last available route list and blocked route writes until a successful refresh. Chrome also repeated the alert checks, keyboard dialog dismissal, and render fallback recovery.
- The mock source hash matched the pre-feature copy in the clean checkout. The build reported Zod annotation warnings and a 537.71 kB minified initial chunk.

## Error and toast checks

- Simulate failed initial fleet and route reads, a failed background route refresh, and a failed mileage read. Verify a scoped retry action, retained data when available, and no error when an obsolete request is cancelled.
- Send malformed REST, SSE, and WebSocket payloads and a batch containing one bad reading. Verify preserved valid data, continued handling of later messages, and distinct sensor fault and signal labels.
- Fail SSE and WebSocket separately. Verify their respective connection feedback, stale data, and recovery. Check that a successful socket registration with a failed route refresh keeps route data marked stale.
- Exercise successful create, status update, cancellation, reassignment, and alert actions. Check one success toast in the initiating tab even when the WebSocket echo arrives first. Confirm another tab applies the update without a write toast.
- Simulate a rejected write, a `409`, and a dropped response after the server may have applied a write. Check one outcome toast, persistent feedback, retained draft, no automatic replay, and a route refresh where applicable. Confirm a locally invalid form shows field errors and sends no request.

## Deterministic recovery fixtures

- **Single truck stale.** Withhold normal readings for one truck for at least eight seconds while the other trucks keep receiving telemetry. Deliver a heartbeat, a connected message, and a REST snapshot during the gap and verify they leave the deadline unchanged. Send a batch with a newer position than that truck's last accepted point. Verify the marker advances and position age changes, while the signal and last-known telemetry labels remain stale. Send a fresh normal reading and verify recovery for that truck.
- **Stream reconnect.** Simulate a dropped connection and a reopened stream. Verify the dashboard shows reconnection feedback and truck freshness recovers only as each truck receives a fresh normal reading.
- **Stuck speed.** Feed `48 → 999 → 999 → 44 km/h` in timestamp order. Expect displayed speed `48 → 48 → 48 → 44`, with a fault and the original last-valid timestamp during the two bad samples. Give those samples changing coordinates, fuel, and temperature to verify that only speed is held. Insert a valid historical speed between the two faults and recovery, and verify it cannot clear the fault. Also cover a first-ever speed of `999` and the unavailable state. Test that `0` and `250 km/h` are accepted, while `250.1 km/h` and `999 km/h` hold the last valid speed. An invalid speed must leave other valid telemetry usable.

- **Fuel zero.** With 60% accepted, feed `0 → 0 → 0` in normal readings and expect `60% → 60% → 0%` without a provisional warning. Two zeros more than four seconds apart but under the stale threshold still hold 60%. A valid non-zero value replaces it immediately. An invalid field, disconnect, or eight-second gap restarts the count. A batch or zero-valued snapshot leaves the count unchanged. A late positive snapshot fills missing fuel and restarts the count while preserving any accepted value. Confirmed zero persists through gaps and snapshots.

## Mock quirks covered

The eight server quirks map to GPS batch and out-of-order fixes (FL-02), speed and fuel glitches (FL-03), fleet overload (FL-04), stale route versions and mid-PATCH reassignment (FL-06), and ghost presence (FL-07). The mock sends normal readings for all trucks, with batch fixes at least two seconds older than the normal timestamp for the same tick. Use the single-truck fixture to verify signal loss and an advancing batch. Retain the real two-tab walkthrough as integration evidence.
