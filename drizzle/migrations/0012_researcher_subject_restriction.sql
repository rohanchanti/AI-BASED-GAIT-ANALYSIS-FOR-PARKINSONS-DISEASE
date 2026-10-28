CREATE POLICY "Researchers cannot read identifiable subjects"
ON public.subjects AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  NOT public.has_role(auth.uid(), 'researcher'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'clinician'::public.app_role)
);
CREATE POLICY "Clinicians see only own subjects"
ON public.subjects AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  NOT public.has_role(auth.uid(), 'clinician'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR owner_id = auth.uid()
);