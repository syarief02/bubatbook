import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { useViewAs } from './ViewAsContext';

const FleetContext = createContext(undefined);

/**
 * Fleet context provider — wraps admin pages.
 * Fetches user's fleet memberships and manages the active fleet.
 * Respects ViewAs overrides for role simulation.
 */
export function FleetProvider({ userId, isSuperAdmin, children }) {
  const [fleets, setFleets] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [activeFleetId, setActiveFleetId] = useState(null);
  const [loading, setLoading] = useState(true);

  // ViewAs integration
  let viewAsContext;
  try { viewAsContext = useViewAs(); } catch { viewAsContext = { isViewMode: false, viewAs: null }; }
  const { isViewMode, viewAs } = viewAsContext;

  useEffect(() => {
    if (!userId) return;
    fetchFleetData();
  }, [userId, isSuperAdmin]);

  async function fetchFleetData() {
    setLoading(true);
    try {
      if (isSuperAdmin) {
        const { data: allFleets } = await supabase
          .from('bubatrent_booking_fleet_groups')
          .select('*')
          .order('name');
        setFleets(allFleets || []);
        const { data: mData } = await supabase
          .from('bubatrent_booking_fleet_memberships')
          .select('*, bubatrent_booking_fleet_groups(*)')
          .eq('user_id', userId);
        setMemberships(mData || []);
        if (mData?.length) setActiveFleetId(mData[0].fleet_group_id);
        else if (allFleets?.length) setActiveFleetId(allFleets[0].id);
      } else {
        const { data: mData } = await supabase
          .from('bubatrent_booking_fleet_memberships')
          .select('*, bubatrent_booking_fleet_groups(*)')
          .eq('user_id', userId);
        setMemberships(mData || []);
        const userFleets = (mData || []).map(m => m.bubatrent_booking_fleet_groups).filter(Boolean);
        setFleets(userFleets);
        if (userFleets.length) setActiveFleetId(userFleets[0].id);
      }
    } catch (err) {
      console.error('Error fetching fleet data:', err);
    } finally {
      setLoading(false);
    }
  }

  const activeFleet = fleets.find(f => f.id === activeFleetId) || null;

  // Governance status flags — respect ViewAs overrides
  let effectiveFleetId = activeFleetId;
  let groupStatus = activeFleet?.status || 'PENDING_VERIFICATION';
  let isSuperGroup = activeFleet?.is_super_group === true;

  if (isViewMode && viewAs?.role === 'group_admin') {
    effectiveFleetId = viewAs.fleetId || activeFleetId;
    groupStatus = viewAs.fleetStatus || 'VERIFIED';
    isSuperGroup = viewAs.isSuperGroup || false;
  }

  const isGroupVerified = groupStatus === 'VERIFIED';
  const isGroupSuspended = groupStatus === 'SUSPENDED';
  const canAccessSensitiveData = isGroupVerified && !isGroupSuspended;
  const canWrite = isGroupVerified && !isGroupSuspended;

  return (
    <FleetContext.Provider value={{
      fleets,
      memberships,
      activeFleetId: effectiveFleetId,
      activeFleet: isViewMode && viewAs?.role === 'group_admin'
        ? (fleets.find(f => f.id === viewAs.fleetId) || { ...activeFleet, status: viewAs.fleetStatus, is_super_group: viewAs.isSuperGroup })
        : activeFleet,
      setActiveFleetId,
      loading,
      refetchFleets: fetchFleetData,
      // Governance
      groupStatus,
      isGroupVerified,
      isGroupSuspended,
      isSuperGroup,
      canAccessSensitiveData,
      canWrite,
    }}>
      {children}
    </FleetContext.Provider>
  );
}

export function useFleet() {
  const context = useContext(FleetContext);
  if (context === undefined) {
    throw new Error('useFleet must be used within a FleetProvider');
  }
  return context;
}
