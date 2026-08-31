export type Permission = "view" | "edit";

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  owner_id: string;
  title: string;
  content_html: string;
  created_at: string;
  updated_at: string;
}

export interface ShareRow {
  id: string;
  document_id: string;
  user_id: string;
  permission: Permission;
  created_at: string;
}

/** A document plus the current viewer's relationship to it. */
export interface DocumentWithAccess extends DocumentRow {
  /** How the current user reaches this document. */
  access: "owner" | Permission;
  owner: Pick<User, "id" | "email" | "display_name">;
}

export interface ShareEntry {
  user: Pick<User, "id" | "email" | "display_name">;
  permission: Permission;
}
