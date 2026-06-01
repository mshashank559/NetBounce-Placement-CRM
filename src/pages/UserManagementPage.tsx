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
import { UserPlus, Trash2 } from 'lucide-react';

const ROLES = ['ADMIN', 'PROCESS_ANALYST', 'LEAD_TL', 'LEAD_GEN', 'SALES_TL', 'SALES_TM', 'ACCOUNTANT'] as const;

const UserManagementPage: React.FC = () => {
  const { role } = useAuth();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: '' as string,
    department: '',
    reports_to: '',
  });

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
      if (!form.email || !form.password || !form.full_name || !form.role) {
        throw new Error('All fields are required');
      }
      // Use supabase auth signUp with metadata — the handle_new_user trigger will create profile + role
      const { error } = await supabase.auth.signUp({
        email: form.email,
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Full Name *</Label>
                <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
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
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagementPage;
