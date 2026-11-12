import {
  Button, Text, UNSTABLE_Toast as Toast, UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue, UNSTABLE_ToastRegion as ToastRegion,
} from 'react-aria-components';

const queue = new ToastQueue<{ title: string; kind: 'success' | 'error' }>();

export function showWriteToast(title: string, kind: 'success' | 'error') {
  queue.add({ title, kind }, kind === 'success' ? { timeout: 5000 } : {});
}

export function WriteToasts() {
  return (
    <ToastRegion queue={queue} aria-label="Write notifications" className="fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2 sm:left-auto sm:w-80">
      {({ toast }) => (
        <Toast toast={toast} className={`flex items-center justify-between gap-3 rounded-xl border bg-surface p-3 shadow-lg ${toast.content.kind === 'error' ? 'border-danger/30 text-danger' : 'border-active/30 text-active'}`}>
          <ToastContent><Text slot="title" className="text-sm font-semibold">{toast.content.title}</Text></ToastContent>
          <Button slot="close" aria-label="Dismiss notification" className="cursor-pointer rounded px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent">×</Button>
        </Toast>
      )}
    </ToastRegion>
  );
}
