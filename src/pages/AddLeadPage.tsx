import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useNavigate } from 'react-router-dom';

const AddLeadPage: React.FC = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── ROLE GUARD ──────────────────────────────────────────────
  // PROCESS_ANALYST is analytics-only — cannot add leads
  if (role === 'PROCESS_ANALYST') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Access denied — Process Analysts cannot add leads.</p>
      </div>
    );
  }

  const [form, setForm] = useState({
    name: '', email: '', phone: '', university: '', technology: '',
    linkedin_url: '', time_for_call: '', timezone: '',
    lead_category: 'Cold' as 'Hot' | 'Cold',
    lead_type: 'New' as 'New' | 'Reference',
    referee_name: '', lead_source: '', resume_url: '',
    comment: '', concern: false,
  });

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const mutation = useMutation({
    mutationFn: async () => {
      // ── Duplicate check ──────────────────────────────────────
      const { data: emailDup } = await supabase.from('leads').select('unique_id').eq('email', form.email).maybeSingle();
      if (emailDup) throw new Error('A lead with this email already exists');

      const { data: phoneDup } = await supabase.from('leads').select('unique_id').eq('phone', form.phone).maybeSingle();
      if (phoneDup) throw new Error('A lead with this phone number already exists');

      // ── Mandatory field validation ───────────────────────────
      if (!form.technology.trim()) throw new Error('Technology / Domain is mandatory');
      if (!form.lead_source.trim()) throw new Error('Lead Source is mandatory');

      // BD must add comment
      if ((role === 'LEAD_GEN' || role === 'LEAD_TL') && !form.comment.trim()) {
        throw new Error('Comment is mandatory for BD team');
      }

      // ── Auto-generate NBC ID (NBC001, NBC002, ...) ────────────
      const { count: totalLeads } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true });
      const nextNum = (totalLeads ?? 0) + 1;
      const displayId = `NBC${String(nextNum).padStart(3, '0')}`;

      const leadData: any = {
        display_id: displayId,
        name: form.name,
        email: form.email,
        phone: form.phone,
        university: form.university || null,
        technology: form.technology,
        linkedin_url: form.linkedin_url || null,
        time_for_call: form.time_for_call || null,
        timezone: form.timezone || null,
        lead_category: form.lead_category,
        lead_type: form.lead_type,
        referee_name: form.lead_type === 'Reference' ? form.referee_name : null,
        lead_source: form.lead_source,
        resume_url: form.resume_url || null,
        comment: form.comment || null,
        concern: form.concern,
        lead_generated_by: user?.id,
        // Sales auto-assign to self; BD leaves null
        assigned_to: (role === 'SALES_TM' || role === 'SALES_TL') ? user?.id : null,
      };

      const { data: insertedLead, error } = await supabase
        .from('leads')
        .insert(leadData)
        .select('unique_id')
        .single();
      if (error) throw error;
      const leadId = insertedLead.unique_id;

      // ── Create concern entry in database ─────────────────────
      if (form.concern) {
        const { error: concernError } = await supabase
          .from('concerns')
          .insert({
            lead_id: leadId,
            raised_by: user!.id,
            description: form.comment || 'Initial concern raised on lead creation',
            resolved: false,
          });
        if (concernError) throw concernError;
      }

      // ── Notify BD TL when BD member adds a lead ──────────────
      if (role === 'LEAD_GEN') {
        const { data: bdTLs } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'LEAD_TL');

        if (bdTLs && bdTLs.length > 0) {
          const notifs = bdTLs.map(tl => ({
            user_id: tl.user_id,
            title: 'New Lead Added',
            message: `New lead "${form.name}" added. Please review and assign.`,
            type: 'new_lead',
            lead_id: leadId,
          }));
          await supabase.from('notifications').insert(notifs);
        }
      }

      // ── Notify BD TL, ADMIN, PA when concern is raised ───────
      if (form.concern) {
        const { data: targets } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', ['ADMIN', 'LEAD_TL', 'PROCESS_ANALYST']);

        if (targets && targets.length > 0) {
          const concernNotifs = targets.map(t => ({
            user_id: t.user_id,
            title: '⚠️ Concern Raised',
            message: `A concern has been raised while adding lead "${form.name}". Please review.`,
            type: 'concern',
            lead_id: leadId,
          }));
          await supabase.from('notifications').insert(concernNotifs);
        }
      }

      // ── Notify Process Analyst when lead is added ─────────────
      const { data: analysts } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'PROCESS_ANALYST');

      if (analysts && analysts.length > 0) {
        await supabase.from('notifications').insert(
          analysts.map(a => ({
            user_id: a.user_id,
            title: 'New Lead Added',
            message: `Lead "${form.name}" was added to the system.`,
            type: 'lead_added',
            lead_id: leadId,
          }))
        );
      }
    },
    onSuccess: () => {
      toast.success('Lead added successfully!');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-leads'] });
      navigate('/leads');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="font-display text-xl">Add New Lead</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Candidate Name" />
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} required placeholder="email@example.com" />
              </div>
              <div>
                <Label>Phone *</Label>
                <Input value={form.phone} onChange={e => set('phone', e.target.value)} required placeholder="+1 234 567 8901" />
              </div>
              <div>
                <Label>University</Label>
                <Input value={form.university} onChange={e => set('university', e.target.value)} placeholder="University Name" />
              </div>
              <div>
                <Label>Technology / Domain *</Label>
                <Input value={form.technology} onChange={e => set('technology', e.target.value)} required placeholder="Data Analyst, ML, etc." />
              </div>
              <div>
                <Label>LinkedIn Profile</Label>
                <Input value={form.linkedin_url} onChange={e => set('linkedin_url', e.target.value)} placeholder="https://linkedin.com/in/..." />
              </div>
              <div>
                <Label>Time for Call</Label>
                <Input value={form.time_for_call} onChange={e => set('time_for_call', e.target.value)} placeholder="e.g. 3:00 PM" />
              </div>
              <div>
                <Label>Timezone</Label>
                <Select value={form.timezone} onValueChange={v => set('timezone', v)}>
                  <SelectTrigger><SelectValue placeholder="Select timezone" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PST">PST</SelectItem>
                    <SelectItem value="MST">MST</SelectItem>
                    <SelectItem value="CST">CST</SelectItem>
                    <SelectItem value="EST">EST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Lead Category</Label>
                <Select value={form.lead_category} onValueChange={v => set('lead_category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hot">Hot</SelectItem>
                    <SelectItem value="Cold">Cold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Lead Type</Label>
                <Select value={form.lead_type} onValueChange={v => set('lead_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Reference">Reference</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.lead_type === 'Reference' && (
                <div>
                  <Label>Candidate Name (Referee)</Label>
                  <Input value={form.referee_name} onChange={e => set('referee_name', e.target.value)} placeholder="Referee name" />
                </div>
              )}
              <div>
                <Label>Lead Source *</Label>
                <Input value={form.lead_source} onChange={e => set('lead_source', e.target.value)} required placeholder="LinkedIn, OPT Nation, etc." />
              </div>
            </div>

            <div>
              <Label>Resume URL</Label>
              <Input value={form.resume_url} onChange={e => set('resume_url', e.target.value)} placeholder="Link to resume" />
            </div>

            <div>
              <Label>Comment {(role === 'LEAD_GEN' || role === 'LEAD_TL') && '*'}</Label>
              <Textarea
                value={form.comment}
                onChange={e => set('comment', e.target.value)}
                placeholder="Add your notes..."
                required={role === 'LEAD_GEN' || role === 'LEAD_TL'}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={form.concern}
                onCheckedChange={v => set('concern', !!v)}
                id="concern"
              />
              <Label htmlFor="concern" className="text-sm">Raise a Concern</Label>
            </div>

            <Button type="submit" className="w-full nb-gradient" disabled={mutation.isPending}>
              {mutation.isPending ? 'Adding...' : 'Add Lead'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default AddLeadPage;
