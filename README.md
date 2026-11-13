# FleetPulse

React and TypeScript dashboard for the FleetPulse fleet-management assignment. The Fleet view starts with a REST snapshot and updates truck positions from SSE. The grid and expanded cards use the latest accepted position. Normal telemetry updates the truck cards and identifies stale signals and sensor faults. The cards retain last-known readings during a signal gap or a sensor fault. Expand a truck for live speed, fuel, and temperature gauges and the mileage from its detail endpoint. Use **Refresh snapshot** to reload the REST data or **Retry** if a request fails.

## Start locally

Use Node.js 22.12 or newer.

```sh
npm install
npm start
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The mock listens on port 3000. Vite proxies `/api` and `/ws` so the browser can use the frontend origin for all three transports. Use `npm run build` to type-check and build the frontend. `npm test` runs Vitest. `npm run test:e2e` runs the Playwright checks for navigation, live fleet state, dispatcher presence, and route races on a separate mock, so it can run while the local app is open.

## Dispatcher presence

Enter a display name in **Online dispatchers**. To check collaboration, register a second dispatcher in another visible window. Expand the same truck in both windows to see the other viewer on the card and marker. Collapse the card or hide the tab to clear its viewing state. A newly joined dispatcher learns existing sessions' names when those sessions announce their current view.

## Truck alerts

Join as a dispatcher, expand a truck, and choose **Send alert**. Enter a message and choose **Info**, **Warning**, or **Critical**. The sender gets a toast when the mock accepts the alert. Dispatchers with that truck open see it once under **Recent alerts**. If a send is unconfirmed, the draft stays in the form so you can check the recent list before trying again.

## Route assignment

The mock starts with an empty route list and keeps created routes in memory until restart or reset. After joining as a dispatcher, choose **Show details** on an unassigned truck card and select **Assign route**, or use **New route** on Routes. Both entry points open the same form. The truck list shows each truck's status and disables trucks in maintenance or trucks that already have a route. Register a second dispatcher to see the assignment update in both sessions. If two writes reach the same truck together, the losing form displays the existing assignment and retains its draft.

## Route conflict walkthrough

1. Register two dispatchers in separate windows and open the same assigned route on **Routes**.
2. In the first window, open **Start route** and leave the dialog open. In the second, **Reassign route** to another available truck and confirm.
3. Submit **Start route** in the first window. It displays the latest truck and the other dispatcher where identifiable. Choose **Review latest route**, then submit again to use the refreshed version.

The mock checks the reviewed route version for status updates and reassignment. Reassignment also checks that the source route is active and the target truck is available.

## Architecture and trade-offs

- **Fleet** starts with a validated REST snapshot. One EventSource feeds the fleet store in `src/fleet/`. Fleet subscribes to the full view with `useSyncExternalStore`. The app shell reads a separate truck catalog whose reference changes only when truck IDs, names, or operational statuses change. GPS positions use timestamps, while normal readings update sensor health and freshness in receipt order. GPS batches contribute only their newest eligible position per truck. Keeping these rules separate lets the dashboard preserve a position and recover signal independently.
- **Collaboration** uses one WebSocket per registered session for presence, route changes, and alerts. REST snapshots, write responses, and broadcasts share a version-aware route store. An older result cannot rewind the assignment. The route dialogs preserve the reviewed version and keep drafts through conflicts. The app refreshes routes after reconnect before enabling route writes.
- **UI** uses React Router, React Aria Components, and Tailwind. Zod validates transport data and form input at their boundaries. Fleet and Routes reuse one assignment form. The Routes screen, assignment form, and alert form load on demand.

## Known limitations and follow-up

- Presence is discovered from join and viewing messages. A departure can appear up to ten seconds late.
- The audit log combines route metadata with events observed in this session. The mock keeps data in memory. Recent alerts are also session-local and capped at 20 per truck. An alert success indicates mock acceptance. Driver acknowledgement is unavailable.
- Persistent audit and presence snapshots would make reconnection more complete. In production, track telemetry lag, rejected messages, reconnects, and conflict rates.

## Source layout

`src/app/` holds the app shell. `src/styles/theme.css` defines the Tailwind theme. Fleet and Routes live under `src/screens/` with their own components, hooks, schemas, utilities, and tests. Shared RAC UI belongs in `src/components/`. Both screens render the shared dispatcher presence component, and the app shell owns the connection across navigation. Group REST code by resource in `src/api/`, with queries, mutations, and API schemas in separate files. Use `src/realtime/` for SSE and WebSocket connections. Put shared schema primitives in `src/sharedSchemas/` so API and real-time modules can import from a common owner. The truck record and fleet snapshot live there because the fleet API and the telemetry merge both use them. Mileage stays with the fleet detail endpoint.

## Project docs

1. [Specification](docs/01-spec.md)
2. [Implementation plan](docs/02-implementation-plan.md)
3. [Decisions and changes](docs/03-decisions-and-changes.md)
4. [Test map](docs/04-test-map.md)
5. [AI usage journal](PROMPTS.md)
6. [E2E Sweep Test](docs/05-e2e-sweep-test.md)
7. [Cursor review, 12 Nov 2026](docs/cursor-review-2026-11-12-1209.md)
8. [Codex review, 12 Nov 2026](docs/codex-review-2026-11-12-1213.md)

## Mock server source

`server.js` was recovered from the code printed on pages 2–15 of the assignment PDF. PDF wrapping and extracted operator glyphs were restored. If the original standalone file becomes available, compare it against this copy.
