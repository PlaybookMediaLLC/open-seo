/**
 * Erases one Relay user on D1. scripts/erase-user-data.ts does the same job
 * for Postgres only; this follows its rules on D1 and calls the same Worker
 * storage endpoint. Runbook: docs/maintainers/runbooks/delete-user-data.md.
 *
 *   pnpm tsx scripts/relay-erase-user-d1.ts --database <name> --email <email>
 *   ... --execute --confirm <email> [--database-only]
 *
 * User input only selects the user row. Every later statement uses ids read
 * from the database, and each id must match SAFE_ID before it is inlined,
 * because `wrangler d1 execute` takes no bound parameters.
 */
import { execFileSync } from "node:child_process";
import process from "node:process";
import { Autumn } from "autumn-js";
import { symmetricDecrypt } from "better-auth/crypto";
import { GA4_OAUTH_PROVIDER_ID } from "../src/shared/ga4";
import {
  GDPR_STORAGE_ERASURE_PATH,
  signGdprErasureRequest,
  type GdprStorageErasurePayload,
} from "../src/shared/gdpr-erasure";
import { GSC_OAUTH_PROVIDER_ID } from "../src/shared/gsc";
import { loadLocalEnv, parseArgs, requiredEnv } from "./cli-utils";

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
const DELETED = "gdpr-deleted-user";
// Attribution columns with no user foreign key. Rows in organizations that
// survive keep the record and lose the link to the person.
const ATTRIBUTION: Array<[table: string, column: string]> = [
  ["audits", "started_by_user_id"],
  ["report_templates", "created_by_user_id"],
  ["crawler_credentials", "created_by_user_id"],
  ["project_research_log", "created_by"],
  ["opportunities", "owner_user_id"],
  ["opportunity_runs", "requested_by"],
  ["opportunity_decisions", "actor_user_id"],
  ["opportunity_proposals", "created_by"],
  ["opportunity_tickets", "created_by"],
  ["proposal_approvals", "actor_user_id"],
  ["publishing_connections", "created_by"],
  ["github_app_installations", "created_by"],
  ["growth_experiments", "created_by"],
  ["measurement_runs", "requested_by"],
  ["experiment_deployment_signals", "created_by"],
];

const args = parseArgs(process.argv.slice(2));
const database = args.database;

function query(sql: string): Array<Record<string, unknown>> {
  const output = execFileSync(
    "pnpm",
    [
      "exec",
      "wrangler",
      "d1",
      "execute",
      database,
      "--remote",
      "--json",
      "--command",
      sql,
    ],
    { encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024 },
  );
  const parsed = JSON.parse(output) as Array<{
    results?: Array<Record<string, unknown>>;
  }>;
  if (!Array.isArray(parsed))
    throw new Error(`D1 query failed: ${output.slice(0, 500)}`);
  return parsed.flatMap((statement) => statement.results ?? []);
}

function ids(values: unknown[]): string[] {
  return values.map((value) => {
    if (typeof value !== "string" || !SAFE_ID.test(value))
      throw new Error(`Refusing an unexpected id: ${String(value)}`);
    return value;
  });
}

const list = (values: string[]) =>
  values.map((value) => `'${value}'`).join(",");
const column = (rows: Array<Record<string, unknown>>, name: string) =>
  ids(rows.map((row) => row[name]));

function findUser() {
  if (args["user-id"]) {
    const [id] = ids([args["user-id"]]);
    return query(`SELECT id, email FROM user WHERE id = '${id}'`)[0];
  }
  const email = args.email?.trim().toLowerCase() ?? "";
  // A strict shape keeps the one user-supplied value safe to inline.
  if (!SAFE_EMAIL.test(email))
    throw new Error("Pass --email <email> or --user-id <id>.");
  return query(`SELECT id, email FROM user WHERE lower(email) = '${email}'`)[0];
}

function inventory(userId: string) {
  const organizations = query(
    `SELECT o.id, (SELECT count(*) FROM member m2 WHERE m2.organization_id = o.id) AS members
     FROM member m JOIN organization o ON o.id = m.organization_id
     WHERE m.user_id = '${userId}' ORDER BY o.id`,
  );
  const shared = organizations.filter((row) => row.members !== 1);
  if (shared.length)
    throw new Error(
      `Refusing to erase shared organization(s): ${shared.map((row) => `${String(row.id)} (${String(row.members)} members)`).join(", ")}. Remove the user from them first.`,
    );
  const organizationIds = column(organizations, "id");
  const projectIds = organizationIds.length
    ? column(
        query(
          `SELECT id FROM projects WHERE organization_id IN (${list(organizationIds)})`,
        ),
        "id",
      )
    : [];
  const inProjects = (sql: string, name = "id") =>
    projectIds.length
      ? column(query(sql.replace("$PROJECTS", list(projectIds))), name)
      : [];
  const auditCutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const payload: GdprStorageErasurePayload = {
    userId,
    email: "",
    organizationIds,
    samSessionIds: column(
      query(`SELECT id FROM sam_sessions WHERE user_id = '${userId}'`),
      "id",
    ),
    auditIds: inProjects(
      `SELECT id FROM audits WHERE project_id IN ($PROJECTS) AND (started_at > '${auditCutoff}' OR status = 'running')`,
    ),
    activeAuditWorkflowIds: inProjects(
      `SELECT coalesce(workflow_instance_id, id) AS id FROM audits WHERE project_id IN ($PROJECTS) AND status = 'running'`,
    ),
    activeRankWorkflowIds: inProjects(
      `SELECT id FROM rank_check_runs WHERE project_id IN ($PROJECTS) AND status IN ('pending', 'running')`,
    ),
    activeAiVisibilityWorkflowIds: inProjects(
      `SELECT id FROM ai_runs WHERE project_id IN ($PROJECTS) AND status IN ('queued', 'running')`,
    ),
    aiVisibilityProjectIds: projectIds,
    // R2 keys are paths, so they skip the id check and stay out of SQL.
    r2Keys: projectIds.length
      ? query(
          `SELECT DISTINCT l.r2_key FROM audit_lighthouse_results l JOIN audits a ON a.id = l.audit_id
           WHERE a.project_id IN (${list(projectIds)}) AND l.r2_key IS NOT NULL`,
        ).map((row) => String(row.r2_key))
      : [],
    googleAccounts: query(
      `SELECT DISTINCT provider_id, account_id FROM account WHERE user_id = '${userId}'
       AND provider_id IN ('${GSC_OAUTH_PROVIDER_ID}', '${GA4_OAUTH_PROVIDER_ID}')`,
    ).map((row) => ({
      providerId: row.provider_id as typeof GSC_OAUTH_PROVIDER_ID,
      accountId: String(row.account_id),
    })),
  };
  return { payload, projectIds };
}

async function eraseWorkerStorage(payload: GdprStorageErasurePayload) {
  const secret = requiredEnv("GDPR_ERASURE_SECRET");
  const endpoint = new URL(
    GDPR_STORAGE_ERASURE_PATH,
    requiredEnv("BETTER_AUTH_URL"),
  );
  if (endpoint.protocol !== "https:")
    throw new Error("BETTER_AUTH_URL must use https.");
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-gdpr-timestamp": timestamp,
      "x-gdpr-signature": await signGdprErasureRequest(secret, timestamp, body),
    },
    body,
  });
  const text = await response.text();
  if (!response.ok)
    throw new Error(
      `Worker storage erasure failed (${response.status}): ${text}`,
    );
  return JSON.parse(text) as unknown;
}

async function deleteAutumnCustomers(organizationIds: string[]) {
  const key = requiredEnv("AUTUMN_SECRET_KEY");
  if (!key.startsWith("am_sk_live_"))
    throw new Error("AUTUMN_SECRET_KEY is not a live key.");
  const autumn = new Autumn({ secretKey: key });
  let deleted = 0;
  for (const customerId of organizationIds) {
    try {
      await autumn.customers.delete({ customerId, deleteInStripe: true });
      deleted += 1;
    } catch (error) {
      if (!/not.?found|404/i.test(String(error))) throw error;
    }
  }
  return deleted;
}

// Deleting the row leaves a personal token valid at GitHub, so submit it to
// GitHub's credential revocation API first. App connections store no token.
async function revokeGithubTokens(projectIds: string[]) {
  if (!projectIds.length) return 0;
  const key = requiredEnv("BETTER_AUTH_SECRET");
  const rows = query(
    `SELECT encrypted_token FROM publishing_connections WHERE project_id IN (${list(projectIds)}) AND encrypted_token IS NOT NULL`,
  );
  const credentials = await Promise.all(
    rows.map((row) =>
      symmetricDecrypt({ key, data: String(row.encrypted_token) }),
    ),
  );
  if (!credentials.length) return 0;
  const response = await fetch("https://api.github.com/credentials/revoke", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "Relay",
    },
    body: JSON.stringify({ credentials }),
  });
  if (!response.ok)
    throw new Error(`GitHub token revocation failed (${response.status}).`);
  return credentials.length;
}

function eraseDatabase(
  userId: string,
  email: string,
  organizationIds: string[],
) {
  const orgs = organizationIds.length ? list(organizationIds) : "''";
  const statements = [
    `DELETE FROM invitation WHERE lower(email) = '${email}'`,
    // Relay's GitHub App install state stores JSON that names the user.
    `DELETE FROM verification WHERE identifier = '${userId}' OR value = '${userId}' OR (identifier LIKE 'github-app:%' AND instr(value, '"userId":"${userId}"') > 0)`,
    `DELETE FROM gsc_connections WHERE connected_by_user_id = '${userId}'`,
    `DELETE FROM ga4_connections WHERE connected_by_user_id = '${userId}'`,
    `DELETE FROM apikey WHERE reference_id = '${userId}'`,
    `UPDATE reports SET created_by_user_id = '${DELETED}', share_token = NULL, shared_at = NULL WHERE created_by_user_id = '${userId}'`,
    ...ATTRIBUTION.map(
      ([table, name]) =>
        `UPDATE ${table} SET ${name} = '${DELETED}' WHERE ${name} = '${userId}'`,
    ),
    // Re-check sole membership at delete time, and delete the user only when
    // every one of their organizations is gone.
    `DELETE FROM organization WHERE id IN (${orgs}) AND NOT EXISTS (SELECT 1 FROM member m WHERE m.organization_id = organization.id AND m.user_id != '${userId}')`,
    `DELETE FROM user WHERE id = '${userId}' AND NOT EXISTS (SELECT 1 FROM organization WHERE id IN (${orgs}))`,
  ];
  query(statements.join(";\n"));
}

function verify(userId: string, organizationIds: string[]) {
  const [row] = query(
    `SELECT (SELECT count(*) FROM user WHERE id = '${userId}') AS users,
            (SELECT count(*) FROM organization WHERE id IN (${organizationIds.length ? list(organizationIds) : "''"})) AS organizations,
            (SELECT count(*) FROM member WHERE user_id = '${userId}') AS members,
            (SELECT count(*) FROM session WHERE user_id = '${userId}') AS sessions,
            (SELECT count(*) FROM account WHERE user_id = '${userId}') AS accounts,
            (SELECT count(*) FROM apikey WHERE reference_id = '${userId}') AS api_keys`,
  );
  if (Object.values(row).some((value) => value !== 0))
    throw new Error(`Verification failed: ${JSON.stringify(row)}`);
  return row;
}

async function main() {
  loadLocalEnv();
  if (!database) throw new Error("Pass --database <D1 database name>.");
  const user = findUser();
  if (!user) throw new Error("No such user.");
  const [userId] = ids([user.id]);
  const email = String(user.email).toLowerCase();
  if (!SAFE_EMAIL.test(email))
    throw new Error("The stored email has an unexpected shape.");
  const { payload, projectIds } = inventory(userId);
  payload.email = email;
  console.log(
    JSON.stringify(
      {
        database,
        userId,
        email,
        organizations: payload.organizationIds.length,
        projects: projectIds.length,
        samSessions: payload.samSessionIds.length,
        audits: payload.auditIds.length,
        r2Keys: payload.r2Keys.length,
        googleAccounts: payload.googleAccounts.length,
      },
      null,
      2,
    ),
  );
  if (args.execute !== "true") {
    console.log("Dry run. Nothing was changed.");
    return;
  }
  if (args.confirm?.trim().toLowerCase() !== email)
    throw new Error(`--confirm must be ${email}.`);
  if (args["database-only"] !== "true") {
    console.log(
      "Autumn customers deleted:",
      await deleteAutumnCustomers(payload.organizationIds),
    );
    console.log(
      "Worker storage erased:",
      JSON.stringify(await eraseWorkerStorage(payload)),
    );
    console.log("GitHub tokens revoked:", await revokeGithubTokens(projectIds));
  }
  eraseDatabase(userId, email, payload.organizationIds);
  console.log(
    "Verified:",
    JSON.stringify(verify(userId, payload.organizationIds)),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
