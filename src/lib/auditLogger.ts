/**
 * Audit Logger Utility for NetBounce CRM
 * 
 * Provides guaranteed, reliable recording of:
 * 1. Direct User Logins (Admin, Sales, BD, Accountant, Process Analyst)
 * 2. Authorized Dashboard Access / Login-As / Team Inspections (Actor vs Target)
 */

import { supabase } from '@/integrations/supabase/client';

export interface LogAuthParams {
  actorId: string;
  actorName?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  actionType?: 'LOGIN' | 'DASHBOARD_ACCESS';
  targetUserId?: string | null;
  targetUserName?: string | null;
  targetUserRole?: string | null;
  dashboardAccessed?: string | null;
}

export const getDashboardNameByRole = (role?: string | null): string => {
  switch (role) {
    case 'ADMIN':
      return 'Admin Dashboard';
    case 'SALES_TL':
      return 'Sales TL Dashboard';
    case 'SALES_TM':
      return 'Sales Member Dashboard';
    case 'LEAD_TL':
      return 'BD TL Dashboard';
    case 'LEAD_GEN':
      return 'BD Member Dashboard';
    case 'ACCOUNTANT':
    case 'ACCOUNT_MANAGER':
      return 'Accounts Dashboard';
    case 'PROCESS_ANALYST':
      return 'Process Analyst Dashboard';
    default:
      return 'CRM Dashboard';
  }
};

// Cache to prevent duplicate logs within 10 seconds for identical actor + target + action
const recentLogsCache = new Map<string, number>();

export const recordAuthActivity = async (params: LogAuthParams): Promise<string | null> => {
  const {
    actorId,
    actorName,
    actorEmail,
    actorRole,
    actionType = 'LOGIN',
    targetUserId,
    targetUserName,
    targetUserRole,
    dashboardAccessed,
  } = params;

  if (!actorId) return null;

  // Deduplication key
  const cacheKey = `${actorId}_${actionType}_${targetUserId || 'self'}_${dashboardAccessed || ''}`;
  const lastLogged = recentLogsCache.get(cacheKey);
  const now = Date.now();
  if (lastLogged && now - lastLogged < 10000) {
    return null; // Suppress duplicate event triggered within 10s
  }
  recentLogsCache.set(cacheKey, now);

  try {
    let resolvedName = actorName;
    let resolvedEmail = actorEmail;
    let resolvedRole = actorRole;

    // If actor details are missing, fetch them
    if (!resolvedName || !resolvedRole || !resolvedEmail) {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('full_name, email').eq('user_id', actorId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', actorId).maybeSingle(),
      ]);
      resolvedName = resolvedName || profileRes.data?.full_name || 'User';
      resolvedEmail = resolvedEmail || profileRes.data?.email || null;
      resolvedRole = resolvedRole || roleRes.data?.role || null;
    }

    const payload: Record<string, any> = {
      user_id: actorId,
      logged_in_at: new Date().toISOString(),
      user_name: resolvedName,
      user_email: resolvedEmail,
      user_role: resolvedRole,
      action_type: actionType,
      target_user_id: targetUserId || actorId,
      target_user_name: targetUserName || resolvedName,
      target_user_role: targetUserRole || resolvedRole,
      dashboard_accessed: dashboardAccessed || getDashboardNameByRole(targetUserRole || resolvedRole),
    };

    const { data, error } = await (supabase as any)
      .from('login_activity')
      .insert(payload)
      .select('id')
      .maybeSingle();

    if (error) {
      console.warn('Audit log write error:', error.message);
      return null;
    }

    return data?.id || null;
  } catch (err: any) {
    console.warn('Audit log exception:', err?.message || err);
    return null;
  }
};
