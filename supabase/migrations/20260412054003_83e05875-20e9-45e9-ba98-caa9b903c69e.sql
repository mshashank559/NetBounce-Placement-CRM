-- Create role enum
CREATE TYPE public.app_role AS ENUM ('ADMIN', 'PROCESS_ANALYST', 'LEAD_TL', 'LEAD_GEN', 'SALES_TL', 'SALES_TM');

-- Create lead status enum
CREATE TYPE public.lead_status AS ENUM ('New', 'DNR1', 'DNR2', 'DNR3', 'Connected', 'Qualified', 'Hot Prospect', 'Closed', 'Non Interested');

-- Create lead category enum
CREATE TYPE public.lead_category AS ENUM ('Hot', 'Cold');

-- Create lead type enum
CREATE TYPE public.lead_type AS ENUM ('New', 'Reference');

-- Create plan enum
CREATE TYPE public.plan_type AS ENUM ('Starter', 'Premium', 'Elite');

-- Create payment mode enum
CREATE TYPE public.payment_mode AS ENUM ('Cash', 'Card', 'UPI', 'Bank Transfer', 'Other');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  department TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Leads table
CREATE TABLE public.leads (
  unique_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  university TEXT,
  technology TEXT,
  linkedin_url TEXT,
  time_for_call TEXT,
  timezone TEXT CHECK (timezone IN ('PST', 'MST', 'EST', 'CST')),
  lead_category lead_category DEFAULT 'Cold',
  lead_type lead_type DEFAULT 'New',
  referee_name TEXT,
  lead_source TEXT,
  resume_url TEXT,
  comment TEXT,
  concern BOOLEAN DEFAULT false,
  lead_status lead_status DEFAULT 'New',
  lead_generated_by UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  highlight_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lead closures table
CREATE TABLE public.lead_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(unique_id) ON DELETE CASCADE,
  plan plan_type NOT NULL,
  interview_plan BOOLEAN NOT NULL DEFAULT false,
  upfront_amount NUMERIC NOT NULL DEFAULT 0,
  slot1 BOOLEAN DEFAULT false,
  slot1_amount NUMERIC,
  slot2 BOOLEAN DEFAULT false,
  slot2_amount NUMERIC,
  payment_mode payment_mode NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Followups table
CREATE TABLE public.followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(unique_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  notes TEXT NOT NULL,
  way_of_contact TEXT CHECK (way_of_contact IN ('Call', 'Email', 'LinkedIn', 'Others')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Call logs table
CREATE TABLE public.call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  lead_id UUID NOT NULL REFERENCES public.leads(unique_id) ON DELETE CASCADE,
  call_date DATE NOT NULL DEFAULT CURRENT_DATE,
  call_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Concerns table
CREATE TABLE public.concerns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(unique_id) ON DELETE CASCADE,
  raised_by UUID NOT NULL REFERENCES auth.users(id),
  description TEXT NOT NULL,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  type TEXT,
  lead_id UUID REFERENCES public.leads(unique_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concerns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get user role function
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Profile policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- User roles policies
CREATE POLICY "Users can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Leads policies
CREATE POLICY "Admins can do anything with leads" ON public.leads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Users can view relevant leads" ON public.leads FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR public.has_role(auth.uid(), 'PROCESS_ANALYST')
    OR public.has_role(auth.uid(), 'LEAD_TL')
    OR public.has_role(auth.uid(), 'SALES_TL')
    OR (public.has_role(auth.uid(), 'LEAD_GEN') AND lead_generated_by = auth.uid())
    OR (public.has_role(auth.uid(), 'SALES_TM') AND (assigned_to = auth.uid() OR lead_generated_by = auth.uid()))
  );

CREATE POLICY "BD and Sales can insert leads" ON public.leads FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'ADMIN')
    OR public.has_role(auth.uid(), 'LEAD_GEN')
    OR public.has_role(auth.uid(), 'LEAD_TL')
    OR public.has_role(auth.uid(), 'SALES_TM')
    OR public.has_role(auth.uid(), 'SALES_TL')
  );

CREATE POLICY "Sales and TL can update leads" ON public.leads FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR public.has_role(auth.uid(), 'SALES_TM')
    OR public.has_role(auth.uid(), 'SALES_TL')
    OR public.has_role(auth.uid(), 'LEAD_TL')
  );

-- Lead closures policies
CREATE POLICY "Authenticated can view closures" ON public.lead_closures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sales can insert closures" ON public.lead_closures FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'ADMIN')
    OR public.has_role(auth.uid(), 'SALES_TM')
    OR public.has_role(auth.uid(), 'SALES_TL')
  );

-- Followups policies
CREATE POLICY "Authenticated can view followups" ON public.followups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sales can insert followups" ON public.followups FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Call logs policies
CREATE POLICY "Users can view own call logs" ON public.call_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'SALES_TL'));
CREATE POLICY "Sales can insert call logs" ON public.call_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own call logs" ON public.call_logs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Concerns policies
CREATE POLICY "Authenticated can view concerns" ON public.concerns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert concerns" ON public.concerns FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = raised_by);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Authenticated can insert notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'LEAD_GEN'));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Unique constraints for duplicate detection
CREATE UNIQUE INDEX leads_email_unique ON public.leads (email);
CREATE UNIQUE INDEX leads_phone_unique ON public.leads (phone);

-- Indexes
CREATE INDEX idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX idx_leads_generated_by ON public.leads(lead_generated_by);
CREATE INDEX idx_leads_status ON public.leads(lead_status);
CREATE INDEX idx_followups_lead ON public.followups(lead_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_call_logs_user_date ON public.call_logs(user_id, call_date);