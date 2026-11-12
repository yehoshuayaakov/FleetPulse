const statusStyles = {
  active: { label: 'Active', classes: 'bg-active-soft text-active' },
  idle: { label: 'Idle', classes: 'bg-idle-soft text-idle' },
  maintenance: { label: 'Maintenance', classes: 'bg-maintenance-soft text-maintenance' },
};

export function StatusBadge({ status }: { status: keyof typeof statusStyles }) {
  const { label, classes } = statusStyles[status];
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}
