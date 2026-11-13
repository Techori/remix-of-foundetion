CREATE OR REPLACE FUNCTION public.crm_validate_write() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ DECLARE linked_owner uuid; BEGIN
IF TG_TABLE_NAME='crm_activities' THEN
 IF NEW.lead_id IS NOT NULL THEN SELECT owner_id INTO linked_owner FROM public.crm_leads WHERE id=NEW.lead_id; IF public.crm_role()='support' THEN RAISE EXCEPTION 'Sales record access denied'; END IF;
 ELSIF NEW.ticket_id IS NOT NULL THEN SELECT owner_id INTO linked_owner FROM public.crm_tickets WHERE id=NEW.ticket_id; ELSE RAISE EXCEPTION 'Activity requires a record'; END IF;
 IF linked_owner IS NULL OR linked_owner<>NEW.owner_id OR NEW.actor_id<>auth.uid() THEN RAISE EXCEPTION 'Invalid activity ownership'; END IF;
ELSIF TG_TABLE_NAME='crm_leads' THEN IF NOT EXISTS(SELECT 1 FROM public.crm_customers WHERE id=NEW.customer_id AND public.crm_can_access(owner_id)) THEN RAISE EXCEPTION 'Customer access denied'; END IF;
ELSIF TG_TABLE_NAME='crm_tickets' THEN IF NOT EXISTS(SELECT 1 FROM public.crm_customers WHERE id=NEW.customer_id AND (public.crm_can_access(owner_id) OR public.crm_role()='support')) THEN RAISE EXCEPTION 'Customer access denied'; END IF;
END IF; RETURN NEW; END $$;
CREATE TRIGGER crm_activity_guard BEFORE INSERT ON public.crm_activities FOR EACH ROW EXECUTE FUNCTION public.crm_validate_write();
CREATE TRIGGER crm_lead_guard BEFORE INSERT OR UPDATE ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION public.crm_validate_write();
CREATE TRIGGER crm_ticket_guard BEFORE INSERT OR UPDATE ON public.crm_tickets FOR EACH ROW EXECUTE FUNCTION public.crm_validate_write();
COMMENT ON TABLE public.crm_memberships IS 'Employee CRM authorization, separate from user-editable profiles; only administrators assign roles and managers.';