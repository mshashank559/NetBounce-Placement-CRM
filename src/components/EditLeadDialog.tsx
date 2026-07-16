import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { normalizeSource } from '@/lib/leads';

interface EditLeadDialogProps {
  open: boolean;
  onClose: () => void;
  lead: any;
  queryKeys?: any[][];
}

// Normalize DB value (null / undefined → '') for comparison
const norm = (v: any): string => (v === null || v === undefined ? '' : String(v));

const EditLeadDialog: React.FC<EditLeadDialogProps> = ({
  open,
  onClose,
  lead,
  queryKeys = [['leads']],
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    technology: '',
    lead_status: '',
    lead_category: '',
    lead_source: '',
    linkedin_url: '',
    university: '',
    visa_status: '',
    next_followup_date: '',
  });

  // Reset form whenever dialog opens with a new lead
  useEffect(() => {
    if (lead && open) {
      setFormData({
        name: norm(lead.name),
        email: norm(lead.email),
        phone: norm(lead.phone),
        technology: norm(lead.technology),
        lead_status: norm(lead.lead_status) || 'New',
        lead_category: norm(lead.lead_category),
        lead_source: norm(lead.lead_source),
        linkedin_url: norm(lead.linkedin_url),
        university: norm(lead.university),
        visa_status: norm(lead.visa_status),
        next_followup_date: norm(lead.next_followup_date),
      });
    }
  }, [lead, open]);

  const updateLeadMutation = useMutation({
    mutationFn: async (updatedData: typeof formData) => {
      if (!lead?.unique_id) throw new Error('Lead ID is missing');
      if (!user?.id) throw new Error('User not authenticated');

      // ── 1. Detect actual changes (null-safe) ─────────────────────
      const changes: string[] = [];
      const trimmedEmail = updatedData.email.replace(/['"]/g, '').trim();
      if (norm(lead.name) !== updatedData.name)
        changes.push(`Name: "${norm(lead.name)}" → "${updatedData.name}"`);
      if (norm(lead.email) !== trimmedEmail)
        changes.push(`Email: "${norm(lead.email)}" → "${trimmedEmail}"`);
      if (norm(lead.phone) !== updatedData.phone)
        changes.push(`Phone: "${norm(lead.phone)}" → "${updatedData.phone}"`);
      if (norm(lead.technology) !== updatedData.technology)
        changes.push(`Technology: "${norm(lead.technology)}" → "${updatedData.technology}"`);
      if (norm(lead.lead_status) !== updatedData.lead_status)
        changes.push(`Status: "${norm(lead.lead_status)}" → "${updatedData.lead_status}"`);
      if (norm(lead.lead_category) !== updatedData.lead_category)
        changes.push(`Category: "${norm(lead.lead_category)}" → "${updatedData.lead_category}"`);
      const oldSourceNormalized = normalizeSource(lead.lead_source);
      const newSourceNormalized = normalizeSource(updatedData.lead_source);
      if (oldSourceNormalized !== newSourceNormalized)
        changes.push(`Source: "${oldSourceNormalized}" → "${newSourceNormalized}"`);
      if (norm(lead.linkedin_url) !== updatedData.linkedin_url)
        changes.push(`LinkedIn: "${norm(lead.linkedin_url)}" → "${updatedData.linkedin_url}"`);
      if (norm(lead.university) !== updatedData.university)
        changes.push(`University: "${norm(lead.university)}" → "${updatedData.university}"`);
      if (norm(lead.visa_status) !== updatedData.visa_status)
        changes.push(`Visa Status: "${norm(lead.visa_status)}" → "${updatedData.visa_status}"`);
      if (norm(lead.next_followup_date) !== updatedData.next_followup_date)
        changes.push(`Next Follow-Up Date: "${norm(lead.next_followup_date)}" → "${updatedData.next_followup_date}"`);

      // Nothing actually changed — skip DB write
      if (changes.length === 0) return;

      // ── 2. Update the lead ────────────────────────────────────────
      const { error: updateError } = await supabase
          .from('leads')
          .update({
            name: updatedData.name,
            email: trimmedEmail,
            phone: updatedData.phone,
            technology: updatedData.technology || null,
            lead_status: updatedData.lead_status as any,
            lead_category: (updatedData.lead_category || null) as any,
            lead_source: updatedData.lead_source ? normalizeSource(updatedData.lead_source) : null,
            linkedin_url: updatedData.linkedin_url || null,
            university: updatedData.university || null,
            visa_status: updatedData.visa_status || null,
            next_followup_date: updatedData.next_followup_date || null,
            updated_at: new Date().toISOString(),
          })
          .eq('unique_id', lead.unique_id);

      if (updateError) throw updateError;

      // ── 3. Log to history ─────────────────────────────────────────
      await supabase.from('lead_history_logs').insert({
        lead_id: lead.unique_id,
        changed_by: user.id,
        action_type: 'LEAD_EDIT',
        old_value: norm(lead.lead_status),
        new_value: updatedData.lead_status,
        comments: `Edited fields: ${changes.join(' | ')}`,
      });

      // ── 4. Send targeted notifications ────────────────────────────
      try {
        // Fetch all profiles (user_id, reports_to, full_name)
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('user_id, reports_to, full_name');

        // Fetch all user roles
        const { data: allUserRoles } = await supabase
          .from('user_roles')
          .select('user_id, role');

        if (!allProfiles || !allUserRoles) return;

        // Build look-up maps
        const profilesMap = new Map(allProfiles.map(p => [p.user_id, p]));
        const rolesMap = new Map(allUserRoles.map(r => [r.user_id, r.role]));

        // Editor's role
        const currentRole = rolesMap.get(user.id);

        // ── Resolve lead-linked people ──────────────────────────────
        // Sales person assigned to the lead
        const salesPersonId: string | null = lead.assigned_to || null;

        // Sales TL: prefer lead.team_lead_id, fallback to reports_to of assigned person
        let salesTLId: string | null = lead.team_lead_id || null;
        if (!salesTLId && salesPersonId) {
          salesTLId = profilesMap.get(salesPersonId)?.reports_to || null;
        }

        // BD Member who generated the lead
        const bdMemberId: string | null = lead.lead_generated_by || null;

        // BD TL: if the generator IS a LEAD_TL, they are the BD TL;
        //        otherwise look up their reports_to
        let bdTLId: string | null = null;
        if (bdMemberId) {
          const genRole = rolesMap.get(bdMemberId);
          bdTLId =
            genRole === 'LEAD_TL'
              ? bdMemberId
              : profilesMap.get(bdMemberId)?.reports_to || null;
        }

        // All Admin IDs
        const adminIds = allUserRoles
          .filter(r => r.role === 'ADMIN')
          .map(r => r.user_id);

        // All Process Analyst IDs
        const paIds = allUserRoles
          .filter(r => r.role === 'PROCESS_ANALYST')
          .map(r => r.user_id);

        // All BD TL IDs (used as fallback when specific bdTLId cannot be resolved)
        const allBdTLIds = allUserRoles
          .filter(r => r.role === 'LEAD_TL')
          .map(r => r.user_id);

        // Helper: add the specific BD TL if known, otherwise notify all BD TLs
        const addBdTLRecipients = (set: Set<string>) => {
          if (bdTLId) {
            set.add(bdTLId);
          } else {
            // lead_generated_by is missing — notify all BD TLs as fallback
            allBdTLIds.forEach(id => set.add(id));
          }
        };

        // ── Build recipient set based on editor's role ─────────────
        const recipients = new Set<string>();

        if (currentRole === 'SALES_TL') {
          // Sales TL edits → Sales Member + BD TL (all BD TLs if unknown) + Process Analysts + Admins
          if (salesPersonId) recipients.add(salesPersonId);
          addBdTLRecipients(recipients);
          paIds.forEach(id => recipients.add(id));
          adminIds.forEach(id => recipients.add(id));

        } else if (currentRole === 'LEAD_TL') {
          // BD TL edits → Sales Member + Sales TL (who salesperson reports to) + Process Analysts + Admins
          if (salesPersonId) recipients.add(salesPersonId);
          if (salesTLId) recipients.add(salesTLId);
          paIds.forEach(id => recipients.add(id));
          adminIds.forEach(id => recipients.add(id));

        } else if (currentRole === 'ADMIN') {
          // Admin edits → Sales Member + Sales TL + BD TL (all BD TLs if unknown) + Process Analysts
          if (salesPersonId) recipients.add(salesPersonId);
          if (salesTLId) recipients.add(salesTLId);
          addBdTLRecipients(recipients);
          paIds.forEach(id => recipients.add(id));

        } else if (currentRole === 'PROCESS_ANALYST') {
          // Process Analyst edits → Sales Member + Sales TL + BD TL (all BD TLs if unknown) + Admins
          if (salesPersonId) recipients.add(salesPersonId);
          if (salesTLId) recipients.add(salesTLId);
          addBdTLRecipients(recipients);
          adminIds.forEach(id => recipients.add(id));

        } else {
          // Fallback for any other role: notify Admins + PAs
          paIds.forEach(id => recipients.add(id));
          adminIds.forEach(id => recipients.add(id));
        }

        // Never notify the person who made the edit
        recipients.delete(user.id);

        if (recipients.size === 0) return;

        // ── Insert notifications ───────────────────────────────────
        const editorName =
          profilesMap.get(user.id)?.full_name || 'Someone';
        const notifMessage =
          `"${lead.name}" details edited by ${editorName}. Changes: ${changes.join(' | ')}`;

        const notifRows = Array.from(recipients).map(uid => ({
          user_id: uid,
          title: '✏️ Lead Details Edited',
          message: notifMessage,
          type: 'lead_edit',
          lead_id: lead.unique_id,
        }));

        const { error: notifError } = await supabase
          .from('notifications')
          .insert(notifRows);

        if (notifError) {
          console.error('Notification insert error:', notifError);
        }
      } catch (notifErr) {
        // Notification failures are non-fatal — lead is already saved
        console.error('Error dispatching edit notifications:', notifErr);
      }
    },

    onSuccess: () => {
      toast.success('Lead updated successfully');
      queryKeys.forEach(qk => queryClient.invalidateQueries({ queryKey: qk }));
      
      const globalQueryKeys = [
        ['leads'],
        ['all-leads-admin'],
        ['all-leads-pa'],
        ['sm-leads-paginated'],
        ['sm-leads-stats'],
        ['sales-tl-leads'],
        ['salestl-leads'],
        ['all-leads-accountant'],
        ['leads-with-comments']
      ];
      globalQueryKeys.forEach(qk => queryClient.invalidateQueries({ queryKey: qk }));
      
      onClose();
    },

    onError: (error: any) => {
      console.error('Error updating lead:', error);
      toast.error(error.message || 'Failed to update lead');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('Name is required'); return; }
    if (!formData.email.trim()) { toast.error('Email is required'); return; }
    if (!formData.phone.trim()) { toast.error('Phone number is required'); return; }
    
    // Space Detection (check first)
    if (/\s/.test(formData.phone)) {
      toast.error("Please remove spaces from the mobile number.");
      return;
    }
    // Length & Digits Check
    if (/[^\d]/.test(formData.phone) || formData.phone.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }

    updateLeadMutation.mutate({
      ...formData,
      email: formData.email.replace(/['"]/g, '').trim()
    });
  };

  return (
    <Dialog open={open} onOpenChange={val => !val && onClose()}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            Edit Lead Details
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter client name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email Address *</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                onBlur={e => setFormData({ ...formData, email: e.target.value.replace(/['"]/g, '').trim() })}
                placeholder="Enter email address"
              />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone Number *</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Enter phone number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tech">Technology</Label>
              <Input
                id="edit-tech"
                value={formData.technology}
                onChange={e => setFormData({ ...formData, technology: e.target.value })}
                placeholder="e.g. Java, React, Python"
              />
            </div>
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-status">Lead Status</Label>
              <Select
                value={formData.lead_status}
                onValueChange={val => setFormData({ ...formData, lead_status: val })}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="New">New</SelectItem>
                  <SelectItem value="DNR1">DNR1</SelectItem>
                  <SelectItem value="DNR2">DNR2</SelectItem>
                  <SelectItem value="DNR3">DNR3</SelectItem>
                  <SelectItem value="Connected">Connected</SelectItem>
                  <SelectItem value="Qualified">Qualified</SelectItem>
                  <SelectItem value="Hot Prospect">Hot Prospect</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                  <SelectItem value="Non Interested">Non Interested</SelectItem>
                  <SelectItem value="Stagnant">Stagnant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category">Lead Category</Label>
              <Select
                value={formData.lead_category}
                onValueChange={val => setFormData({ ...formData, lead_category: val })}
              >
                <SelectTrigger id="edit-category">
                  <SelectValue placeholder="Select Category (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hot">Hot</SelectItem>
                  <SelectItem value="Cold">Cold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 4 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-source">Lead Source</Label>
              <Input
                id="edit-source"
                value={formData.lead_source}
                onChange={e => setFormData({ ...formData, lead_source: e.target.value })}
                placeholder="e.g. LinkedIn, Portal, Referral"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-visa">Visa Status</Label>
              <Input
                id="edit-visa"
                value={formData.visa_status}
                onChange={e => setFormData({ ...formData, visa_status: e.target.value })}
                placeholder="Enter visa status"
              />
            </div>
          </div>

          {/* Row 5 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-linkedin">LinkedIn URL</Label>
              <Input
                id="edit-linkedin"
                value={formData.linkedin_url}
                onChange={e => setFormData({ ...formData, linkedin_url: e.target.value })}
                placeholder="https://linkedin.com/in/username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-university">University</Label>
              <Input
                id="edit-university"
                value={formData.university}
                onChange={e => setFormData({ ...formData, university: e.target.value })}
                placeholder="Enter University/College name"
              />
            </div>
          </div>

          {/* Row 6 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-next-followup">Next Follow-Up Date</Label>
              <Input
                id="edit-next-followup"
                type="date"
                value={formData.next_followup_date}
                onChange={e => setFormData({ ...formData, next_followup_date: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={updateLeadMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateLeadMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {updateLeadMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditLeadDialog;
