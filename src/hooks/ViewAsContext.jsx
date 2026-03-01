import { createContext, useContext, useState, useCallback } from 'react';

const ViewAsContext = createContext(undefined);

/**
 * ViewAs context — lets Super Admin simulate other roles/groups.
 * 
 * viewAs modes:
 *   null      → normal (no simulation)
 *   'customer' → simulate logged-in customer
 *   'group_admin' → simulate admin of a specific fleet group
 * 
 * When active, useAuth and useFleet read overrides from this context.
 */
export function ViewAsProvider({ children }) {
  const [viewAs, setViewAs] = useState(null);
  // viewAs shape: { role: 'customer'|'group_admin', fleetId?, fleetName?, fleetStatus? }

  const enterViewAs = useCallback((config) => {
    setViewAs(config);
  }, []);

  const exitViewAs = useCallback(() => {
    setViewAs(null);
  }, []);

  const isViewMode = viewAs !== null;

  return (
    <ViewAsContext.Provider value={{
      viewAs,
      isViewMode,
      enterViewAs,
      exitViewAs,
    }}>
      {children}
    </ViewAsContext.Provider>
  );
}

export function useViewAs() {
  const context = useContext(ViewAsContext);
  if (context === undefined) {
    throw new Error('useViewAs must be used within a ViewAsProvider');
  }
  return context;
}
