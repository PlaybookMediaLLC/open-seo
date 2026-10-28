import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

// App-level resources layered on top of better-auth's built-in org statements
// (organization/member/invitation management, which the plugin's own endpoints
// already enforce). Spreading defaultStatements is required — a custom
// statement object otherwise REPLACES the built-in catalog and every plugin
// permission check fails.
const statement = {
  ...defaultStatements,
  // Subscribe, top-ups, Stripe portal, cancel. Owner-only.
  billing: ["manage"],
  // Create + archive/restore projects. Renames/settings stay open to all.
  project: ["create", "delete"],
  // GSC/GA4 connect, re-point, disconnect.
  integration: ["manage"],
  // RFC-0007 6.4: approve the pull requests Relay opens. Owners hold it and
  // grant it per member with the approver role.
  publishing: ["approve"], // playbook-seam
} as const;

export const orgAccessControl = createAccessControl(statement);

export const orgRoles = {
  owner: orgAccessControl.newRole({
    ...ownerAc.statements,
    billing: ["manage"],
    project: ["create", "delete"],
    integration: ["manage"],
    publishing: ["approve"], // playbook-seam
  }),
  admin: orgAccessControl.newRole({
    ...adminAc.statements,
    project: ["create", "delete"],
    integration: ["manage"],
  }),
  // Defined from day one so exposing it later is UI-only; not offered in the
  // invite picker yet. Members can view everything and run research, but not
  // manage the org, billing, projects, or integrations.
  member: orgAccessControl.newRole({
    ...memberAc.statements,
  }),
  // RFC-0007 6.4: never a role on its own. An owner adds it to a member's
  // role ("admin,approver") through setMemberApproval, the only path that may.
  approver: orgAccessControl.newRole({ publishing: ["approve"] }), // playbook-seam
};

export type OrgPermissionRequest = Partial<{
  [K in keyof typeof statement]: Array<(typeof statement)[K][number]>;
}>;

const roleByName = new Map<string, (typeof orgRoles)[keyof typeof orgRoles]>(
  Object.entries(orgRoles),
);

const roleNames = (role: string) =>
  role
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

/** Whether an owner granted this member approval (RFC-0007 6.4). */
export function hasApproverRole(role: string): boolean {
  return roleNames(role).includes("approver");
}

/** The member's role with the approver role added or removed. */
export function withApproverRole(role: string, approve: boolean): string {
  const others = roleNames(role).filter((name) => name !== "approver");
  return (approve ? [...others, "approver"] : others).join(",") || "member";
}

// better-auth stores multiple roles as one comma-separated string and ORs
// permission checks across them; mirror that here. Unknown role names fail
// closed.
export function hasOrgPermission(
  role: string,
  permissions: OrgPermissionRequest,
): boolean {
  return role.split(",").some((name) => {
    const candidate = roleByName.get(name.trim());
    return candidate ? candidate.authorize(permissions).success : false;
  });
}
