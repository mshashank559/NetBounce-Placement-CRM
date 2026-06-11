-- Migration to update historical assignment and reassignment notifications to the new format.

-- 1. Update assignment notifications
UPDATE public.notifications n
SET
  title = 'Lead Assigned',
  message = 'Lead "' || COALESCE(
    (SELECT name FROM public.leads WHERE unique_id = n.lead_id),
    substring(n.message from 'Lead "([^"]+)"'),
    'Lead'
  ) || '" has been assigned from Unassigned Pool to ' || 
  regexp_replace(
    substring(n.message from 'assigned to ([^\.]+)\.?$'),
    '\s*\(.*?\)',
    ''
  ) || ' by System.'
WHERE n.type IN ('lead_assigned', 'assignment')
  AND n.message ~* 'has been assigned to'
  AND n.message !~* 'from';

-- 2. Update reassignment notifications where performer is recipient (You reassigned...)
UPDATE public.notifications n
SET
  title = 'Lead Reassigned',
  message = 'Lead "' || COALESCE(
    (SELECT name FROM public.leads WHERE unique_id = n.lead_id),
    substring(n.message from 'Lead "([^"]+)"'),
    'Lead'
  ) || '" has been reassigned from ' ||
  regexp_replace(substring(n.message from 'from ([^t]+) to'), '\s+$', '') || ' to ' ||
  regexp_replace(substring(n.message from 'to ([^\.]+)\.?$'), '\s*\(.*?\)', '') || ' by ' || 
  COALESCE((SELECT full_name FROM public.profiles WHERE user_id = n.user_id), 'System') || '.'
WHERE n.type = 'reassign'
  AND n.message ~* '^You reassigned';

-- 3. Update other reassignment notifications (reassigned to you from...)
UPDATE public.notifications n
SET
  title = 'Lead Reassigned',
  message = 'Lead "' || COALESCE(
    (SELECT name FROM public.leads WHERE unique_id = n.lead_id),
    substring(n.message from 'Lead "([^"]+)"'),
    'Lead'
  ) || '" has been reassigned from ' ||
  regexp_replace(substring(n.message from 'from ([^\.]+)\.?$'), '\s*\(.*?\)', '') || ' to ' ||
  COALESCE((SELECT full_name FROM public.profiles WHERE user_id = n.user_id), 'You') || ' by System.'
WHERE n.type = 'reassign'
  AND n.message ~* 'has been reassigned to you from';
