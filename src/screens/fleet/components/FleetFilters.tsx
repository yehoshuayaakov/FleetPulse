import type { ReactNode } from 'react';
import { Button, ToggleButton, ToggleButtonGroup, type Selection } from 'react-aria-components';
import {
  ASSIGNMENT_FILTERS,
  FUEL_FILTERS,
  REGION_FILTERS,
  STATUS_FILTERS,
  emptyFleetFilter,
  isFleetFilterActive,
  type AssignmentFilter,
  type FleetFilter,
  type FuelFilter,
  type RegionFilter,
  type StatusFilter,
} from '../utils/fleetFilter';

const statusSelected = {
  active: 'bg-active-soft text-active',
  idle: 'bg-idle-soft text-idle',
  maintenance: 'bg-maintenance-soft text-maintenance',
} satisfies Record<StatusFilter, string>;

const labels = {
  fuel: { 'under-25': 'Under 25%', '25-50': '25–50%', 'over-50': 'Over 50%', unavailable: 'Unavailable' },
  region: { northwest: 'Northwest', northeast: 'Northeast', southwest: 'Southwest', southeast: 'Southeast' },
  assignment: { unassigned: 'Unassigned', assigned: 'Assigned', 'in-progress': 'In progress' },
} satisfies {
  fuel: Record<FuelFilter, string>;
  region: Record<RegionFilter, string>;
  assignment: Record<AssignmentFilter, string>;
};

interface FleetFiltersProps {
  filter: FleetFilter;
  onChange: (filter: FleetFilter) => void;
  assignmentReady: boolean;
}

export function FleetFilters({ filter, onChange, assignmentReady }: FleetFiltersProps) {
  const filtering = isFleetFilterActive(filter);

  return (
    <section aria-labelledby="fleet-filter-title" className="mb-5 rounded-xl border border-outline bg-surface px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 id="fleet-filter-title" className="text-sm font-semibold">Filter trucks</h3>
        {filtering && (
          <Button
            onPress={() => onChange(emptyFleetFilter)}
            className="cursor-pointer text-sm font-medium text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
          >
            Clear filters
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
      <FilterGroup label="Status" selected={filter.status} onChange={status => onChange({ ...filter, status })}>
        {STATUS_FILTERS.map(id => (
          <FilterChoice key={id} id={id} selectedClass={statusSelected[id]}>
            {id === 'active' ? 'Active' : id === 'idle' ? 'Idle' : 'Maintenance'}
          </FilterChoice>
        ))}
      </FilterGroup>
      <FilterGroup label="Fuel" selected={filter.fuel} onChange={fuel => onChange({ ...filter, fuel })}>
        {FUEL_FILTERS.map(id => <FilterChoice key={id} id={id}>{labels.fuel[id]}</FilterChoice>)}
      </FilterGroup>
      <FilterGroup label="Region" selected={filter.region} onChange={region => onChange({ ...filter, region })}>
        {REGION_FILTERS.map(id => <FilterChoice key={id} id={id}>{labels.region[id]}</FilterChoice>)}
      </FilterGroup>
      <FilterGroup
        label="Assignment"
        selected={filter.assignment}
        isDisabled={!assignmentReady}
        onChange={assignment => onChange({ ...filter, assignment })}
      >
        {ASSIGNMENT_FILTERS.map(id => <FilterChoice key={id} id={id}>{labels.assignment[id]}</FilterChoice>)}
      </FilterGroup>
      </div>
    </section>
  );
}

function FilterGroup<T extends string>({ label, selected, isDisabled = false, onChange, children }: {
  label: string;
  selected: ReadonlySet<T>;
  isDisabled?: boolean;
  onChange: (selected: Set<T>) => void;
  children: ReactNode;
}) {
  return (
    <div className={isDisabled ? 'opacity-50' : undefined}>
      <div className="mb-1 text-xs font-medium text-muted">{label}</div>
      <ToggleButtonGroup
        aria-label={isDisabled ? `${label}, waiting for routes` : label}
        className="inline-flex rounded-lg border border-outline bg-canvas p-0.5"
        selectionMode="multiple"
        isDisabled={isDisabled}
        selectedKeys={selected}
        onSelectionChange={keys => onChange(chosen(keys))}
      >
        {children}
      </ToggleButtonGroup>
    </div>
  );
}

function FilterChoice({ id, selectedClass = 'bg-accent-soft text-accent', children }: {
  id: string;
  selectedClass?: string;
  children: string;
}) {
  return (
    <ToggleButton
      id={id}
      className={({ isSelected, isDisabled }) =>
        `relative cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-accent ${
          isDisabled ? 'cursor-not-allowed' : ''
        } ${isSelected ? selectedClass : 'text-muted hover:bg-surface hover:text-ink'}`
      }
    >
      {children}
    </ToggleButton>
  );
}

function chosen<T extends string>(keys: Selection): Set<T> {
  if (keys === 'all') return new Set();
  const selected = new Set<T>();
  for (const key of keys) selected.add(String(key) as T);
  return selected;
}
