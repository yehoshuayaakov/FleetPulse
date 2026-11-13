# AI usage journal · Cursor

Companion to the Codex journal in [PROMPTS.md](PROMPTS.md). This record covers the Cursor session: reviews, design decisions, and the changes Cursor made. The user implemented the section work and the fleet-store refactor.

## Assignment and documentation review

- **Prompt:** Review the docs already in the project, and the assignment PDF if the outline was missing. Cursor read the brief against the planning docs.
- The user asked for a second pass after more documentation landed, then for remaining gaps.
- **Prompt:** “What is If-Match?” Cursor explained it as the route version the dispatcher reviewed, sent so a stale write is rejected.
- **Prompt:** “What will happen if a 409 is returned. What should we show the dispatcher?” The losing form keeps its draft, names the conflict, and offers a review of the current route before another submit.
- **Prompt:** “Would Playwright tests be helpful here?” Cursor recommended them for two-dispatcher races, and left implementation until after a browser sweep.
- The user updated the docs from that review and said implementation was starting.

## Speed fault threshold

- **Prompt:** Prefer a real-world ceiling near 250 km/h over an exact check for the mock’s 999 km/h quirk. Cursor agreed that impossible speed should be treated as a fault, and the user kept that policy.

## Structure, React Query, and schemas

- **Prompt:** “Review section 1,” then “How is our file structure set up here?”
- **Prompt:** “Should we be using React Query here?” Cursor recommended keeping the small HTTP client. The assignment’s transports are one snapshot, one EventSource, and one WebSocket, and the retry and cancellation rules were already explicit.
- The user reshaped the API files. Cursor flagged schemas imported across sibling feature folders. The user asked for a shared location and an explicit name, because each API folder still has its own schemas. That became `src/sharedSchemas`.
- **Prompt:** “Review section 3.”

## Fuel zero

- The user asked whether a four-second span was a sound way to judge a fuel drop to zero.
- **Prompt:** A rapid drop should show something until the reading stays at zero or recovers. Then: build for a real tank, and three consecutive readings are more definitive than the server quirk. Cursor was asked to review and report, without editing code.
- **Prompt:** “Give me now a full plan of action” for the logic and the display.
- **Prompt:** The drop is a known bug and a tank cannot fall to zero instantly, so the UI does not need to announce it. The user implemented that. Cursor later reviewed the change.
- The assignment tips say to handle anomalies thoughtfully. The user left the silent confirmation in place, with the decision recorded, and marked a possible revisit if time remained.

## Routes planning and section reviews

- The user set the features-folder layout as the project standard and asked whether constants were worth extracting. Cursor found none that needed a shared file yet.
- **Prompt:** “We are going to add React Router for navigation.” Cursor listed the pending decisions around that change.
- **Prompt:** “Review section 6,” then whether the tests covered the main concerns. The user asked for a finishing note: sweep every flow and critical handler with tests that check real behavior.
- **Prompt:** “Review section 7,” then “Is the implementation done well?”
- The user paused in the middle of section 8 and continued the next morning.

## Sections 8 and 9, gaps, and a Playwright plan

- **Prompt:** Watch sections 8 and 9 for about twenty minutes, review the implementation, and stop early if the work finished.
- **Prompt:** When that review is done, list open issues, optimizations, extra features, and gaps. Also plan Playwright for the regular flows, without implementing it yet.

## Presence, status colors, and product questions

- **Prompt:** “Do we really need the join as dispatcher piece?” Registration is the action that gives the session a name and an id. The socket starts after that.
- The user tried a stronger color scheme for truck status and asked for a review, a clearer palette, more separation between active and idle, and smaller markers. They then set the extra coloring aside because it was making the grid harder to read.
- **Prompt:** Explain **Send alert**. What it does, whether a response is expected, and whether messages accumulate on the card forever. The sender gets a toast when the mock accepts the write. Other dispatchers with that truck open see a bounded recent list.
- **Prompt:** Trucks can be active with no route, and a route could not be applied from an active truck’s card. The user wanted assignment from either place: pick a truck and assign a route, or open Routes and assign a truck. Maintenance and an existing route stay unavailable.
- The card’s assignment line needed a status, not plain text. A route is a destination and a status, and the simulation does not draw that destination on the grid. The route truck selector shows each truck’s status and disables trucks that cannot take the route.
- **Prompt:** “What does start route do?” It moves an assigned route to in progress. It does not create the assignment.
- The user saw that someone was looking at Truck Bravo without a name, and asked what the eye means. Viewing is the expanded card in a visible Fleet tab.
- **Prompt:** A refresh seemed to drop the last viewer, and the old session looked stuck on the dispatcher list. A reload closes that socket. The mock removes the dispatcher immediately, or after about ten seconds. The reloaded tab shows the join form again. **Refresh snapshot** does not drop dispatchers.
- Two form nits: in the assign-route dialog, the status tag sits beside the selected truck, and action buttons are spaced apart so a confirm is not next to a dismiss.

## Sweep, file move, and the Cursor review

- The user ran a browser sweep and asked Cursor to review the write-up when it landed in the docs, then add Playwright if it would catch those failures. Cursor added the browser checks after that review.
- The user reorganized files again and asked whether the sweep bugs would be fixed in the same pass.
- A TypeScript lint on `peers.map` was reported. Cursor could not reproduce it.
- **Prompt:** The fleet telemetry utils still imported the truck type from the fleet API schemas. The user preferred `sharedSchemas` over `globalSchemas`. Cursor checked for other cross-sibling schema and component imports.
- **Prompt:** Fix docs that were out of date, and run a thorough code review. Write the report to `docs/cursor-review-<timestamp>`. The report is [cursor-review-2026-11-12-1209.md](docs/cursor-review-2026-11-12-1209.md).

## Response typing

- **Prompt:** “What is the data model of the route entity? Do we have all entities typed?” Then whether mock responses are typed, and whether typing them is the right practice.
- Cursor found the folder was still named for the earlier global-schemas idea in places, and recommended one shared schema module with Zod at each response boundary. **Prompt:** “Ok let’s go for it.”

## What the assignment was testing

- **Prompt:** How far the work covers event-driven architecture, a circuit breaker, race conditions, a plugin architecture, performance and observability, and unit and integration tests.
- The user asked what “competing reassignments while the source stays active” meant. It is two live reassignments of a route that is still active, as opposed to cancel-then-reassign.
- **Prompt:** “What is plugin architecture? Is it part of the requirement?” It is not a requirement of this assignment.
- **Prompt:** How the lost-connection anomaly is handled, and how a burst of data on reconnect is handled. The stream keeps the last accepted readings, treats a closed EventSource as unavailable, and does not replay history.
- **Prompt:** “What is our test gap now?”
- **Prompt:** Development reset is a local tool, not a product flow, so it should not be a product test. Cursor removed that case from the Playwright file.
- **Prompt:** “So can we add these tests?” Cursor added a stale start after the other dispatcher reassigns, and the later of two reassignments of a still-active route. Both run against the isolated mock.
- **Prompt:** “When we run the tests in Playwright it will create data in the server?” The suite writes only to the throwaway mock on port 3100, proxied through Vite on 4173. The app on ports 3000 and 5173 is left alone. `beforeEach` resets only that test mock.
- **Prompt:** “Do any docs need to be updated?” then “I mean in general.” The spec, plan, and README already matched the app. A few older lines still describe the earlier suite. Those were left as history.

## SSE, WebSocket, and filtering

- **Prompt:** Plan filtering, and observability if it fits, but first review clean SSE and WebSocket handling: event typing, lifecycle, reconnection, and cleanup. Cursor’s verdict was that this is met. Dropped messages and reconnects are not counted. That count was left as a later observability panel. Filtering is a view, not a transport concern.
- **Prompt:** `GET /api/fleet` has no filter, so filtering is on the client, for status, fuel, region, and route assignment.
- The user asked where the selection lives, what the control should look like, and what a route filter means when one route belongs to one truck. A particular route was rejected. The assignment filter is Unassigned, Assigned, or In progress.
- Selection stays in Fleet screen state. It is a segmented control, not a dialog and not a text search. Several values can be chosen in one group. React Aria `ToggleButtonGroup` with `selectionMode="multiple"` is the control. Empty means that group is not applied. Groups combine.
- **Prompt:** “Don’t commit, just implement and I’ll see if it looks good and works.” Cursor added the filter and checked it in the browser.
- **Prompt:** “I don’t love the display.” The tall form became a compact segmented toolbar.
- **Prompt:** Wrap it in a thin container and mark it as a filter section. The result matches the Online dispatchers bar: a **Filter trucks** heading, **Clear filters** on that row while a choice is selected, and the segments on the canvas color inside the bar.

## Shared fleet state

- The user rejected live fleet data as React state on the app shell, especially if the dashboard is meant to grow, and asked for a store plan.
- Codex had added section 10 of the implementation plan with Zustand. **Prompt:** “How does this compare?” The migration is the same. The library is the difference.
- **Prompt:** “So bottom line,” then “With or without Zustand?” Without Zustand. One store module, `useSyncExternalStore`, and a catalog reference that stays stable across speed, GPS, and freshness. The filter stays on the Fleet screen. Per-card subscriptions wait until a profile says the full Fleet view is the cost.
- The user implemented the refactor. **Prompt:** “Review the refactor.” It matches that plan. The catalog reference stays stable for GPS, speed, and freshness. Status and route eligibility still update. Manual reconnect breaks fuel streaks immediately, which matches a disconnect clearing the pending zero count.

## Conflict resolution and refresh

- **Prompt:** “When two dispatchers clash, what does each one see?” The winner’s dialog closes and one success toast appears. The other session gets the socket event and no toast. The loser’s dialog stays on the reviewed draft.
- **Prompt:** “So the loser sees the new updated state? How do we display that?” After the rejected save, an error toast, an alert that the route changed, and a **Latest route** box. **Review latest route** copies that version into the review. Closing leaves the winner’s change.
- **Prompt:** Show the flow, and confirm the loser gets the error toast, a message that the edited state changed, the new state, and a way to accept it or continue from it.
- **Prompt:** “When refreshing, the dispatchers are dropped. Is that expected?” A page reload drops the session. **Refresh snapshot** does not. After rejoining, dispatchers who are already online stay hidden until a later join, leave, or viewing event, because the mock sends no roster.
- **Prompt:** In the two-window Start-versus-Reassign walkthrough, session 2’s update is already visible in session 1, and the error still happens on submit. The route list updates from the socket immediately. The open Start dialog keeps the truck and version from when it opened, and Start does not notice the newer version until the server rejects the old `If-Match`. The review box appears after that rejection. The dialog does not yet switch into review when the live update arrives.
