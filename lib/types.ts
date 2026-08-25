import type { ContactStatus } from "./constants";

export type Profile = {
  id: string;
  full_name: string;
  role: string;
  email: string;
  phone: string;
  prefs: { digest: boolean; mentions: boolean; autoLog: boolean; weighted: boolean };
  created_at: string;
};

export type Company = {
  id: string;
  owner_id: string;
  name: string;
  industry: string | null;
  website: string | null;
  notes: string | null;
  country: string | null;
  size: string | null;
  created_at: string;
};

export type Contact = {
  id: string;
  owner_id: string;
  company_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  status: ContactStatus;
  source: string | null;
  timezone: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  company?: Pick<Company, "id" | "name" | "industry"> | null;
};

export type Deal = {
  id: string;
  owner_id: string;
  company_id: string | null;
  contact_id: string | null;
  name: string;
  value: number;
  stage: number;
  project_type: string;
  close_date: string | null;
  notes: string | null;
  owner_initials: string | null;
  lost_reason: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  company?: Pick<Company, "id" | "name"> | null;
  contact?: Pick<Contact, "id" | "name"> | null;
};

export type Activity = {
  id: string;
  owner_id: string;
  contact_id: string | null;
  deal_id: string | null;
  kind: string;
  title: string;
  body: string | null;
  author: string | null;
  occurred_at: string;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  contact?: { id: string; name: string } | null;
  deal?: { id: string; name: string } | null;
};
