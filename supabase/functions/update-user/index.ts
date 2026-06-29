// @ts-nocheck
// supabase/functions/update-user/index.ts
// Edge Function — runs server-side with service_role access
// Allows Admin to update another user's email, password, and full_name
// When password is changed: invalidates ALL active sessions for that user
// and writes an entry to admin_audit_logs.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verify the calling user is an ADMIN via their JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No auth header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service-role client (can do admin auth operations)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Anon client — used only to verify the caller's JWT role
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: callerErr } = await supabaseUser.auth.getUser();
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check caller is ADMIN in user_roles table
    const { data: roleRow } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .single();

    if (roleRow?.role !== 'ADMIN') {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Parse request body
    const { userId, email, password, full_name } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isPasswordChange = !!(password?.trim());

    // 3. Update auth (email and/or password) via admin API
    const authUpdates: Record<string, string> = {};
    if (email?.trim()) authUpdates.email = email.trim();
    if (password?.trim()) authUpdates.password = password.trim();

    if (Object.keys(authUpdates).length > 0) {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdates);
      if (authErr) {
        return new Response(JSON.stringify({ error: authErr.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 4. Update profiles table (full_name and/or email)
    const profileUpdates: Record<string, string> = {};
    if (full_name?.trim()) profileUpdates.full_name = full_name.trim();
    if (email?.trim()) profileUpdates.email = email.trim();

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdates)
        .eq('user_id', userId);

      if (profileErr) {
        return new Response(JSON.stringify({ error: profileErr.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── PASSWORD CHANGE: Force-logout all sessions ─────────────────────────
    if (isPasswordChange) {
      // 5a. Stamp password_reset_at on the target user's profile.
      //     AuthContext polls this field every 30s; if it's newer than the
      //     client's session-start time the user is immediately signed out.
      const resetAt = new Date().toISOString();
      await supabaseAdmin
        .from('profiles')
        .update({ password_reset_at: resetAt })
        .eq('user_id', userId);

      // 5b. Delete all auth.sessions and refresh_tokens for the target user.
      //     This prevents any existing refresh token from minting new JWTs.
      //     We do this directly via service-role SQL since the JS SDK's
      //     auth.admin.signOut() requires an access token, not a user ID.
      await supabaseAdmin.rpc('admin_delete_user_sessions', {
        target_user_id: userId,
      });

      // 5c. Fetch target user's name + role for the audit log
      const [targetProfileRes, targetRoleRes, adminProfileRes] = await Promise.all([
        supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('user_id', userId)
          .maybeSingle(),
        supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle(),
        supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('user_id', caller.id)
          .maybeSingle(),
      ]);

      // 5d. Insert into admin_audit_logs
      await supabaseAdmin.from('admin_audit_logs').insert({
        target_user_id:   userId,
        target_user_name: targetProfileRes.data?.full_name ?? null,
        target_user_role: targetRoleRes.data?.role ?? null,
        admin_id:         caller.id,
        admin_name:       adminProfileRes.data?.full_name ?? null,
        action:           'Password Reset – All Sessions Terminated',
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
