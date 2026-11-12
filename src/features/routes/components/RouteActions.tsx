import { useRef, useState } from 'react';
import {
  Button, Dialog, FieldError, Form, Heading, Label, ListBox, ListBoxItem,
  Modal, ModalOverlay, Popover, Select, SelectValue,
} from 'react-aria-components';
import { HttpError } from '../../../api/http';
import { changeRouteStatus, reassignRoute, RouteVersionConflict, ReassignmentConflict } from '../../../api/routes/mutations';
import { RouteStatus } from '../../../components/RouteStatus';
import { showWriteToast } from '../../../components/ui/WriteToasts';
import type { FleetRoute, RouteEvent } from '../../../globalSchemas/routeSchema';
import { reassignmentSchema } from '../schemas/routeSchemas';
import { actionsFor, latestRouteActor, routeActions, type RouteAction } from '../utils/routeActions';
import type { RouteActivity } from '../utils/routeState';

interface RouteActionsProps {
  route: FleetRoute;
  dispatcherId: string | null;
  canWrite: boolean;
  availableTrucks: readonly { id: string; name: string }[];
  activity: ReadonlyMap<number, RouteActivity> | undefined;
  truckNames: ReadonlyMap<string, string>;
  dispatcherName: (id: string) => string;
  onRefresh: () => Promise<FleetRoute[] | null>;
  onSaved: (event: RouteEvent) => void;
}

type Failure = { text: string; review: boolean };
type Draft = { action: RouteAction; route: FleetRoute };

const actionButton = 'cursor-pointer rounded-lg border border-outline px-3 py-2 text-sm font-medium outline-none hover:bg-canvas focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50';

export function RouteActions({
  route, dispatcherId, canWrite, availableTrucks, activity, truckNames, dispatcherName, onRefresh, onSaved,
}: RouteActionsProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [blockedTarget, setBlockedTarget] = useState<string | null>(null);
  const [targetError, setTargetError] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const targetControl = useRef<HTMLButtonElement>(null);

  function open(action: RouteAction) {
    setDraft({ action, route });
    setTarget(null);
    setBlockedTarget(null);
    setTargetError(null);
    setFailure(null);
  }

  const actions = actionsFor(route.status);
  const targets = availableTrucks.filter(truck => truck.id !== route.truckId);
  const truckName = (id: string) => truckNames.get(id) ?? id;
  const reviewedActionAvailable = draft && actionsFor(draft.route.status).includes(draft.action);
  const latestActor = activity?.get(route._version)?.actor ?? latestRouteActor(route);

  async function submit() {
    if (!draft || !dispatcherId || !canWrite || pending || submitting.current || failure?.review || !reviewedActionAvailable) return;
    const { action, route: reviewedRoute } = draft;
    const isReassign = action === 'reassign';
    if (isReassign && reviewedRoute._version !== route._version) {
      setFailure({ text: 'The route changed. Review the latest assignment before reassigning.', review: true });
      return;
    }
    const selection = reassignmentSchema.safeParse({ newTruckId: target ?? '' });
    if (isReassign && (!selection.success || target === blockedTarget || !targets.some(truck => truck.id === target))) {
      setTargetError(selection.success ? 'Choose an available truck.' : selection.error.issues[0].message);
      targetControl.current?.focus();
      return;
    }

    submitting.current = true;
    setPending(true);
    setFailure(null);
    setTargetError(null);
    try {
      let event: RouteEvent;
      if (action === 'reassign') {
        if (!selection.success) return;
        const updated = await reassignRoute(reviewedRoute.id, selection.data.newTruckId, dispatcherId);
        event = { type: 'route_reassigned', route: updated, reassignedBy: dispatcherId, timestamp: updated.reassignedAt ?? Date.now() };
      } else {
        const updated = await changeRouteStatus(reviewedRoute.id, routeActions[action].status, reviewedRoute._version, dispatcherId);
        event = { type: 'route_updated', route: updated, updatedBy: dispatcherId, timestamp: updated.lastModifiedAt ?? Date.now() };
      }
      onSaved(event);
      showWriteToast(routeActions[action].success, 'success');
      setDraft(null);
    } catch (error) {
      if (error instanceof RouteVersionConflict) {
        setFailure({ text: 'Another change reached this route. Review the current assignment before retrying.', review: true });
        showWriteToast('Route changed before the update could be saved', 'error');
        await onRefresh();
      } else if (error instanceof ReassignmentConflict) {
        setBlockedTarget(target);
        setTargetError(`${target ? truckName(target) : 'This truck'} already has a route. Choose another truck.`);
        setFailure({ text: 'The target truck is already assigned.', review: false });
        showWriteToast('Could not reassign route', 'error');
        const routes = await onRefresh();
        const occupied = routes?.find(item => item.truckId === target && actionsFor(item.status).length > 0);
        if (occupied) {
          const actor = dispatcherName(occupied.reassignedBy ?? occupied.assignedBy);
          setFailure({ text: `The target truck is assigned to ${occupied.destination} by ${actor}.`, review: false });
        }
      } else if (error instanceof HttpError && error.status < 500) {
        setFailure({ text: 'The server rejected the change. Review the route and try again.', review: true });
        showWriteToast('Could not save route change', 'error');
        await onRefresh();
      } else {
        setFailure({ text: 'Could not confirm whether the change was saved. Review the current route before trying again.', review: true });
        showWriteToast('Route change could not be confirmed', 'error');
        await onRefresh();
      }
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  if (!draft && actions.length === 0) return null;

  return (
    <>
      <div aria-label="Route actions" className="mt-4 flex flex-wrap gap-2" role="group">
        {actions.map(action => (
          <Button key={action} onPress={() => open(action)} isDisabled={!canWrite || (action === 'reassign' && targets.length === 0)} className={actionButton}>
            {routeActions[action].label}
          </Button>
        ))}
      </div>
      {draft && (
        <ModalOverlay
          isOpen isDismissable={!pending} isKeyboardDismissDisabled={pending}
          onOpenChange={open => { if (!open) setDraft(null); }}
          className="fixed inset-0 z-40 grid place-items-center overflow-auto bg-ink/40 p-4"
        >
          <Modal className="max-h-full w-full max-w-lg overflow-auto rounded-2xl border border-outline bg-surface p-5 shadow-xl sm:p-6">
            <Dialog className="outline-none">
              <Heading slot="title" className="mb-2 text-xl font-semibold">{routeActions[draft.action].label}</Heading>
              <p className="break-words text-sm font-medium">{draft.route.destination}</p>
              <p className="mt-1 text-sm text-muted">Current truck in this review: {truckName(draft.route.truckId)}</p>
              <Form onSubmit={event => { event.preventDefault(); void submit(); }} validationBehavior="aria" className="mt-4 grid gap-3">
                {draft.action === 'reassign' && (
                  <Select
                    className="grid gap-1.5" placeholder="Select a target truck" selectedKey={target}
                    onSelectionChange={key => {
                      setTarget(key === null ? null : String(key));
                      setTargetError(null);
                      if (failure && !failure.review) setFailure(null);
                    }}
                    isDisabled={pending} isInvalid={!!targetError}
                  >
                    <Label className="text-sm font-medium">Target truck</Label>
                    <Button ref={targetControl} className={`${actionButton} w-full bg-surface text-left`}><SelectValue /></Button>
                    <FieldError className="text-sm text-danger">{targetError}</FieldError>
                    <Popover className="z-50 w-(--trigger-width) rounded-lg border border-outline bg-surface p-1 shadow-lg">
                      <ListBox items={targets} className="max-h-60 overflow-auto outline-none">
                        {truck => (
                          <ListBoxItem id={truck.id} textValue={truck.name} className="cursor-pointer rounded-md px-2 py-1.5 text-sm outline-none data-[focused]:bg-accent-soft">
                            {truck.name}
                          </ListBoxItem>
                        )}
                      </ListBox>
                    </Popover>
                  </Select>
                )}
                {draft.action === 'cancel' && <p className="text-sm text-muted">Cancelling releases the assigned truck.</p>}
                {failure && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{failure.text}</p>}
                {failure?.review && (
                  <div className="grid gap-2 rounded-lg border border-outline bg-canvas p-3 text-sm">
                    <p className="font-semibold">{canWrite ? 'Latest route' : 'Last available route'}</p>
                    <p>{truckName(route.truckId)} · <RouteStatus status={route.status} /></p>
                    {latestActor && route._version > draft.route._version && <p className="break-words text-muted">Changed by {dispatcherName(latestActor)}</p>}
                    <Button
                      onPress={() => { setDraft({ ...draft, route }); setFailure(null); }}
                      isDisabled={!canWrite || pending}
                      className={`${actionButton} justify-self-start bg-surface`}
                    >
                      Review latest route
                    </Button>
                  </div>
                )}
                {!reviewedActionAvailable && <p role="status" className="text-sm text-warning">This action is unavailable for the reviewed route status.</p>}
                {!canWrite && !pending && (
                  <div className="grid gap-2 text-sm text-warning">
                    <p role="status">Route actions are unavailable until the dispatcher and route data are synchronized.</p>
                    {dispatcherId && <Button onPress={() => void onRefresh()} className="justify-self-start font-medium underline">Retry route data</Button>}
                  </div>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button onPress={() => setDraft(null)} isDisabled={pending} className={actionButton}>Close</Button>
                  <Button
                    type="submit" isPending={pending}
                    isDisabled={!canWrite || !!failure?.review || !reviewedActionAvailable}
                    className={`${actionButton} border-transparent bg-accent font-semibold text-white hover:bg-accent`}
                  >
                    {pending ? 'Saving…' : routeActions[draft.action].label}
                  </Button>
                </div>
              </Form>
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
    </>
  );
}
