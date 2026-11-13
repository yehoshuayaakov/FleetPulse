export function formatFuelPercentage(value: number): string {
  return value > 0 && value < 1 ? '<1%' : `${value.toFixed(0)}%`;
}
