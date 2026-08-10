import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

import { isWeekendLockdownActive, isRoleRestrictedOnWeekend, WEEKEND_LOCK_MESSAGE } from '@/lib/weekendLock';
import { recordAuthActivity, getDashboardNameByRole } from '@/lib/auditLogger';

// Key used to pass the forced-logout message to AuthPage via sessionStorage
export const FORCED_LOGOUT_KEY = 'nb_forced_logout_msg';

type AppRole = 'ADMIN' | 'PROCESS_ANALYST' | 'LEAD_TL' | 'LEAD_GEN' | 'SALES_TL' | 'SALES_TM' | 'ACCOUNTANT' | 'ACCOUNT_MANAGER';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  avatar_url: string | null;
  reports_to?: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, role: AppRole, department?: string, reportsTo?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

/**
 * Checks whether a given user is allowed CRM access during Weekend Lockdown
 * (Sat 4:30 AM to Mon 7:30 PM IST).
 * - Exempt roles (Admin, Accountant, Account Manager, Process Analyst) always return true.
 * - If outside lockdown window, returns true.
 * - If inside lockdown window for Sales/BD, checks if an active weekend pass exists.
 */
export const checkUserWeekendAccess = async (userId: string, userRole?: string | null): Promise<boolean> => {
  if (!isWeekendLockdownActive()) return true;
  if (!isRoleRestrictedOnWeekend(userRole)) return true;

  try {
    const { data: pass, error } = await (supabase as any)
      .from('weekend_access_passes')
      .select('valid_until, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !pass) return false;

    const validUntilTime = new Date(pass.valid_until).getTime();
    return pass.is_active && validUntilTime > Date.now();
  } catch {
    return false;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfileAndRole = async (sessionUser: User, retries = 3) => {
    const userId = sessionUser.id;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        let [profileRes, roleRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
          supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
        ]);

        // ── Self-Healing: Auto-create missing profile & role if they didn't trigger correctly
        if (!profileRes.data && sessionUser.user_metadata) {
          await supabase.from('profiles').insert({
            user_id: userId,
            full_name: sessionUser.user_metadata.full_name || 'User',
            email: sessionUser.email || '',
            department: sessionUser.user_metadata.department,
            reports_to: sessionUser.user_metadata.reports_to
          });
          profileRes = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
        }

        if (!roleRes.data && sessionUser.user_metadata?.role) {
          await supabase.from('user_roles').insert({
            user_id: userId,
            role: sessionUser.user_metadata.role as any
          });
          roleRes = await supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
        }

        if (profileRes.data) setProfile(profileRes.data as Profile);
        if (roleRes.data) setRole(roleRes.data.role as AppRole);

        // If we got a role, break out of retry loop
        if (roleRes.data?.role) break;
      } catch (error) {
        console.error(`Attempt ${attempt} error fetching profile/role:`, error);
      }

      // If attempt failed and we have retries left, wait 1000ms before retrying
      if (attempt < retries) {
        await new Promise(res => setTimeout(res, 1000));
      }
    }
  };

  // Tracks the login_activity row id for the current session so we can update logout_at
  const loginRowId = useRef<string | null>(localStorage.getItem('nb_login_activity_id'));

  const setLoginRowId = (id: string | null) => {
    loginRowId.current = id;
    if (id) {
      localStorage.setItem('nb_login_activity_id', id);
    } else {
      localStorage.removeItem('nb_login_activity_id');
    }
  };

  // ISO timestamp of when the current session started — used to detect forced logouts.
  const signInTime = useRef<string | null>(localStorage.getItem('nb_session_start_time'));

  const setSignInTime = (time: string | null) => {
    signInTime.current = time;
    if (time) {
      localStorage.setItem('nb_session_start_time', time);
    } else {
      localStorage.removeItem('nb_session_start_time');
    }
  };

  // Interval ID for the security & lockdown polling loop
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Poll profiles.password_reset_at & Weekend Lockdown every 30 s ───────────
  const startForcedLogoutPolling = (userId: string, userRole?: string | null) => {
    if (pollInterval.current) clearInterval(pollInterval.current);

    const check = async () => {
      try {
        // 1. Check Weekend Lockdown status for restricted roles (Sat 4:30 AM to Mon 7:30 PM IST)
        const isAllowed = await checkUserWeekendAccess(userId, userRole || role);
        if (!isAllowed) {
          if (pollInterval.current) clearInterval(pollInterval.current);
          sessionStorage.setItem(FORCED_LOGOUT_KEY, WEEKEND_LOCK_MESSAGE);
          setSignInTime(null);
          await supabase.auth.signOut();
          return;
        }

        // 2. Check admin-forced password resets
        const { data } = await (supabase as any)
          .from('profiles')
          .select('password_reset_at')
          .eq('user_id', userId)
          .maybeSingle() as { data: { password_reset_at: string | null } | null };

        if (data?.password_reset_at && signInTime.current) {
          const resetAt  = new Date(data.password_reset_at).getTime();
          const loginAt  = new Date(signInTime.current).getTime();
          if (resetAt > loginAt) {
            if (pollInterval.current) clearInterval(pollInterval.current);
            sessionStorage.setItem(
              FORCED_LOGOUT_KEY,
              'Your password has been changed by an administrator. For security reasons, you have been signed out of all devices. Please log in again using your new password.'
            );
            setSignInTime(null);
            await supabase.auth.signOut();
          }
        }
      } catch {
        // Non-critical
      }
    };

    // Run once immediately, then on a 30-second cadence
    check();
    pollInterval.current = setInterval(check, 30_000);
  };

  const stopForcedLogoutPolling = () => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
  };

  // ── Guaranteed recording of login activity ───
  const logLogin = async (userId: string, userRole?: string | null) => {
    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('full_name, email').eq('user_id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      ]);

      const resolvedRole = userRole || roleRes.data?.role || null;
      const rowId = await recordAuthActivity({
        actorId: userId,
        actorName: profileRes.data?.full_name || 'User',
        actorEmail: profileRes.data?.email || null,
        actorRole: resolvedRole,
        actionType: 'LOGIN',
        targetUserId: userId,
        targetUserName: profileRes.data?.full_name || 'User',
        targetUserRole: resolvedRole,
        dashboardAccessed: getDashboardNameByRole(resolvedRole),
      });

      if (rowId) setLoginRowId(rowId);
    } catch {
      // Non-critical
    }
  };

  // ── Log a logout event ───────────────────────────────────────
  const logLogout = async () => {
    const currentId = loginRowId.current || localStorage.getItem('nb_login_activity_id');
    const currentUserId = user?.id;
    try {
      if (currentId) {
        await (supabase as any)
          .from('login_activity')
          .update({ logged_out_at: new Date().toISOString() })
          .eq('id', currentId);
      } else if (currentUserId) {
        await (supabase as any)
          .from('login_activity')
          .update({ logged_out_at: new Date().toISOString() })
          .eq('user_id', currentUserId)
          .is('logged_out_at', null);
      }
      setLoginRowId(null);
    } catch {
      // Non-critical
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        if (!signInTime.current) {
          setSignInTime(new Date().toISOString());
        }
        setUser(session.user);
        logLogin(session.user.id, session.user.user_metadata?.role);
        setTimeout(() => fetchProfileAndRole(session.user), 0);
        startForcedLogoutPolling(session.user.id, session.user.user_metadata?.role);
      } else if (event === 'SIGNED_OUT') {
        stopForcedLogoutPolling();
        setSignInTime(null);
        logLogout();
        setUser(null);
        setProfile(null);
        setRole(null);
      } else if (session?.user) {
        setUser(session.user);
        setTimeout(() => fetchProfileAndRole(session.user), 0);
      } else {
        setUser(null);
        setProfile(null);
        setRole(null);
      }
      setLoading(false);
    });

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Check Weekend Lockdown before continuing existing session
          const { data: roleRes } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .maybeSingle();

          const activeRole = roleRes?.role || session.user.user_metadata?.role;
          const isAllowed = await checkUserWeekendAccess(session.user.id, activeRole);

          if (!isAllowed) {
            sessionStorage.setItem(FORCED_LOGOUT_KEY, WEEKEND_LOCK_MESSAGE);
            await supabase.auth.signOut();
            setLoading(false);
            return;
          }

          if (!signInTime.current) {
            setSignInTime(new Date().toISOString());
          }
          setUser(session.user);
          await fetchProfileAndRole(session.user);
          startForcedLogoutPolling(session.user.id, activeRole);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      subscription.unsubscribe();
      stopForcedLogoutPolling();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error as Error | null };

    if (authData?.user) {
      // Validate Weekend Lockdown Policy (Sat 4:30 AM to Mon 7:30 PM IST)
      const { data: roleRes } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      const userRole = roleRes?.role || authData.user.user_metadata?.role;
      const isAllowed = await checkUserWeekendAccess(authData.user.id, userRole);

      if (!isAllowed) {
        // Enforce immediate sign out and return explicit error
        sessionStorage.setItem(FORCED_LOGOUT_KEY, WEEKEND_LOCK_MESSAGE);
        await supabase.auth.signOut();
        return { error: new Error(WEEKEND_LOCK_MESSAGE) };
      }

      // Immediately record successful login to audit trail
      await logLogin(authData.user.id, userRole);
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string, role: AppRole, department?: string, reportsTo?: string) => {
    const cleanedEmail = email.replace(/['"]/g, '').trim();
    const emailLower = cleanedEmail.toLowerCase();
    const emailDomainRegex = /^[a-zA-Z0-9._%+-]+@netbounceplacement\.com$/i;
    if (!emailDomainRegex.test(cleanedEmail) || !emailLower.endsWith('@netbounceplacement.com')) {
      return { error: new Error('Only @netbounceplacement.com email addresses are allowed.') };
    }

    // Step 1: Create the auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanedEmail,
      password,
      options: {
        data: { full_name: fullName, role, department, reports_to: reportsTo },
      },
    });

    if (authError) return { error: authError as Error };
    if (!authData.user) return { error: new Error('Signup failed — no user returned.') };

    const userId = authData.user.id;

    // Step 2: Manually insert profile (do not rely on DB trigger)
    const { error: profileError } = await supabase.from('profiles').insert({
      user_id: userId,
      full_name: fullName,
      email: email,
      department: department || null,
      reports_to: reportsTo || null,
    });

    // Step 3: Manually insert role
    const { error: roleError } = await supabase.from('user_roles').insert({
      user_id: userId,
      role: role as any,
    });

    // Return first error if any, but don't block — auth succeeded
    const combinedError = profileError || roleError;
    if (combinedError) {
      console.warn('Profile/role insert warning (auth succeeded):', combinedError.message);
    }

    return { error: null };
  };

  const signOut = async () => {
    await logLogout();
    stopForcedLogoutPolling();
    setSignInTime(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, role, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
