import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { UserPlus, Trash2, Pencil } from 'lucide-react';

const ROLES = ['ADMIN', 'PROCESS_ANALYST', 'LEAD_TL', 'LEAD_GEN', 'SALES_TL', 'SALES_TM', 'ACCOUNTANT'] as const;

const UserManagementPage: React.FC = () => {
  const { role } = useAuth();
  const queryClient = useQueryClient();

  // ── Create user form state ─────────────────────────────────
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: '' as string,
    department: '',
    reports_to: '',
  });

  // ── Edit user state ────────────────────────────────────────
  const [editUser, setEditUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', password: '' });
  const [isSaving, setIsSaving] = useState(false);

  const { data: users } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      const { data: profiles } = await supabase.from('profiles').select('*');
      const { data: roles } = await supabase.from('user_roles').select('*');
      const roleMap: Record<string, string> = {};
      roles?.forEach(r => { roleMap[r.user_id] = r.role; });
      return profiles?.map(p => ({ 
        ...p, 
        role: roleMap[p.user_id] || 'Unknown',
        reports_to_name: profiles.find(rp => rp.user_id === p.reports_to)?.full_name || '—'
      })) || [];
    },
  });

  const { data: teamLeads } = useQuery({
    queryKey: ['team-leads'],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'SALES_TL');
      if (!roles) return [];
      const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', roles.map(r => r.user_id));
      return profiles || [];
    }
  });

  const createUser = useMutation({
    mutationFn: async () => {
      const cleanedEmail = form.email.replace(/['"]/g, '').trim();
      if (!cleanedEmail || !form.password || !form.full_name || !form.role) {
        throw new Error('All fields are required');
      }
      // Use supabase auth signUp with metadata — the handle_new_user trigger will create profile + role
      const { error } = await supabase.auth.signUp({
        email: cleanedEmail,
        password: form.password,
        options: {
          data: {
            full_name: form.full_name,
            role: form.role,
            department: form.department,
            reports_to: form.reports_to || null,
          },
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('User created successfully! They need to verify their email.');
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      setForm({ email: '', password: '', full_name: '', role: '', department: '', reports_to: '' });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Open edit dialog ───────────────────────────────────────
  const handleEditOpen = (u: any) => {
    setEditUser(u);
    setEditForm({ full_name: u.full_name || '', email: u.email || '', password: '' });
  };

  // ── Save edited user ───────────────────────────────────────
  const handleEditSave = async () => {
    if (!editUser) return;
    if (!editForm.full_name.trim() && !editForm.email.trim() && !editForm.password.trim()) {
      toast.error('Please fill in at least one field to update.');
      return;
    }
    setIsSaving(true);
    try {
      // Call the update_user_by_admin RPC — this handles email/name/password updates
      // AND, when a password is supplied, deletes all active sessions + writes audit log.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('update_user_by_admin', {
        target_user_id: editUser.user_id,
        new_full_name:  editForm.full_name.trim()  || null,
        new_email:      editForm.email.replace(/['"]/g, '').trim() || null,
        new_password:   editForm.password.trim()    || null,
      });
      if (error) throw new Error(error.message);

      const isPasswordChange = !!editForm.password.trim();
      toast.success(
        isPasswordChange
          ? 'Password reset successfully. The user has been signed out of all devices.'
          : 'User updated successfully!'
      );
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      setEditUser(null);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update user');
    } finally {
      setIsSaving(false);
    }
  };

  if (role !== 'ADMIN') {
    return <div className="text-center text-muted-foreground p-8">Access denied</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">User Management</h1>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Create New User
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={e => { e.preventDefault(); createUser.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Full Name *</Label>
                <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  onBlur={e => setForm(f => ({ ...f, email: e.target.value.replace(/['"]/g, '').trim() }))}
                  required
                />
              </div>
              <div>
                <Label>Password *</Label>
                <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6} />
              </div>
              <div>
                <Label>Role *</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => (
                      <SelectItem key={r} value={r}>{r.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Department</Label>
                <Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Optional" />
              </div>
              {form.role === 'SALES_TM' && (
                <div>
                  <Label>Reports To (Sales TL) *</Label>
                  <Select value={form.reports_to} onValueChange={v => setForm(f => ({ ...f, reports_to: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select Team Lead" /></SelectTrigger>
                    <SelectContent>
                      {teamLeads?.map(tl => (
                        <SelectItem key={tl.user_id} value={tl.user_id}>{tl.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <Button type="submit" className="nb-gradient" disabled={createUser.isPending}>
              {createUser.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-display">All Users ({users?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Role</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Department</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Reports To</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((u, i) => (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border/50 hover:bg-accent/30 transition-colors"
                  >
                    <td className="p-3 font-medium">{u.full_name}</td>
                    <td className="p-3 text-muted-foreground">{u.email}</td>
                    <td className="p-3">
                      <Badge variant="secondary">{u.role}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">{u.department || '—'}</td>
                    <td className="p-3 text-muted-foreground">{u.reports_to_name}</td>
                    <td className="p-3">
                      <button
                        onClick={() => handleEditOpen(u)}
                        className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-primary"
                        title="Edit user"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Edit User Dialog ──────────────────────────────────── */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Edit User — {editUser?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Full Name</Label>
              <Input
                value={editForm.full_name}
                onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Enter new name"
              />
            </div>
            <div>
              <Label>Email Address</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                onBlur={e => setEditForm(f => ({ ...f, email: e.target.value.replace(/['"]/g, '').trim() }))}
                placeholder="Enter new email"
              />
              <p className="text-xs text-muted-foreground mt-1">This updates their login email. All existing data stays mapped automatically.</p>
            </div>
            <div>
              <Label>New Password</Label>
              <Input
                type="password"
                value={editForm.password}
                onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Leave blank to keep current password"
                minLength={6}
              />
              <p className="text-xs text-muted-foreground mt-1">Only fill this if you want to reset their password.</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditUser(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button className="nb-gradient" onClick={handleEditSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagementPage;
