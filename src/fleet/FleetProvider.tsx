import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createFleetStore } from './fleetStore';

const FleetContext = createContext<ReturnType<typeof createFleetStore> | null>(null);

export function FleetProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createFleetStore);
  useEffect(store.start, [store]);

  return <FleetContext.Provider value={store}>{children}</FleetContext.Provider>;
}

export function useFleetStore() {
  const store = useContext(FleetContext);
  if (!store) throw new Error('Fleet hooks require a FleetProvider');
  return store;
}

export function useFleetCatalog() {
  const { subscribe, getCatalogSnapshot } = useFleetStore();
  return useSyncExternalStore(subscribe, getCatalogSnapshot);
}

export function useFleetView() {
  const { subscribe, getFleetSnapshot } = useFleetStore();
  return useSyncExternalStore(subscribe, getFleetSnapshot);
}