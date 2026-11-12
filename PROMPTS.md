# AI usage journal

## Assignment review and planning

- Asked Codex to summarize the assignment, identify components, and propose an implementation order.
- Drafted a separate plan with two views, one shared assignment form, and a two-dispatcher verification scenario. Asked Codex to review it.
- Reviewed the mock contract and incorporated separate live and position timestamps, early fleet retry, and fresh dispatcher IDs after reconnect. Kept server-side limits visible in the spec, including incomplete presence discovery, session-only observed audit history, and unversioned reassignment.
- Asked Codex to follow the planning structure used in other projects and set up React and the mock. Removed time estimates from the working plan.

## Project foundation

- Codex created the numbered planning docs and scaffolded React, TypeScript, Vite, and Vitest. Vite proxies the API and WebSocket, and `npm start` runs the mock and frontend together.
- The only server source found was the PDF code listing. Codex restored line wraps and operator glyphs and checked the resulting JavaScript before starting it.
- Verified dependency installation, the TypeScript and Vite build, and a local startup check for the React entry, the 12-truck REST snapshot, SSE telemetry, and WebSocket registration. The feature tests in the test map are planned work.

## UI and API conventions

- The user chose React Aria Components, Tailwind, a shared neutral and blue theme, Zod submit validation, reusable UI folders, and dedicated server-call modules.
- Codex mapped these decisions to the commit sequence and updated the scaffold with the theme and HTTP client. The shared request tests check conflict details, the retry header, and cancellation.

## Viewing presence

- The user defined viewing as an expanded truck card in a visible Fleet view. Codex added the online row, per-truck names and counts, multiple-viewer rules, and test cases to the planning docs.
- Verified the mock relays two distinct dispatcher IDs viewing the same truck, a truck change, and a null clear through a third WebSocket session.

## Section-by-section build

- The user asked to organize the work around sections with clear requirements. Codex replaced the commit list with an ordered section plan, mapped each section to the specification, and added observable checks for completion.

## Fleet layout and telemetry recovery

- The user confirmed a grid with dispatchers above it and a column of truck cards with telemetry visible. Codex recorded the layout, stale and reconnect behavior, the speed-only fault policy for 999 km/h, and deterministic fixtures for recovery.

## Fleet route assignment

- The user asked to show the assigned route on each truck card and add a quick action for trucks that are not active. The planning docs define the card action for idle, unassigned trucks and use the mock's existing route versions for status edits.
- A local mock check confirmed one successful create and one 409 for simultaneous assignment to the same truck. It also confirmed the route advances from version 1 to 2 and a stale If-Match receives 409.

## Failure states and write toasts

- The user asked for explicit handling of failed reads, failed writes, suspicious data, and live connection failures, plus toasts for write outcomes. Codex added scoped recovery, ambiguous-write handling, one toast per initiating write, and verification cases to the plan.

## Documentation review

- The user pinned down the fixed grid, receipt-based telemetry, fuel confirmation, mileage-only reads, dispatcher registration, route versions, and assignment visibility. Codex reconciled the spec, section plan, and test map and added a decision log.

## Section 1 · Fleet snapshot and selection

- Codex implemented the Zod-validated fleet client, cancellable retry policy, fixed-grid projection, and RAC marker and card controls. Verified unit cases with Vitest and the real snapshot, selection, layout, and failure states in headless Chrome.

## Section 2 · Live GPS

- Codex connected the Fleet view to EventSource, added validated position decoding and timestamp reconciliation, and verified the real stream and controlled reconnect and ordering scenarios in Chrome.

## API organization

- The user asked to separate API queries and schemas by resource and evaluate TanStack Query. Codex split Fleet into query and schema files, updated imports and planning references, and verified the build and tests.

## Section 3 · Freshness and sensor faults

- Codex added receipt-based freshness, live card values, and field-level speed and fuel handling. Verified real mock sensor updates and deterministic stale, fault, and recovery cases in Vitest and Chrome.

## Section 4 · Vehicle detail

- Codex added accessible RAC meters using the accepted live telemetry and a scoped, cancellable mileage read. Verified live gauge updates, mileage failure and retry, and rapid selection with a deliberately late response.

## Fuel zero confirmation follow-up

- The user chose silent handling for the first two normal zeros and confirmation on the third. Codex changed the health state, card and gauge presentation, and documented behavior, then verified a deterministic sequence and a naturally occurring mock glitch.

## Section 5 · Dispatcher presence

- Codex added app-level WebSocket registration, reconnect, and per-session viewing. Verified the required name, viewer counts and overflow, visibility, and delayed leave behavior in Vitest and Chrome.

## Section 6 · Shared routes and assignment

- Codex added React Router, the shared version-aware route store, RAC route table and assignment form, and write toasts. Verified navigation, two-tab synchronization, a real 409, a dropped write response, and route refresh after reconnect.

## Section 7 · Route actions and conflict recovery

- Codex added route action availability, review dialogs, versioned PATCH requests, reassignment, and conflict recovery. Verified both mock status conflict paths, target occupancy, and releasing trucks in Chrome.

## Section 8 · Truck alerts and failure states

- Codex added the RAC alert form, shared alert validation, bounded recent alerts, and a dashboard render fallback. The Chrome check dropped a response after the mock accepted the write to verify draft retention and guard against automatic replay.

## Section 9 · Submission review

- Codex compared the finished flows with the assignment brief and test map. The sweep added tests for route reads and malformed route broadcasts, exposed priority and notes in expanded truck cards, and verified that the alert form can load on demand.
