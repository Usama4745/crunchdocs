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

export type UserRef = Pick<User, "id" | "email" | "display_name">;

export interface DocumentVersionRow {
  id: string;
  document_id: string;
  title: string;
  content_html: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

/** A version in the history list (no content body). */
export interface VersionSummary {
  id: string;
  note: string | null;
  created_at: string;
  author: UserRef | null;
}

export interface CommentEntry {
  id: string;
  body: string;
  resolved: boolean;
  created_at: string;
  author: UserRef;
  /** Whether the current viewer may resolve/delete this comment. */
  canModerate: boolean;
}

export interface PresencePerson {
  id: string;
  name: string;
  mode: "viewing" | "editing";
  isSelf: boolean;
}
