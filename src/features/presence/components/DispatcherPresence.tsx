import { useRef, useState, type FormEvent } from 'react';
import { Button, FieldError, Form, Input, Label, TextField } from 'react-aria-components';
import { registrationSchema } from '../schemas/registrationSchema';
import type { useDispatcherPresence } from '../hooks/useDispatcherPresence';

interface DispatcherPresenceProps {
  presence: ReturnType<typeof useDispatcherPresence>;
  truckNames: ReadonlyMap<string, string>;
  selectedTruckId: string | null;
}

export function DispatcherPresence({ presence, truckNames, selectedTruckId }: DispatcherPresenceProps) {
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h3 id="dispatcher-row-title" className="text-sm font-semibold">Online dispatchers</h3>
        {connection === null && (
          <Form onSubmit={submit} validationBehavior="aria" className="flex flex-wrap items-start gap-2">
            <TextField name="name" isInvalid={!!error} isRequired onChange={() => setError(undefined)}>
              <Label className="sr-only">Display name</Label>
              <Input
                ref={input}
                placeholder="Display name"
                className="w-40 rounded-lg border border-outline px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              <FieldError className="mt-1 text-xs text-danger">{error}</FieldError>
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
            <li className="max-w-full break-words rounded-full bg-accent-soft px-2.5 py-1 text-accent">
              <strong>You</strong> · {name}
              {truckName(selectedTruckId) && ` · ${truckName(selectedTruckId)}`}
            </li>
            {peers.map(peer => (
              <li key={peer.id} className="max-w-full break-words rounded-full bg-canvas px-2.5 py-1 text-muted">
                <strong className="text-ink">{peer.label}</strong>
                {truckName(peer.truckId) && ` · ${truckName(peer.truckId)}`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
