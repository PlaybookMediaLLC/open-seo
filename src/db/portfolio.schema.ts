import { sql } from "drizzle-orm";
import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { organization } from "./better-auth-schema";

// RFC-0007 6.6: an agency organization's read-only view of a client
// organization's portfolio summary. The agency's owner asks, the client's
// owner accepts, and either owner ends it. A client's projects never move
// into the agency organization.
export const agencyClientLinks = sqliteTable(
  "agency_client_links",
  {
    id: text("id").primaryKey(),
    agencyOrganizationId: text("agency_organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    clientOrganizationId: text("client_organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    requestedByUserId: text("requested_by_user_id").notNull(),
    requestedAt: text("requested_at").notNull(),
    // Null until the client's owner accepts.
    acceptedByUserId: text("accepted_by_user_id"),
    acceptedAt: text("accepted_at"),
    // Set when either owner declines or ends the link; the row stays as
    // history and a new request makes a new row.
    endedByUserId: text("ended_by_user_id"),
    endedAt: text("ended_at"),
  },
  (t) => [
    uniqueIndex("agency_client_links_open_idx")
      .on(t.agencyOrganizationId, t.clientOrganizationId)
      .where(sql`${t.endedAt} IS NULL`),
    index("agency_client_links_client_idx").on(t.clientOrganizationId),
  ],
);

// RFC-0007 6.7: the logo and color an organization's shared reports show.
export const organizationBranding = sqliteTable("organization_branding", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  // #rrggbb.
  brandColor: text("brand_color"),
  // A PNG, JPEG or WebP data URL, checked on save and again on read.
  logoDataUrl: text("logo_data_url"),
  updatedByUserId: text("updated_by_user_id").notNull(),
  updatedAt: text("updated_at").notNull(),
});
