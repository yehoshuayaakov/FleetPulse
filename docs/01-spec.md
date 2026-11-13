# FleetPulse specification

## Goal

Give dispatchers a trustworthy view of 12 delivery trucks and a shared way to manage assignments when several people are working at once. The assignment brief defines the required behavior. Its suggested time estimate is outside this project plan.

## Scope

Fleet shows a Tel Aviv coordinate grid and selectable truck cards. Routes shows assignments, status, and activity. Both views use the same route state and assignment form. The supplied mock is the system of record. Dispatcher registration supplies a session ID for the demo. Production identity, persistence, and authorization are outside the assignment scope.

## Frontend conventions

- Build interactive controls and gauges with React Aria Components. Use semantic HTML for layout and content, with Tailwind classes and shared theme tokens across both views.
- Reusable UI lives in `src/components/`. Features own their UI, validation schemas, and domain logic. Dedicated REST and real-time modules own server calls.
- Promote contracts genuinely shared by sibling areas to the nearest common layer and have both areas import from there. App-wide shared schemas live in `src/sharedSchemas/`. Resource payloads and feature-specific form schemas stay with their owners.
- Validate forms with Zod on submit and show errors alongside the relevant RAC fields. Keep entered values through validation, network errors, and assignment conflicts. An invalid submission sends no request.

## Requirements and acceptance criteria

| ID | Requirement | Acceptance |
| --- | --- | --- |
| FL-01 | Fleet snapshot and selection | All 12 trucks have one marker and one card. Active, idle, and maintenance are labeled. Selecting either representation selects the same truck. |
| FL-02 | Ordered live GPS and connection state | SSE updates the grid. Duplicate and older fixes never replace newer positions. A delayed batch does not refresh live signal freshness. A disconnected stream and an individually stale truck are visible. Both recover on fresh data. |
| FL-03 | Trustworthy vehicle health | A faulty speed reading keeps the last valid speed visibly flagged, or shows unavailable. The first two consecutive normal zeros silently retain the last non-zero fuel value. The third displays 0%. Every card shows the latest accepted speed, fuel, and temperature. The expanded card adds gauges and mileage from the detail endpoint. |
| FL-04 | Snapshot resilience | A transient fleet `503` retries after the server's `Retry-After` delay within a bounded attempt budget. Existing fleet data stays visible during retry. Initial failure has a retry action. |
| FL-05 | Shared assignments | Dispatchers can create a route from either view, start, complete, cancel, or reassign it. Unavailable trucks are excluded from the picker. Assigned routes can start, cancel, or reassign. In-progress routes can complete, cancel, or reassign. Terminal routes offer no actions. Destructive changes require confirmation. Both tabs update, and terminal routes release their trucks. |
| FL-06 | Conflict recovery and audit | A stale or racing status edit surfaces the current route and actor when identifiable. The user retains the draft and reviews before retrying. The activity view shows available snapshot metadata and observed changes once each. |
| FL-07 | Dispatcher presence | Fleet lists known online sessions and identifies other viewers on the card and marker. Several viewers can share one truck. Closing details, switching away, and reconnecting update the reported view. A delayed leave clears only the departing session. |
| FL-08 | Truck alerts | The selected truck's alert form validates the message, names the target, and shows pending, success, or failure. The form offers Info, Warning, and Critical severity. One alert appears once when the REST response and WebSocket broadcast both arrive. |
| FL-09 | Submission | A local Git repository includes the mock server, setup and architecture notes in `README.md`, and an AI journal in `PROMPTS.md`. `npm install && npm start` starts the app and mock. `npm test` passes with at least eight meaningful behavior tests. |

## Fleet layout

- Use a fixed Tel Aviv window centered at `32.0853, 34.7818`, extending 0.05° in each direction. Latitude spans `32.0353–32.1353` and longitude spans `34.7318–34.8318`. North is up and east is right. Keep the scale fixed as trucks move. Clamp a valid out-of-window fix to the nearest edge for display and retain its original coordinates.
- Make the coordinate grid the main panel, with a narrower column of truck cards alongside it. On narrow screens, stack the grid above the cards. Put **Online dispatchers** directly above the grid and show the truck each known dispatcher has open when available.
- Keep a card visible for every truck. The collapsed card shows the name, operational status, speed, fuel, and engine temperature, with signal, sensor, and viewer labels as applicable. Show the latest accepted values. Leave the card's route destination blank until the route list has loaded. Then show the destination with its route status chip, or an **Unassigned** chip if the list confirms there is no route. Use **Show details** and **Hide details** to open and close the card. An unassigned truck that is not in maintenance shows a short assignment hint while collapsed and the RAC **Assign route** button when expanded. **New route** on Routes uses the same form. Its truck selector lists every truck with its operational status and disables maintenance trucks and trucks that already have a route. Expanding the card adds gauges, mileage, assigned route priority and notes, and alert actions.
- Keep marker and card selection synchronized. Color the marker and the numbered card badge by operational status: solid green when active, light gray with a dark border when idle, and amber in maintenance. The number identifies the truck. Show the status in the tooltip and card. The grid communicates location and offers a marker tooltip. The cards expose telemetry at a glance without requiring each truck to be opened.

## Telemetry recovery

- Track signal freshness separately from operational status and speed sensor health. Start an eight-second clock for each truck when SSE first opens. Only receipt of a valid normal reading for that truck refreshes it, even if the position timestamp is out of order. REST snapshots, GPS batches, connected messages, and heartbeats leave the clock unchanged. At eight seconds without a normal reading, dim the truck marker at its last accepted position. Show **Signal stale** and the age of that position. Label telemetry values as **Last known** while stale.
- A delayed GPS batch can move the marker to a newer accepted position and reduce the displayed position age. The signal remains stale until a fresh normal reading arrives. Apply valid speed, fuel, and temperature in normal-reading receipt order. Advance the marker only when its position timestamp is newer.
- When the telemetry stream drops, show **Reconnecting to telemetry** and let the existing EventSource reconnect. Reopening the stream clears the connection banner. A valid normal reading recovers signal state for that truck.
- Treat a normal speed above `250 km/h` as a speed-only fault. This covers the mock's `999 km/h` value. A usable speed is a finite number from `0` to `250 km/h`, inclusive. Hold the last valid speed, show its age with **Speed sensor fault**, or show **Speed unavailable** when no valid sample exists. Repeated faults keep the original valid speed timestamp. GPS, fuel, and temperature still update under their own rules. The next received valid normal speed clears the fault, even if its position timestamp is out of order. A historical batch leaves the fault unchanged.

- Keep the last non-zero fuel value silently for the first two consecutive normal zeros. Show **Unavailable** if there is no prior value. The third normal zero displays `0%`. A valid non-zero reading updates the display immediately. An invalid or missing fuel field in a valid normal reading shows **Invalid fuel reading** and clears the pending count. Disconnects and gaps of eight seconds or more clear pending counts while retaining accepted values, including confirmed zero. GPS batches and zero-valued REST snapshots leave the pending count unchanged. A positive REST snapshot clears the pending count and fills missing fuel without replacing an accepted value.

## Interaction and failure states

- Fleet and Routes have distinct loading, empty, error, and ready states. Connection and sensor faults appear alongside the last available data.
- Map markers and cards support keyboard selection. Status and alerts include text, with color as a secondary cue. On narrow screens, the grid and cards stack and route rows remain readable.
- Forms show validation and pending states, retain input on recoverable errors, and prevent duplicate submissions. A dispatcher must be registered before a write can be sent.
- Cached fleet data, if present, is held for the current session. A reload starts from server snapshots and establishes new connections.

## Error handling and write feedback

| Situation | What the dispatcher sees | Recovery |
| --- | --- | --- |
| Fleet, routes, or mileage fetch fails | A scoped error with **Retry**. Keep the last successful data where available and mark it as stale. A mileage failure stays inside the selected card. A failed load stays distinct from an empty result. | Apply the bounded automatic retry policy to fleet `503` responses. Let the dispatcher retry other failed reads. Requests cancelled during selection changes or teardown produce no error message. |
| Form validation or write rejection | Validation errors appear at the relevant fields. A rejected write shows an error toast and persistent feedback at the action or form. A `409` includes the latest route or assignment when available. | Keep the draft. Refresh conflicting route state, then allow a reviewed retry. |
| Write outcome cannot be confirmed | Show a toast and persistent message such as **Could not confirm whether the route was saved**. | Preserve the draft. Refresh authoritative route data when possible before allowing another attempt. Never automatically replay the write. |
| Unexpected data or sensor fault | Keep the last accepted values and mark affected data as faulty or unavailable. The speed and fuel quirks have their own recovery rules. | Reject malformed payloads or affected readings at the boundary. Continue with independently valid readings and let fresh data recover the affected state. |
| SSE or WebSocket cannot connect or drops | Show separate connection states and retain last-known data. Mark live telemetry stale as readings age. During WebSocket reconnect, mark presence unavailable and route updates paused. | Use automatic SSE reconnect. Reconnect WebSocket with capped backoff, register again, and refresh routes. Provide a reconnect action if a transport has stopped retrying. |
| Dashboard render failure | Show a fallback page with a keyboard-accessible **Reload dashboard** button. | Reload and establish a new dashboard session. |
| Confirmed write success | Show a success toast in the initiating tab for route creation, status changes, reassignment, cancellation, and truck alerts. | Apply the server result and deduplicate broadcasts. A REST response and its matching WebSocket event yield one toast. |

Toasts are dismissible and supplement persistent feedback. Invalid client-side submissions, peer changes, retries, reconnects, and sensor events use their own inline, banner, or card feedback.

## Viewing presence in Fleet

Place an **Online dispatchers** row above the Fleet grid. Give each session its own tag with the dispatcher name and the truck they have open, when available. Mark the local session as **You**. Viewing events carry the display name from registration, so a late joiner can name peers it discovers. Use a short session ID as a fallback for a viewing event without a name. If names match, use session IDs to distinguish them.

Registration requires a trimmed, nonblank display name. Send the name and let the mock mint a fresh dispatcher ID for each connection. A dispatcher is viewing a truck while its detail card is expanded in their visible Fleet view. Activating either the marker or card opens it. Tooltip hover and focus leave viewing state unchanged. Viewing reports the open detail panel and does not reserve the truck or lock its route.

| Action | Reported truck |
| --- | --- |
| Expand a truck in the visible Fleet view | That truck's ID |
| Switch to a different truck | The new truck's ID |
| Collapse details, switch away from Fleet, or hide the tab | `null` when the socket can send |
| Return to the Fleet view or show the tab again | The expanded truck's ID, if its details are still open |
| Disconnect | Remove that session and its viewing state when the server's leave event arrives |

Show other viewers on each card as **Viewed by Alice** or **Viewed by Alice and Bob**. For larger groups, show two names and a **+N** control that reveals the full list with pointer and keyboard access. Show the same viewer count next to an eye icon on the grid marker and include it in the accessible label. A truck without other viewers has no viewing badge. Moving one viewer to another truck leaves all remaining viewers in place.

## Mock contract limits

- The server checks the truck's current assignment when creating a route. Two attempts to assign the same truck produce one success and one `409`. The mock can also start with active trucks that have no route. A new route starts at `_version: 1`. A successful status edit or reassignment increments its version. A status PATCH checks the route version supplied in `If-Match` twice, including after a processing delay. The truck version from the fleet payload is a separate counter updated by truck simulation. Reassignment requires the reviewed route version in `If-Match`, rejects a completed or cancelled source route, and checks that the target truck is available.
- Route audit history is limited to available route metadata and events observed in the current session. Presence discovers existing sessions through their named viewing announcements when a dispatcher joins.
- The mock accepts and broadcasts alerts. Recent alerts contain up to 20 per truck seen by the current dashboard. The mock exposes no alert history or driver acknowledgement flow.
- Normal telemetry ticks include every truck. Batch fixes are at least two seconds older than the same tick's normal timestamp, so an advancing batch on a stale truck is best demonstrated in a fixture. Read only mileage from the selected truck detail response. Its location and sensors leave live values unchanged.
- Circuit breaking after three consecutive fleet failures, an observability panel, geofencing, side-by-side conflict resolution, keyboard shortcuts, and filtering are optional extensions. The required retry and conflict flows ship first.
