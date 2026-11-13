import { Button, Dialog, DialogTrigger, Popover } from 'react-aria-components';

export function TruckViewers({ names }: { names: readonly string[] }) {
  if (names.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-accent">
      <p className="min-w-0 break-words">
        Viewed by {names.slice(0, 2).join(names.length === 2 ? ' and ' : ', ')}
      </p>
      {names.length > 2 && (
        <DialogTrigger>
          <Button
            aria-label={`Show all ${names.length} viewers`}
            className="cursor-pointer rounded-full bg-accent-soft px-2 py-0.5 font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            +{names.length - 2}
          </Button>
          <Popover placement="top start" className="z-30 max-w-64 rounded-xl border border-outline bg-surface p-3 shadow-lg">
            <Dialog aria-label="Truck viewers" className="text-sm text-ink outline-none">
              <ul aria-label="All viewers" className="space-y-1">
                {names.map((name, index) => <li key={index} className="break-words">{name}</li>)}
              </ul>
            </Dialog>
          </Popover>
        </DialogTrigger>
      )}
    </div>
  );
}
