import type { CSSProperties } from 'react';
import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';
import type { TruckTelemetry } from '../utils/telemetryHealth';
import { StatusBadge } from '../../../components/StatusBadge';
import { formatFuelPercentage } from '../utils/formatFuelPercentage';
import { gridPosition, TEL_AVIV_BOUNDS } from '../utils/gridPosition';

const markerStyles = {
  active: 'bg-active text-white',
  idle: 'bg-idle text-white',
  maintenance: 'bg-maintenance text-white',
};

interface TruckGridProps {
  trucks: TruckTelemetry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  viewersByTruck: ReadonlyMap<string, readonly string[]>;
}

export function TruckGrid({ trucks, selectedId, onSelect, viewersByTruck }: TruckGridProps) {
  const { north, south, west, east } = TEL_AVIV_BOUNDS;

  return (
    <section aria-labelledby="grid-title" className="rounded-2xl border border-outline bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-1 border-b border-outline px-5 py-4">
        <h3 id="grid-title" className="text-base font-semibold">Coordinate grid</h3>
        <p className="text-sm text-muted">Tel Aviv</p>
      </div>
      <div className="mx-auto p-4 sm:p-5 lg:max-w-[max(18rem,calc(100dvh-27rem))]">
        <div className="text-center font-mono text-xs tabular-nums text-muted">
          {north.toFixed(4)}° N
        </div>
        <div className="my-2 rounded-xl border border-outline bg-canvas p-5 sm:p-6">
          <div
            aria-label="Truck positions"
            role="group"
            className="relative aspect-square border border-outline [background-image:linear-gradient(to_right,var(--color-outline)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-outline)_1px,transparent_1px)] [background-size:20%_20%]"
          >
            {trucks.map(truck => {
              const { x, y } = gridPosition(truck.location);
              const isSelected = truck.id === selectedId;
              const viewerCount = viewersByTruck.get(truck.id)?.length ?? 0;
              const viewersLabel = viewerCount === 0 ? '' : `, viewed by ${viewerCount} ${viewerCount === 1 ? 'dispatcher' : 'dispatchers'}`;
              const style = { '--marker-x': `${x}%`, '--marker-y': `${y}%` } as CSSProperties;
              return (
                <TooltipTrigger key={truck.id} delay={250}>
                  <Button
                    aria-label={`Select ${truck.name} on grid${truck.signalStale ? ', signal stale' : ''}${viewersLabel}`}
                    aria-pressed={isSelected}
                    onPress={() => onSelect(truck.id)}
                    style={style}
                    className={`absolute left-(--marker-x) top-(--marker-y) grid size-9 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-2 border-surface text-xs font-semibold shadow-sm outline-none hover:z-20 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${isSelected ? 'z-10 ring-2 ring-accent ring-offset-2' : ''} ${markerStyles[truck.status]} ${truck.signalStale ? 'opacity-55' : ''}`}
                  >
                    {truck.id.replace(/^truck_/, '')}
                    {viewerCount > 0 && (
                      <span aria-hidden="true" className="absolute -right-3 -top-2 inline-flex items-center gap-0.5 rounded-full border border-outline bg-surface px-1 py-0.5 text-[10px] leading-none text-accent shadow-sm">
                        <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                          <circle cx="12" cy="12" r="2.5" />
                        </svg>
                        {viewerCount}
                      </span>
                    )}
                  </Button>
                  <Tooltip
                    placement="top"
                    offset={8}
                    className="z-30 max-w-64 rounded-xl border border-outline bg-surface px-3 py-2 text-sm text-ink shadow-lg"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{truck.name}</strong>
                      <StatusBadge status={truck.status} />
                    </div>
                    <p className="mt-1 tabular-nums text-muted">
                      {truck.speed === null ? 'Speed unavailable' : `${truck.speed.toFixed(0)} km/h`} ·{' '}
                      {truck.fuel === null ? 'Fuel unavailable' : `${formatFuelPercentage(truck.fuel)} fuel`}
                    </p>
                    {truck.signalStale && (
                      <p className="mt-1 text-xs font-medium text-warning">
                        Signal stale{truck.positionAgeSeconds !== null && ` · position ${truck.positionAgeSeconds}s ago`}
                      </p>
                    )}
                    {truck.speedFault && <p className="mt-1 text-xs font-medium text-warning">Speed sensor fault</p>}
                    <p className="mt-1 text-xs tabular-nums text-muted">
                      {truck.location.lat.toFixed(4)}°, {truck.location.lng.toFixed(4)}°
                    </p>
                  </Tooltip>
                </TooltipTrigger>
              );
            })}
          </div>
        </div>
        <div className="flex justify-between font-mono text-xs tabular-nums text-muted">
          <span>{west.toFixed(4)}° E</span>
          <span>{south.toFixed(4)}° N</span>
          <span>{east.toFixed(4)}° E</span>
        </div>
        <ul aria-label="Truck status legend" className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-outline pt-3 text-xs text-muted">
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-full bg-active" />
            Active
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-full bg-idle" />
            Idle
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-full bg-maintenance" />
            Maintenance
          </li>
        </ul>
      </div>
    </section>
  );
}
