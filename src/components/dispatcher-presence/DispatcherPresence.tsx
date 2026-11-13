import { useRef, useState, type FormEvent } from 'react';
import { Button, FieldError, Form, Input, Label, TextField } from 'react-aria-components';
import { registrationSchema } from './registrationSchema';
import type { useDispatcherPresence } from './useDispatcherPresence';

export interface DispatcherPresenceProps {
  presence: ReturnType<typeof useDispatcherPresence>;
  truckNames: ReadonlyMap<string, string>;
  selectedTruckId?: string | null;
}

function DispatcherTag({ name, viewedTruck, isSelf = false }: { name: string; viewedTruck: string | null; isSelf?: boolean }) {
  return (
    <li className={`flex min-w-0 max-w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg border px-2.5 py-1.5 ${isSelf ? 'border-accent/25 bg-accent-soft' : 'border-outline bg-canvas'}`}>
      <strong className="min-w-0 font-semibold wrap-anywhere text-ink">{name}</strong>
      {isSelf && <span className="font-medium text-accent">(You)</span>}
      {viewedTruck && <span className="min-w-0 wrap-anywhere text-muted">Viewing {viewedTruck}</span>}
    </li>
  );
}

export function DispatcherPresence({ presence, truckNames, selectedTruckId = null }: DispatcherPresenceProps) {
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const { connection, name, peers, register } = presence;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = registrationSchema.safeParse({ name: new FormData(event.currentTarget).get('name') });
    if (!result.success) {
      setError(result.error.issues[0].message);
      input.current?.focus();
      return;
    }
    register(result.data.name);
  }

  function truckName(truckId: string | null) {
    return truckId === null ? null : truckNames.get(truckId) ?? truckId;
  }

  return (
    <section aria-labelledby="dispatcher-row-title" className="mb-4 rounded-xl border border-outline bg-surface px-4 py-3">
      <div className={`flex flex-wrap gap-x-4 gap-y-2 ${connection === null ? 'items-baseline' : 'items-center'}`}>
        <h3 id="dispatcher-row-title" className="text-sm font-semibold">Online dispatchers</h3>
        {connection === null && (
          <Form onSubmit={submit} validationBehavior="aria" className="flex min-w-0 max-w-full flex-wrap items-baseline gap-2">
            <TextField name="name" isInvalid={!!error} isRequired onChange={() => setError(undefined)} className="grid w-40 min-w-0 max-w-full gap-1">
              <Label className="sr-only">Display name</Label>
              <Input
                ref={input}
                placeholder="Display name"
                className="w-full rounded-lg border border-outline px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              <div className="min-h-[1lh] text-xs leading-snug text-danger">
                <FieldError className="block">{error}</FieldError>
              </div>
            </TextField>
            <Button
              type="submit"
              className="cursor-pointer rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Join as dispatcher
            </Button>
          </Form>
        )}
        {connection?.status === 'connecting' && <p role="status" className="text-sm text-muted">Registering dispatcher…</p>}
        {connection?.status === 'reconnecting' && (
          <p role="status" className="text-sm text-warning">Dispatcher presence unavailable · reconnecting…</p>
        )}
        {connection?.status === 'connected' && (
          <ul aria-label="Dispatcher sessions" className="flex min-w-0 flex-wrap gap-2 text-xs">
            {name && <DispatcherTag name={name} viewedTruck={truckName(selectedTruckId)} isSelf />}
            {peers.map(peer => (
              <DispatcherTag key={peer.id} name={peer.label} viewedTruck={truckName(peer.truckId)} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
