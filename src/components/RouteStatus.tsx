import type { FleetRoute } from '../sharedSchemas/routeSchema';

const styles = {
  unassigned: { text: 'Unassigned', classes: 'border border-outline bg-canvas text-muted' },
  assigned: { text: 'Assigned', classes: 'bg-accent-soft text-accent' },
  'in-progress': { text: 'In progress', classes: 'bg-active-soft text-active' },
  completed: { text: 'Completed', classes: 'bg-idle-soft text-idle' },
  cancelled: { text: 'Cancelled', classes: 'bg-warning-soft text-warning' },
};

export function RouteStatus({ status }: { status: FleetRoute['status'] | 'unassigned' }) {
  const { text, classes } = styles[status];
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>{text}</span>;
}
