import { useRef, useState, type FormEvent } from 'react';
import {
  Button, Dialog, FieldError, Form, Heading, Input, Label, ListBox, ListBoxItem,
  Modal, ModalOverlay, Popover, Select, SelectValue, TextArea, TextField,
} from 'react-aria-components';
import { AssignmentConflict, createRoute } from '../../../api/routes/mutations';
import { HttpError } from '../../../api/http';
import { RouteStatus } from '../../../components/RouteStatus';
import { StatusBadge } from '../../../components/StatusBadge';
import { showWriteToast } from '../../../components/ui/WriteToasts';
import type { FleetRoute } from '../../../sharedSchemas/routeSchema';
import type { truckStatusSchema } from '../../../sharedSchemas/truckStatusSchema';
import { assignmentSchema } from '../schemas/routeSchemas';
import type { z } from 'zod';

type TruckStatus = z.infer<typeof truckStatusSchema>;

interface RouteTruckChoice {
  id: string;
  name: string;
  status: TruckStatus;
  routeStatus?: FleetRoute['status'];
  available: boolean;
}

interface RouteFormProps {
  initialTruckId: string | null;
  trucks: readonly RouteTruckChoice[];
  dispatcherId: string | null;
  canWrite: boolean;
  onRefresh: () => Promise<FleetRoute[] | null>;
  onCreated: (route: FleetRoute) => void;
  onClose: () => void;
  dispatcherName: (id: string) => string;
}

const control = 'w-full rounded-lg border border-outline bg-surface px-3 py-2 text-left text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent';
const field = 'grid gap-1.5';
const errorStyle = 'text-sm text-danger';
const option = 'flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[focused]:bg-accent-soft data-[selected]:font-semibold';

export default function RouteForm({ initialTruckId, trucks, dispatcherId, canWrite, onRefresh, onCreated, onClose, dispatcherName }: RouteFormProps) {
  const [truckId, setTruckId] = useState(initialTruckId);
  const [priority, setPriority] = useState('normal');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const truckControl = useRef<HTMLButtonElement>(null);
  const destinationControl = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dispatcherId || !canWrite || submitting.current) return;

    const data = new FormData(event.currentTarget);
    const result = assignmentSchema.safeParse({
      truckId: truckId ?? '', destination: data.get('destination'), priority, notes: data.get('notes'),
    });
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map(issue => [String(issue.path[0]), issue.message])));
      if (result.error.issues[0].path[0] === 'truckId') truckControl.current?.focus();
      else destinationControl.current?.focus();
      return;
    }
    if (!trucks.some(truck => truck.id === result.data.truckId && truck.available)) {
      setErrors({ truckId: 'Choose an available truck.' });
      truckControl.current?.focus();
      return;
    }

    submitting.current = true;
    setErrors({});
    setFailure(null);
    setPending(true);
    try {
      const route = await createRoute(result.data, dispatcherId);
      onCreated(route);
      showWriteToast('Route assigned', 'success');
      onClose();
    } catch (error) {
      if (error instanceof AssignmentConflict) {
        setErrors({ truckId: 'Choose another truck.' });
        setFailure('This truck already has a route.');
        showWriteToast('Could not assign route', 'error');
        const routes = await onRefresh();
        const current = routes?.find(route => route.id === error.routeId);
        const assignment = current?.destination ?? error.routeId;
        const actor = error.assignedBy ?? current?.assignedBy;
        setFailure(`This truck already has a route${assignment ? ` to ${assignment}` : ''}${actor ? `, assigned by ${dispatcherName(actor)}` : ''}.`);
      } else if (error instanceof HttpError && error.status < 500) {
        setFailure('The server rejected the assignment. Review your choices and try again.');
        showWriteToast('Could not assign route', 'error');
      } else {
        setFailure('Could not confirm whether the route was assigned. Check the current assignments before trying again.');
        showWriteToast('Assignment could not be confirmed', 'error');
        await onRefresh();
      }
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <ModalOverlay
      isOpen isDismissable={!pending} isKeyboardDismissDisabled={pending}
      onOpenChange={open => { if (!open) onClose(); }}
      className="fixed inset-0 z-40 grid place-items-center overflow-auto bg-ink/40 p-4"
    >
      <Modal className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-outline bg-surface p-5 shadow-xl sm:p-6">
        <Dialog className="outline-none">
          <Heading slot="title" className="mb-4 text-xl font-semibold">Assign route</Heading>
          <Form onSubmit={submit} validationBehavior="aria" className="grid gap-4">
            <Select
              className={field} placeholder="Select a truck" selectedKey={truckId}
              onSelectionChange={key => {
                setTruckId(key === null ? null : String(key));
                setErrors(previous => ({ ...previous, truckId: '' }));
              }}
              isInvalid={!!errors.truckId} isDisabled={pending}
            >
              <Label className="text-sm font-medium">Truck</Label>
              <Button ref={truckControl} className={`${control} flex items-center`}>
                <SelectValue className="flex min-w-0 flex-1 items-center justify-between gap-2" />
              </Button>
              <FieldError className={errorStyle}>{errors.truckId}</FieldError>
              <Popover className="z-50 w-(--trigger-width) rounded-lg border border-outline bg-surface p-1 shadow-lg">
                <ListBox items={trucks} className="max-h-60 overflow-auto outline-none">
                  {truck => (
                    <ListBoxItem
                      id={truck.id}
                      textValue={`${truck.name}, ${truck.status}${truck.available ? '' : ', unavailable'}`}
                      isDisabled={!truck.available}
                      className={option}
                    >
                      <span className="min-w-0 truncate">{truck.name}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        <StatusBadge status={truck.status} />
                        {truck.routeStatus && <RouteStatus status={truck.routeStatus} />}
                      </span>
                    </ListBoxItem>
                  )}
                </ListBox>
              </Popover>
            </Select>

            <TextField name="destination" className={field} isInvalid={!!errors.destination} isDisabled={pending}>
              <Label className="text-sm font-medium">Destination</Label>
              <Input ref={destinationControl} className={control} />
              <FieldError className={errorStyle}>{errors.destination}</FieldError>
            </TextField>

            <Select className={field} selectedKey={priority} onSelectionChange={key => setPriority(String(key))} isDisabled={pending}>
              <Label className="text-sm font-medium">Priority</Label>
              <Button className={control}><SelectValue /></Button>
              <Popover className="z-50 w-(--trigger-width) rounded-lg border border-outline bg-surface p-1 shadow-lg">
                <ListBox className="outline-none">
                  <ListBoxItem id="normal" className={option}>Normal</ListBoxItem>
                  <ListBoxItem id="high" className={option}>High</ListBoxItem>
                </ListBox>
              </Popover>
            </Select>

            <TextField name="notes" className={field} isDisabled={pending}>
              <Label className="text-sm font-medium">Notes <span className="font-normal text-muted">(optional)</span></Label>
              <TextArea rows={3} className={control} />
            </TextField>

            {failure && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{failure}</p>}
            {!canWrite && !pending && (
              <p role="status" className="text-sm text-warning">Assignments are unavailable until the dispatcher and route data are synchronized.</p>
            )}
            {!canWrite && !pending && dispatcherId && (
              <Button onPress={() => void onRefresh()} className="justify-self-start text-sm font-medium text-accent underline">Refresh route data</Button>
            )}
            <div className="flex items-center justify-between gap-6">
              <Button onPress={onClose} isDisabled={pending} className="cursor-pointer rounded-lg border border-outline px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent">Cancel</Button>
              <Button type="submit" isDisabled={!canWrite} isPending={pending} className="cursor-pointer rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                {pending ? 'Assigning…' : 'Assign route'}
              </Button>
            </div>
          </Form>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
