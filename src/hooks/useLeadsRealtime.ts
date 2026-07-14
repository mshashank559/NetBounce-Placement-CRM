import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * useLeadsRealtime
 *
 * Subscribes to Supabase Realtime INSERT/UPDATE/DELETE events on the `leads`
 * and `lead_closures` tables. When any change is detected, it invalidates the
 * relevant React Query caches so every panel (Leads page, Admin Dashboard,
 * KPI cards) refreshes automatically without a full page reload.
 *
 * This hook should be mounted ONCE at the layout level (DashboardLayout).
 */
export const useLeadsRealtime = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to all changes on the leads table
    const leadsChannel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => {
          // Invalidate all lead caches — triggers a background refetch
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          queryClient.invalidateQueries({ queryKey: ['all-leads-admin'] });
          queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-leads'] });
          queryClient.invalidateQueries({ queryKey: ['bd-member-leads'] });
        }
      )
      .subscribe();

    // Subscribe to changes on lead_closures table (affects Revenue KPIs)
    const closuresChannel = supabase
      .channel('closures-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lead_closures' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['all-closures-admin'] });
          queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
          queryClient.invalidateQueries({ queryKey: ['account-closures'] });
        }
      )
      .subscribe();

    // Cleanup subscriptions when the layout unmounts (e.g., user logs out)
    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(closuresChannel);
    };
  }, [queryClient]);
};
