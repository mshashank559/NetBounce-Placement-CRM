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
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface EditLeadDialogProps {
  open: boolean;
  onClose: () => void;
  lead: any;
  queryKeys?: any[][];
}

const EditLeadDialog: React.FC<EditLeadDialogProps> = ({ open, onClose, lead, queryKeys = [['leads']] }) => {
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
  });

  useEffect(() => {
    if (lead) {
      setFormData({
        name: lead.name || '',
        email: lead.email || '',
        phone: lead.phone || '',
        technology: lead.technology || '',
        lead_status: lead.lead_status || 'New',
        lead_category: lead.lead_category || '',
        lead_source: lead.lead_source || '',
        linkedin_url: lead.linkedin_url || '',
        university: lead.university || '',
      });
    }
  }, [lead, open]);

  const updateLeadMutation = useMutation({
    mutationFn: async (updatedData: typeof formData) => {
      if (!lead?.unique_id) throw new Error('Lead ID is missing');

      // Prepare fields to update
      const updateFields: any = {
        name: updatedData.name,
        email: updatedData.email,
        phone: updatedData.phone,
        technology: updatedData.technology || null,
        lead_status: updatedData.lead_status as any,
        lead_category: (updatedData.lead_category || null) as any,
        lead_source: updatedData.lead_source || null,
        linkedin_url: updatedData.linkedin_url || null,
        university: updatedData.university || null,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('leads')
        .update(updateFields)
        .eq('unique_id', lead.unique_id);

      if (updateError) throw updateError;

      // Track changes in lead_history_logs
      const changes: string[] = [];
      if (lead.name !== updatedData.name) changes.push(`Name: "${lead.name}" -> "${updatedData.name}"`);
      if (lead.email !== updatedData.email) changes.push(`Email: "${lead.email}" -> "${updatedData.email}"`);
      if (lead.phone !== updatedData.phone) changes.push(`Phone: "${lead.phone}" -> "${updatedData.phone}"`);
      if (lead.technology !== updatedData.technology) changes.push(`Tech: "${lead.technology}" -> "${updatedData.technology}"`);
      if (lead.lead_status !== updatedData.lead_status) changes.push(`Status: "${lead.lead_status}" -> "${updatedData.lead_status}"`);
      if (lead.lead_category !== updatedData.lead_category) changes.push(`Category: "${lead.lead_category}" -> "${updatedData.lead_category}"`);
      if (lead.lead_source !== updatedData.lead_source) changes.push(`Source: "${lead.lead_source}" -> "${updatedData.lead_source}"`);

      if (changes.length > 0 && user?.id) {
        await supabase.from('lead_history_logs').insert({
          lead_id: lead.unique_id,
          changed_by: user.id,
          action_type: 'LEAD_EDIT',
          old_value: lead.lead_status,
          new_value: updatedData.lead_status,
          comments: `Edited fields: ${changes.join(', ')}`,
        });

        try {
          // Fetch profiles and user roles to calculate recipients
          const { data: allProfiles } = await supabase
            .from('profiles')
            .select('user_id, reports_to, full_name');
          const { data: allUserRoles } = await supabase
            .from('user_roles')
            .select('user_id, role');

          const profilesMap = new Map(allProfiles?.map(p => [p.user_id, p]) || []);
          const rolesMap = new Map(allUserRoles?.map(r => [r.user_id, r.role]) || []);

          const currentRole = rolesMap.get(user.id);

          // Resolve Admin & PA IDs
          const adminAndPAIds = allUserRoles
            ?.filter(r => r.role === 'ADMIN' || r.role === 'PROCESS_ANALYST')
            .map(r => r.user_id) || [];

          // Resolve lead roles
          const assignedSalesTM = lead.assigned_to;
          
          let assignedSalesTL = lead.team_lead_id;
          if (!assignedSalesTL && assignedSalesTM) {
            assignedSalesTL = profilesMap.get(assignedSalesTM)?.reports_to || null;
          }

          const bdMember = lead.lead_generated_by;
          let bdTL = null;
          if (bdMember) {
            const bdMemberRole = rolesMap.get(bdMember);
            if (bdMemberRole === 'LEAD_TL') {
              bdTL = bdMember;
            } else {
              bdTL = profilesMap.get(bdMember)?.reports_to || null;
            }
          }

          const recipients = new Set<string>();

          // Always add Admins and Process Analysts
          adminAndPAIds.forEach(id => recipients.add(id));

          if (currentRole === 'SALES_TL' || currentRole === 'SALES_TM') {
            // Sales person or Sales TL edits lead:
            if (assignedSalesTM) recipients.add(assignedSalesTM);
            if (assignedSalesTL) recipients.add(assignedSalesTL);
            if (bdTL) recipients.add(bdTL); // Also notify BD TL
          } else if (currentRole === 'LEAD_TL') {
            // BD TL edits lead:
            if (assignedSalesTM) recipients.add(assignedSalesTM);
            if (assignedSalesTL) recipients.add(assignedSalesTL);
            if (bdMember) recipients.add(bdMember);
          } else {
            // Admin or Process Analyst edits: notify all
            if (assignedSalesTM) recipients.add(assignedSalesTM);
            if (assignedSalesTL) recipients.add(assignedSalesTL);
            if (bdMember) recipients.add(bdMember);
            if (bdTL) recipients.add(bdTL);
          }

          // Exclude the editor themselves
          recipients.delete(user.id);

          if (recipients.size > 0) {
            const editorName = profilesMap.get(user.id)?.full_name || 'Someone';
            const notificationMessage = `"${lead.name}" details edited by ${editorName}. Changes: ${changes.join(', ')}`;
            
            const notifInserts = Array.from(recipients).map(uid => ({
              user_id: uid,
              title: '✏️ Lead Details Edited',
              message: notificationMessage,
              type: 'lead_edit',
              lead_id: lead.unique_id,
              read: false
            }));

            await supabase
              .from('notifications')
              .insert(notifInserts);
          }
        } catch (err) {
          console.error('Error sending edit notifications:', err);
        }
      }
    },
    onSuccess: () => {
      toast.success('Lead updated successfully');
      // Invalidate queries to refresh lists
      queryKeys.forEach((qk) => {
        queryClient.invalidateQueries({ queryKey: qk });
      });
      onClose();
    },
    onError: (error: any) => {
      console.error('Error updating lead:', error);
      toast.error(error.message || 'Failed to update lead');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!formData.email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!formData.phone.trim()) {
      toast.error('Phone number is required');
      return;
    }
    updateLeadMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            Edit Lead Details
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter client name"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email Address *</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter email address"
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone Number *</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Enter phone number"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tech">Technology</Label>
              <Input
                id="edit-tech"
                value={formData.technology}
                onChange={(e) => setFormData({ ...formData, technology: e.target.value })}
                placeholder="e.g. Java, React, Python"
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-status">Lead Status</Label>
              <Select
                value={formData.lead_status}
                onValueChange={(val) => setFormData({ ...formData, lead_status: val })}
              >
                <SelectTrigger id="edit-status" className="w-full">
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
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category">Lead Category</Label>
              <Select
                value={formData.lead_category}
                onValueChange={(val) => setFormData({ ...formData, lead_category: val })}
              >
                <SelectTrigger id="edit-category" className="w-full">
                  <SelectValue placeholder="Select Category (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hot">Hot</SelectItem>
                  <SelectItem value="Cold">Cold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-source">Lead Source</Label>
              <Input
                id="edit-source"
                value={formData.lead_source}
                onChange={(e) => setFormData({ ...formData, lead_source: e.target.value })}
                placeholder="e.g. LinkedIn, Portal, Referral"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-linkedin">LinkedIn URL</Label>
              <Input
                id="edit-linkedin"
                value={formData.linkedin_url}
                onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                placeholder="https://linkedin.com/in/username"
                className="w-full"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-university">University</Label>
            <Input
              id="edit-university"
              value={formData.university}
              onChange={(e) => setFormData({ ...formData, university: e.target.value })}
              placeholder="Enter University/College name"
              className="w-full"
            />
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
