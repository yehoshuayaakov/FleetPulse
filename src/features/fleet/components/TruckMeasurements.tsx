import { MetricMeter } from '../../../components/ui/MetricMeter';
import { formatFuelPercentage } from '../utils/formatFuelPercentage';
import { MAX_PLAUSIBLE_SPEED_KMH, type TruckTelemetry } from '../utils/telemetryHealth';

interface TruckMeasurementsProps {
  truck: TruckTelemetry;
  expanded?: boolean;
}

export function TruckMeasurements({ truck, expanded = false }: TruckMeasurementsProps) {
  const speedAge = truck.speedAgeSeconds === null ? '' : ` · last valid speed ${truck.speedAgeSeconds}s ago`;
  const measurements = [
    {
      label: 'Speed',
      value: truck.speed,
      valueLabel: truck.speed === null ? 'Speed unavailable' : `${truck.speed.toFixed(0)} km/h`,
      maxValue: MAX_PLAUSIBLE_SPEED_KMH,
      warning: truck.speedFault ? `Speed sensor fault${speedAge}` : undefined,
    },
    {
      label: 'Fuel',
      value: truck.fuel,
      valueLabel: truck.fuel === null ? 'Unavailable' : formatFuelPercentage(truck.fuel),
      maxValue: 100,
      warning: truck.fuelIssue === 'invalid' ? 'Invalid fuel reading' : undefined,
    },
    {
      label: 'Engine temp.',
      value: truck.engineTemp,
      valueLabel: truck.engineTemp === null ? 'Unavailable' : `${truck.engineTemp.toFixed(0)} °C`,
      minValue: -40,
      maxValue: 150,
      warning: truck.temperatureFault ? 'Invalid temperature reading' : undefined,
    },
  ];

  if (expanded) {
    return (
      <div className="grid gap-2">
        {measurements.map(measurement => <MetricMeter key={measurement.label} {...measurement} />)}
      </div>
    );
  }

  return (
    <>
      <dl className="grid grid-cols-3 gap-2 rounded-lg bg-canvas px-3 py-2">
        {measurements.map(({ label, valueLabel }) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-sm font-semibold tabular-nums">{valueLabel}</dd>
          </div>
        ))}
      </dl>
      {measurements.map(({ label, warning }) => warning && (
        <p key={label} className="mt-1.5 text-xs font-medium text-warning">{warning}</p>
      ))}
    </>
  );
}
