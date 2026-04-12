DROP POLICY "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'ADMIN')
    OR public.has_role(auth.uid(), 'LEAD_TL')
    OR public.has_role(auth.uid(), 'SALES_TL')
    OR auth.uid() IS NOT NULL
  );