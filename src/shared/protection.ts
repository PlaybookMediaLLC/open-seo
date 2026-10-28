// RFC-0026 phase A (IRFC-0001): the protected-site record's fixed values,
// shared by the schema, the input schemas and the settings page.
export const PROTECTION_STATUSES = [
  "setup",
  "active",
  "paused",
  "ended",
] as const;
export const MONITORED_PAGE_REASONS = [
  "owner",
  "key_page",
  "top_traffic",
] as const;
export const ORIGIN_VERIFICATION_METHODS = [
  "search_console",
  "indexnow_key",
] as const;
/** Active, non-excluded pages per enrollment. */
export const MAX_MONITORED_PAGES = 20;
