import { useId } from 'react';
import { Label, Meter } from 'react-aria-components';

interface MetricMeterProps {
  label: string;
  value: number | null;
  valueLabel: string;
  minValue?: number;
  maxValue: number;
  warning?: string;
}

export function MetricMeter({ label, value, valueLabel, minValue = 0, maxValue, warning }: MetricMeterProps) {
  const warningId = useId();
  const valueRow = (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-ink">{valueLabel}</span>
    </div>
  );

  return (
    <div className="rounded-lg bg-canvas px-3 py-2.5">
      {value === null ? valueRow : (
        <Meter
          minValue={minValue}
          maxValue={maxValue}
          value={Math.min(maxValue, Math.max(minValue, value))}
          valueLabel={valueLabel}
          aria-describedby={warning ? warningId : undefined}
        >
          {({ percentage, valueText }) => (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <Label className="text-sm text-muted">{label}</Label>
                <span className="text-sm font-semibold tabular-nums text-ink">{valueText}</span>
              </div>
              <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-outline">
                <div
                  className={`h-full rounded-full ${warning ? 'bg-warning' : 'bg-accent'}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </>
          )}
        </Meter>
      )}
      {warning && <p id={warningId} className="mt-1.5 text-xs font-medium text-warning">{warning}</p>}
    </div>
  );
}
