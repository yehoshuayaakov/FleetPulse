import { useRef, useState, type FormEvent } from 'react';
import {
  Button, FieldError, Form, Input, Label, ListBox, ListBoxItem,
  Popover, Select, SelectValue, TextField,
} from 'react-aria-components';
import { sendTruckAlert } from '../../../api/alerts/mutations';
import { HttpError } from '../../../api/http';
import { showWriteToast } from '../../../components/ui/WriteToasts';
import type { TruckAlert } from '../../../globalSchemas/truckAlertSchema';
import { alertSchema } from '../schemas/alertSchema';

interface SendAlertFormProps {
  truckId: string;
  truckName: string;
  dispatcherId: string | null;
  onSent: (alert: TruckAlert) => void;
}

const control = 'w-full rounded-lg border border-outline bg-surface px-2.5 py-2 text-left text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent';
const option = 'cursor-pointer rounded-md px-2 py-1.5 text-sm outline-none data-[focused]:bg-accent-soft data-[selected]:font-semibold';

export default function SendAlertForm({ truckId, truckName, dispatcherId, onSent }: SendAlertFormProps) {
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('info');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const messageInput = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dispatcherId || submitting.current) return;
    const result = alertSchema.safeParse({ message, severity });
    if (!result.success) {
      setFieldError(result.error.issues[0].message);
      messageInput.current?.focus();
      return;
    }

    submitting.current = true;
    setPending(true);
    setFailure(null);
    try {
      const alert = await sendTruckAlert(truckId, result.data, dispatcherId);
      onSent(alert);
      setMessage('');
      setSeverity('info');
      showWriteToast('Alert sent to ' + truckName, 'success');
    } catch (error) {
      if (error instanceof HttpError && error.status < 500) {
        setFailure('The server rejected the alert. Your message is still here.');
        showWriteToast('Could not send alert', 'error');
      } else {
        setFailure('Could not confirm whether the alert was sent. Check recent alerts before trying again.');
        showWriteToast('Alert delivery could not be confirmed', 'error');
      }
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <Form onSubmit={submit} validationBehavior="aria" className="grid gap-2 rounded-lg border border-outline bg-canvas p-3">
      <TextField
        value={message} onChange={value => { setMessage(value); setFieldError(null); }}
        isInvalid={!!fieldError} isDisabled={pending}
        className="grid gap-1"
      >
        <Label className="text-xs font-medium text-ink">Alert message</Label>
        <Input ref={messageInput} className={control} />
        <FieldError className="text-xs text-danger">{fieldError}</FieldError>
      </TextField>
      <Select
        selectedKey={severity} onSelectionChange={key => { if (key !== null) setSeverity(String(key)); }}
        className="grid gap-1" isDisabled={pending}
      >
        <Label className="text-xs font-medium text-ink">Severity</Label>
        <Button className={control}><SelectValue /></Button>
        <Popover className="z-30 w-(--trigger-width) rounded-lg border border-outline bg-surface p-1 shadow-lg">
          <ListBox className="outline-none">
            <ListBoxItem id="info" className={option}>Info</ListBoxItem>
            <ListBoxItem id="warning" className={option}>Warning</ListBoxItem>
            <ListBoxItem id="critical" className={option}>Critical</ListBoxItem>
          </ListBox>
        </Popover>
      </Select>
      {failure && <p role="alert" className="rounded-md bg-danger-soft px-2 py-1.5 text-xs text-danger">{failure}</p>}
      {!dispatcherId && <p className="text-xs text-muted">Connect as a dispatcher to send alerts.</p>}
      <Button
        type="submit" isDisabled={!dispatcherId} isPending={pending}
        className="justify-self-start cursor-pointer rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Send to ' + truckName}
      </Button>
    </Form>
  );
}
