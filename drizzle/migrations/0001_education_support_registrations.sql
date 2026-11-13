CREATE SEQUENCE public.education_support_ack_seq;

CREATE TABLE public.education_support_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ack_number text NOT NULL UNIQUE DEFAULT ('SCH-' || to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYY') || '-' || lpad(nextval('public.education_support_ack_seq')::text, 8, '0')),
  student_category text NOT NULL CHECK (student_category IN ('school', 'ug', 'pg')),
  current_class text,
  course_name text,
  education_sector text,
  institution_name text NOT NULL,
  education jsonb NOT NULL DEFAULT '{}'::jsonb,
  student_name text NOT NULL,
  father_name text NOT NULL,
  mother_name text NOT NULL,
  date_of_birth date NOT NULL,
  gender text NOT NULL,
  nationality text NOT NULL DEFAULT 'Indian',
  mobile text NOT NULL,
  whatsapp text,
  email text NOT NULL,
  permanent_address text NOT NULL,
  current_address text NOT NULL,
  state text NOT NULL,
  district text NOT NULL,
  city text NOT NULL,
  pin_code text NOT NULL,
  is_minor boolean NOT NULL DEFAULT false,
  guardian_name text,
  guardian_mobile text,
  guardian_email text,
  guardian_relationship text,
  guardian_consent_at timestamptz,
  without_coordinator boolean NOT NULL DEFAULT false,
  coordinator jsonb NOT NULL DEFAULT '{}'::jsonb,
  coordinator_code text,
  coordinator_id uuid REFERENCES public.coordinators(id) ON DELETE SET NULL,
  application_type text NOT NULL CHECK (application_type IN ('sponsorship', 'scholarship_25k', 'scholarship_50k')),
  registration_fee integer NOT NULL CHECK (registration_fee > 0),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'reference_submitted', 'paid', 'failed')),
  payment_reference text,
  payment_reference_at timestamptz,
  receipt_token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_verification', 'incomplete_documents', 'verified', 'eligible', 'not_eligible', 'selected', 'not_selected')),
  status_reason text NOT NULL DEFAULT '',
  declarations jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX education_support_registrations_created_idx ON public.education_support_registrations (created_at DESC);

GRANT SELECT, UPDATE ON public.education_support_registrations TO authenticated;
GRANT ALL ON public.education_support_registrations TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.education_support_ack_seq TO service_role;

ALTER TABLE public.education_support_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read education support registrations" ON public.education_support_registrations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins review education support registrations" ON public.education_support_registrations
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_education_support_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER education_support_registrations_touch
  BEFORE UPDATE ON public.education_support_registrations
  FOR EACH ROW EXECUTE FUNCTION public.touch_education_support_updated_at();