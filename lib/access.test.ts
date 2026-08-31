import { describe, it, expect } from "vitest";
import { resolveAccess, canView, canEdit, canManage } from "./access";

const OWNER = "user-owner";
const ALICE = "user-alice";
const BOB = "user-bob";

describe("resolveAccess", () => {
  it("gives the owner full access regardless of shares", () => {
    expect(resolveAccess({ userId: OWNER, ownerId: OWNER, shares: [] })).toBe("owner");
  });

  it("returns the granted permission for a shared user", () => {
    const shares = [
      { user_id: ALICE, permission: "edit" as const },
      { user_id: BOB, permission: "view" as const },
    ];
    expect(resolveAccess({ userId: ALICE, ownerId: OWNER, shares })).toBe("edit");
    expect(resolveAccess({ userId: BOB, ownerId: OWNER, shares })).toBe("view");
  });

  it("prefers 'edit' when a user somehow has multiple grants", () => {
    const shares = [
      { user_id: ALICE, permission: "view" as const },
      { user_id: ALICE, permission: "edit" as const },
    ];
    expect(resolveAccess({ userId: ALICE, ownerId: OWNER, shares })).toBe("edit");
  });

  it("returns null for a user with no relationship to the document", () => {
    expect(
      resolveAccess({ userId: "stranger", ownerId: OWNER, shares: [] }),
    ).toBeNull();
  });

  it("returns null when there is no user (signed out)", () => {
    expect(resolveAccess({ userId: null, ownerId: OWNER, shares: [] })).toBeNull();
  });
});

describe("permission helpers", () => {
  it("canView is true for any level of access", () => {
    expect(canView("owner")).toBe(true);
    expect(canView("edit")).toBe(true);
    expect(canView("view")).toBe(true);
    expect(canView(null)).toBe(false);
  });

  it("canEdit excludes view-only", () => {
    expect(canEdit("owner")).toBe(true);
    expect(canEdit("edit")).toBe(true);
    expect(canEdit("view")).toBe(false);
    expect(canEdit(null)).toBe(false);
  });

  it("canManage is owner-only", () => {
    expect(canManage("owner")).toBe(true);
    expect(canManage("edit")).toBe(false);
    expect(canManage("view")).toBe(false);
  });
});
