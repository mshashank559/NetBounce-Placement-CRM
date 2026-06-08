import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

type AppRole = 'ADMIN' | 'PROCESS_ANALYST' | 'LEAD_TL' | 'LEAD_GEN' | 'SALES_TL' | 'SALES_TM' | 'ACCOUNTANT';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfileAndRole = async (sessionUser: User) => {
    try {
      const userId = sessionUser.id;
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
          role: sessionUser.user_metadata.role
        });
        roleRes = await supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
      }

      if (profileRes.data) setProfile(profileRes.data as Profile);
      if (roleRes.data) setRole(roleRes.data.role as AppRole);
    } catch (error) {
      console.error('Error fetching profile/role:', error);
    }
  };

  // Tracks the login_activity row id for the current session so we can update logout_at
  const loginRowId = useRef<string | null>(null);

  // ── Log a login event (with denormalized user info for Admin panel) ───
  const logLogin = async (userId: string) => {
    try {
      // Fetch profile + role in parallel so we can store them in the row
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('full_name, email').eq('user_id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      ]);

      const { data } = await supabase
        .from('login_activity')
        .insert({
          user_id:     userId,
          logged_in_at: new Date().toISOString(),
          user_name:   profileRes.data?.full_name  ?? null,
          user_email:  profileRes.data?.email      ?? null,
          user_role:   roleRes.data?.role          ?? null,
        })
        .select('id')
        .single();
      if (data?.id) loginRowId.current = data.id;
    } catch {
      // Non-critical — never block the login flow
    }
  };

  // ── Log a logout event ───────────────────────────────────────
  const logLogout = async () => {
    if (!loginRowId.current) return;
    try {
      await supabase
        .from('login_activity')
        .update({ logged_out_at: new Date().toISOString() })
        .eq('id', loginRowId.current);
      loginRowId.current = null;
    } catch {
      // Non-critical
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        // logLogin first in the background; never await it so it doesn't block loading state
        logLogin(session.user.id);
        setTimeout(() => fetchProfileAndRole(session.user), 0);
      } else if (event === 'SIGNED_OUT') {
        // logLogout in the background
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
          setUser(session.user);
          // Run logLogin in background, fetchProfileAndRole in foreground
          logLogin(session.user.id);
          await fetchProfileAndRole(session.user);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string, role: AppRole, department?: string, reportsTo?: string) => {
    // Step 1: Create the auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
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
      role: role,
    });

    // Return first error if any, but don't block — auth succeeded
    const combinedError = profileError || roleError;
    if (combinedError) {
      console.warn('Profile/role insert warning (auth succeeded):', combinedError.message);
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, role, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
