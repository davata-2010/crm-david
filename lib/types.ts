import type { ContactStatus } from "./constants";

export type MemberRole = "owner" | "admin" | "member" | "viewer";

export type Workspace = {
  id: string;
  name: string;
  api_key: string;
  created_by: string | null;
  created_at: string;
};

export type Membership = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
  profile?: Profile | null;
};

export type Invitation = {
  id: string;
  workspace_id: string;
  email: string;
  role: MemberRole;
  token: string;
  invited_by: string | null;
  accepted_at: string | null;
  created_at: string;
};

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
  workspace_id: string;
  owner_id: string;
  name: string;
  industry: string | null;
  website: string | null;
  notes: string | null;
  country: string | null;
  size: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type Contact = {
  id: string;
  workspace_id: string;
  owner_id: string;
  assigned_to: string | null;
  company_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  status: ContactStatus;
  source: string | null;
  timezone: string | null;
  tags: string[];
  custom: Record<string, string | number | boolean>;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  company?: Pick<Company, "id" | "name" | "industry"> | null;
};

export type Deal = {
  id: string;
  workspace_id: string;
  owner_id: string;
  assigned_to: string | null;
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
  custom: Record<string, string | number | boolean>;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  company?: Pick<Company, "id" | "name"> | null;
  contact?: Pick<Contact, "id" | "name"> | null;
};

export type Activity = {
  id: string;
  workspace_id: string;
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
  deleted_at: string | null;
  created_at: string;
  contact?: { id: string; name: string } | null;
  deal?: { id: string; name: string } | null;
};

export type AuditEntry = {
  id: number;
  workspace_id: string;
  user_id: string | null;
  entity: string;
  entity_id: string;
  action: "create" | "update" | "delete" | "restore" | "purge";
  label: string;
  changes: Record<string, { de: unknown; a: unknown }>;
  created_at: string;
};

export type SavedView = {
  id: string;
  workspace_id: string;
  user_id: string;
  entity: string;
  name: string;
  config: Record<string, string>;
  shared: boolean;
  created_at: string;
};

export type Attachment = {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  deal_id: string | null;
  name: string;
  path: string;
  size: number;
  mime: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type CustomField = {
  id: string;
  workspace_id: string;
  entity: "contacts" | "deals";
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "checkbox";
  options: string[];
  position: number;
  created_at: string;
};
