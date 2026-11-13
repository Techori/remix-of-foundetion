CREATE TABLE public.education_district_codes (state_code text NOT NULL, district_key text NOT NULL, district_name text NOT NULL, code integer NOT NULL, PRIMARY KEY(state_code,district_key), UNIQUE(state_code,code), CONSTRAINT district_code_range CHECK(code BETWEEN 1 AND 99));
GRANT SELECT ON public.education_district_codes TO authenticated;
GRANT ALL ON public.education_district_codes TO service_role;
ALTER TABLE public.education_district_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin reads district codes" ON public.education_district_codes FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
ALTER TABLE public.education_support_registrations ADD COLUMN IF NOT EXISTS private_details_ciphertext text, ADD COLUMN IF NOT EXISTS aadhaar_last_four text, ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending', ADD COLUMN IF NOT EXISTS approved_by uuid, ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.education_support_registrations ADD CONSTRAINT education_approval_values CHECK(approval_status IN ('pending','approved','rejected'));
CREATE SEQUENCE public.education_student_serial_seq MINVALUE 1 MAXVALUE 99999 NO CYCLE;
SELECT setval('public.education_student_serial_seq', GREATEST(1,(SELECT count(*)+1 FROM public.education_support_registrations)), false);
CREATE OR REPLACE FUNCTION public.assign_education_ack_number() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE states text[] := ARRAY['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry']; sc text; dc integer; sn bigint; dk text;
BEGIN
 sc := lpad(array_position(states,NEW.state)::text,2,'0'); IF sc IS NULL THEN RAISE EXCEPTION 'Invalid state'; END IF;
 dk := lower(regexp_replace(trim(NEW.district),'\s+',' ','g'));
 PERFORM pg_advisory_xact_lock(hashtext('education-district-' || sc));
 SELECT code INTO dc FROM public.education_district_codes WHERE state_code=sc AND district_key=dk;
 IF dc IS NULL THEN SELECT COALESCE(max(code),0)+1 INTO dc FROM public.education_district_codes WHERE state_code=sc; IF dc>99 THEN RAISE EXCEPTION 'District code capacity reached'; END IF; INSERT INTO public.education_district_codes VALUES(sc,dk,trim(NEW.district),dc); END IF;
 sn := nextval('public.education_student_serial_seq');
 NEW.ack_number := to_char(NEW.created_at AT TIME ZONE 'Asia/Kolkata','YYMMDD') || sc || lpad(dc::text,2,'0') || lpad(sn::text,5,'0'); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.assign_education_ack_number() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER assign_education_ack BEFORE INSERT ON public.education_support_registrations FOR EACH ROW EXECUTE FUNCTION public.assign_education_ack_number();
CREATE OR REPLACE FUNCTION public.guard_education_approval() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NEW.approval_status='approved' AND NEW.payment_status<>'paid' THEN RAISE EXCEPTION 'Confirm payment before approval'; END IF;
 IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN NEW.approved_by:=auth.uid(); NEW.approved_at:=now(); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_education_approval BEFORE UPDATE ON public.education_support_registrations FOR EACH ROW EXECUTE FUNCTION public.guard_education_approval();
CREATE TABLE public.education_staff_access (user_id uuid PRIMARY KEY, designation text NOT NULL CHECK(designation IN ('BDE','BDM')), manager_id uuid, referral_code text NOT NULL UNIQUE, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.education_staff_access TO authenticated;
GRANT ALL ON public.education_staff_access TO service_role;
ALTER TABLE public.education_staff_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages education staff" ON public.education_staff_access FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE POLICY "Staff reads own access" ON public.education_staff_access FOR SELECT TO authenticated USING(user_id=auth.uid());