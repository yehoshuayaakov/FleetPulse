# FleetPulse test map

The table lists planned checks. Verification evidence is recorded by section as work lands.

| Requirement | Automated cases | Manual evidence |
| --- | --- | --- |
| FL-01 | Snapshot renders 12 unique markers and matching cards. A marker and card use the same selected ID. Test the fixed center, corners, edge-clamped outliers, and stable scale when another truck moves. | Select a truck with the pointer and keyboard. Confirm the tooltip opens on hover and focus. Check the narrow layout and textual status. |
| FL-02 | A 30-point batch yields one marker position. Duplicate or old fixes never rewind it. A batch can advance position independently of live fields. A late snapshot cannot replace live data. The stale clock starts on first SSE open. Only normal readings refresh it, including out-of-order normal readings whose positions are rejected. Those readings still update valid sensors. | Stop and restore the stream. Check stale and reconnecting feedback. |
| FL-03 | A `999` sample retains the previous speed and a later valid sample recovers. Fuel silently holds its last non-zero value through two normal zeros. The third confirms. Invalid fuel, disconnect, and staleness reset the pending count. Truck detail updates mileage only and an obsolete response cannot populate a newly selected card. | Check live gauges, mileage, and a visible fault state using fixtures if needed. |
| FL-04 | Fake time verifies `503` retry delay, bounded attempts, cancellation, and cached-data retention. | Check the retry action with a controlled fleet failure. |
| FL-05 | REST and WebSocket route duplicates apply once. A late REST result cannot overwrite a newer version. Reassigning moves the active assignment. Completing or cancelling clears it. The destination is blank while routes load, then shows the assignment or Unassigned. The card action is idle-only for unassigned trucks. Routes can assign an active unassigned truck. Concurrent creates for one truck result in one success and a `409` that preserves the losing draft. Invalid create and reassign submissions show inline field errors and send no request. | Assign from a card, update in Routes, and verify the other tab updates. |
| FL-06 | A version stale at submit and a status write that races during processing both preserve the draft and refresh route state. One route version produces one observed activity entry. Use distinct truck and route versions to verify the PATCH sends the route version. | Tab A opens a status action. Tab B reassigns. Tab A submits and sees the latest assignment, available actor, and preserved draft. |
| FL-07 | Hover and focus alone send no viewing update. Expand, switch, collapse, hide, and return report the effective view. Two peers on one truck produce one count of two. Switching or clearing one leaves the other. Null clears the truck while keeping the peer online. A blank name sends no registration. Registration sends the trimmed name and omits a dispatcher ID. Reconnect announces after registration and a delayed leave clears only the old session. | Use an observer plus two dispatcher tabs or browser windows. Open the same truck in both dispatchers and check the card names and marker count. Switch or hide one and verify the other remains. Check the online row, keyboard access to the full viewer list, and the behavior after reconnect. |
| FL-08 | Blank alerts show an inline error and send no request. REST and broadcast events with the same alert ID are applied once. Failures preserve the draft. | Send an alert to the selected truck and check feedback in both tabs. |
| FL-09 | Run the complete Vitest suite and the TypeScript/Vite build. | Verify install and startup from a clean checkout, then run the two-tab walkthrough in Chrome. |

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
