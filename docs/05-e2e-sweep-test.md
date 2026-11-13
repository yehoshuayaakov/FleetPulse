# E2E Sweep Test

Run on 2026-11-12 against the FleetPulse working tree, including local changes on top of `336a2e1`.

The tested route and fleet workflows passed, including double assignment protection and status conflict recovery. Two product defects were reproduced. A delayed reassignment after cancellation can block an otherwise available truck. A development reset leaves stale routes in open tabs until reload.

## Follow-up verification

- All three Chrome E2E tests passed on the updated working tree. The two defect checks now pass normally.
- The delayed PUT was rejected after cancellation, and the target truck accepted a new route. Both open tabs cleared stale routes after a development reset.
- The new screen navigation test passed. Returning to Fleet through the link or browser Back started at the top, kept the selected truck visible in its list, and preserved the dispatcher session.

## Test setup

- Ran Chrome through Playwright with two independent dispatcher sessions, Alice and Bob. Used a third session to observe both dispatchers viewing the same truck and to check the 390 px layout. The browser control tool could not verify the URL of the existing Chrome window, so the sweep used fresh Chrome sessions.
- Each test pass used a fresh copy of the in-memory mock behind its own Vite instance. The runner changed only the bind address and port of the temporary mock process. The server source and the user's existing local route were preserved.
- Used real mock responses for route writes, WebSocket broadcasts, and live GPS. Controlled request arrival for races. Injected network and telemetry failures in Chrome for reproducible recovery checks.
- Ran `npm test`. All 77 tests passed across 14 files. Ran `npm run build`. TypeScript and Vite passed. See [build observations](#coverage-and-concerns) for the warnings.

## Browser results

| Area | Scenario | Observed result |
| --- | --- | --- |
| Fleet and navigation | Start with zero routes. Open Fleet, select a marker with the keyboard, and switch to Routes. | All three sessions showed 12 trucks. The observer saw Truck Alpha's marker move on the real GPS stream. Keyboard focus opened the tooltip without selecting the truck. Enter selected the marker and opened the matching card and speed gauge. The Fleet view had no horizontal overflow at 390 px. |
| Presence | Register Alice with surrounding spaces and register Bob. Open Truck Alpha in both sessions, then switch Bob to Truck Bravo. | Alice appeared under her trimmed name. The observer saw both names on the Alpha card and two viewers on its marker. After the switch, Alpha showed Alice and Bravo showed Bob. |
| Fleet card assignment | Open Truck Delta's details and choose Assign route. Submit with a blank destination, then submit with high priority and notes. | Opening Delta's details revealed Assign route. The form preselected Delta. Blank input showed an inline error and sent zero writes. The valid POST returned `201` at route version 1. The other session saw the destination, priority, and notes. |
| Routes picker and keyboard | Open New route from Routes and inspect the truck options. Use Enter to open a modal and Escape to dismiss it. | The picker showed maintenance and occupied trucks as disabled. Eligible trucks could be assigned from Routes. Keyboard opening and dismissal worked. |
| Reassignment validation | Submit Reassign route without a target, then choose an available truck and confirm. | The form asked for a target. The valid PUT returned `200` and advanced the route to version 2. |
| Double assignment | Hold both create requests for Truck Echo, then let both reach the mock. | One `201` and one `409`. The losing form showed the winning destination, preserved the destination and notes in its own draft, and succeeded after choosing Truck Bravo. |
| Stale status review | Alice opens Start route. Bob reassigns before Alice submits. | Alice's `If-Match: 1` returned `409`. The dialog showed Bob and the new truck. After explicit review, `If-Match: 2` succeeded. |
| Status change during reassignment | Let Alice's status PATCH reach the mock. Release Bob's pending reassignment PUT during the server's processing delay. | PUT returned `200`. PATCH returned `409` with the message `Route was modified during processing`. The dialog named Bob, blocked retry until review, and accepted the reviewed version. |
| Target becomes occupied | Hold Alice's reassignment to Truck Foxtrot. Let Bob create a route for Foxtrot first, then release Alice's PUT. | PUT returned `409`. The dialog named Bob and the competing destination. Alice's original assignment stayed on its original truck. |
| Completion and cancellation | Complete an in-progress route. In a separate test, cancel an in-progress route. | Completion appeared in the peer session and freed its truck. Cancellation returned `200`, then exposed the delayed reassignment defect below. |
| Lost route response | Let the real mock accept a route POST, then drop its response to the sender. | The peer saw the saved route. The sender saw an unconfirmed outcome, retained its draft, and made one POST. |
| Alert validation and delivery | Submit whitespace. Enter a draft, close and reopen the form, select Warning, and send. | Whitespace kept focus on the message field and sent zero writes. The draft survived closing and reopening. The valid request returned `201` with Warning severity, cleared the sender's input, and appeared once in each session. Only the sender received a success toast. |
| Alert rejection and response loss | Return `400` for one alert. Let the real mock accept another alert, then drop the response. | Rejection and unconfirmed delivery showed different messages and both retained the draft. The peer still received the accepted alert. The request count showed no automatic replay. |
| Fleet reads | Return `503` with `Retry-After: 1` on a manual refresh, then succeed. Return `500` on a later refresh. | The `503` produced one retry after about a second. The `500` showed a refresh error and kept all 12 markers. Manual retry restored the snapshot. |
| Mileage read | Return `500` for Truck Alpha's detail request, then let the retry reach the real mock. | The error appeared inside Alpha's card. **Retry mileage** replaced it with the truck's mileage. |
| GPS and malformed telemetry | Inject malformed SSE, an older GPS batch containing an invalid timestamp, and an out-of-order live sample. | The bad payload and invalid point were ignored. The older batch and live sample did not rewind the marker. The live sample still updated valid sensor values. |
| Speed and fuel | Send `999` after a valid `48 km/h`. Follow it with a valid speed. Send three consecutive zero fuel readings. | The card held `48 km/h` and showed a speed fault, then displayed `46 km/h` and cleared the fault on the next valid speed. Fuel stayed at 54% for the first two zero readings and showed 0% on the third. |
| Telemetry connection and staleness | Drop and reopen the controlled SSE connection. Stop Alpha's live samples, continue Bravo's, then send Alpha a newer GPS batch and a live reading. | The UI showed **Reconnecting to telemetry…** and returned to **Telemetry connected**. Alpha showed **Signal stale** and **Last known readings** while Bravo stayed fresh. The batch advanced Alpha's marker while it stayed stale. The live reading cleared staleness and displayed `44 km/h` and 53% fuel. |
| Route reads and reconnect | Return `503` on the initial route read. Later, drop the dispatcher's socket and return `503` on its first refresh after reconnect. | The initial failure showed **Could not load routes**. Successful retry showed **No routes assigned yet** on the fresh mock. Later, the failed reconnect refresh kept the cached route visible and paused writes. A successful retry re-enabled New route. |
| Dashboard recovery | Inject a render error, then remove the injection and activate Reload dashboard with the keyboard. | The error boundary showed its recovery screen, and reload restored the live fleet. The main browser pass recorded zero uncaught page errors in the two dispatchers and the observer. |

## Reproduced defects

Both defects were open at the end of this sweep. They were fixed afterward. A late reassignment now returns `409` and leaves the target free. An open tab handles `fleet_reset` by replacing its route list, clearing peer presence and alerts, and reloading the fleet snapshot. `npm run test:e2e` checks both outcomes. The steps below are the original reproduction.

### High · A late reassignment can block a truck after cancellation

1. Start a route and open its details in both sessions.
2. Have Bob submit Reassign route to an available truck. Hold the PUT before it reaches the mock.
3. Have Alice cancel the source route and wait for the PATCH to return `200`.
4. Release Bob's PUT. It also returns `200`, and the route stays cancelled while its truck changes.
5. Open New route and select the target truck. The picker offers it, but creating an assignment returns `409` and points to the cancelled route.

The target truck was Truck Delta. Its detail response showed it as active with `currentRouteId` pointing to the cancelled route. The route details hid further actions for that terminal route. A new assignment to Delta returned `409`, and the form named the cancelled destination as the conflict. The expected result is for the late PUT to fail and leave Delta available.

At the time of the sweep, the reassignment handler checked target availability and accepted a terminal source route without checking its reviewed version. The client derived availability from active routes, so it offered the stranded truck. The fix rejects reassignment of terminal routes and requires the reviewed source version on PUT. [Reassignment handler](../server.js#L343)

### Medium · Development reset leaves stale routes in open tabs

1. Create a route and confirm it appears in both sessions.
2. Send `POST /api/reset` to the isolated mock and confirm that `GET /api/routes` returns an empty list.
3. Reload one tab. It shows **No routes assigned yet**. The other tab still shows the pre-reset route until reload.

The expected result is for open tabs to reconcile with the reset state. The mock emits `fleet_reset`. At the time of the sweep, the client handled dispatcher, route, and alert events, and its snapshot merge kept routes absent from the response. The current client replaces route state on `fleet_reset`. An ordinary snapshot still does not delete routes that are missing from a late response. [Reset handler](../server.js#L409) · [Route snapshot merge](../src/screens/routes/utils/routeState.ts#L17)

## Coverage and concerns

- **Build output.** The production build succeeded. Rollup reported two Zod annotation warnings. Vite also reported that the 539.10 kB minified entry chunk exceeded its 500 kB warning threshold. The entry was 167.70 kB gzip. This run did not measure production load time.
- **Other reassignment ordering.** The cancellation race demonstrated that, at the time of the sweep, PUT lacked a server-side check on the reviewed source version. That check is now in place. Two competing PUT requests to different free trucks while the source stays active were outside this sweep.
- **State after reset.** The mock restarts route IDs at `route_1` and starts versions at 1. An open client keeps its previous routes and prefers a higher or equal version for the same ID. The stale row was reproduced. Reusing an ID in a still-open tab after reset was identified from the code and was outside this browser run. [Reset handler](../server.js#L409) · [Route snapshot merge](../src/screens/routes/utils/routeState.ts#L17)
- **Mock data and presence.** Routes are held in memory. Presence is learned from live messages, and a peer may initially show a short ID. Route activity is scoped to changes observed by the session. Alert success covers acceptance by the mock. Driver acknowledgement is unavailable. [Known limitations](../README.md#known-limitations-and-follow-up)
- **Scope.** The browser run covered Chrome at desktop width and a 390 px mobile viewport. The 77-test suite adds lower-level coverage for scenarios such as duplicate events, retry exhaustion, and delayed presence messages. Cross-browser behavior, load testing, and production deployment were outside this sweep. [Test map](04-test-map.md)

## Test runner retries

- An early race run used an outdated accessible name for a disabled truck option and timed out. Matching the current name let the rerun verify the disabled maintenance and occupied choices.
- An early reverse-race attempt clicked an already selected route row, which deselected it. The rerun kept the row selected and reached the delayed reassignment defect.
- The first retry timing check counted near-simultaneous startup requests and did not isolate the retry. The final check began with Fleet already loaded, then timed one manual refresh and its retry.

## Standing checks

`npm run test:e2e` checks dispatcher route races in Playwright. It starts its own mock and Vite on ports 3100 and 4173, so it does not reset the app on ports 3000 and 5173. A reassignment released after cancellation is rejected. A start submitted after the other dispatcher reassigns is rejected and the route stays on the new truck. The later of two reassignments of an active route is rejected and its target stays available. `npm test` stays Vitest.
