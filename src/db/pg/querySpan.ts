// Playbook fork: Cloudflare traces D1 calls but not Postgres queries over
// Hyperdrive, so each query (with its retries) gets one span. A transaction
// gets one span for all its statements (operation BEGIN). Attributes follow
// the OpenTelemetry database conventions. The error message stays out because
// a Postgres error can quote row values.
type QuerySpan = { setAttribute(key: string, value: string | number): void };
type Tracing = {
  enterSpan<T>(name: string, callback: (span: QuerySpan) => T): T;
};

// Same lazy import as runtime-env: unit tests and the standalone runtime have
// no tracing API, so their queries run without a span.
// ponytail: queries never wait for the import, so the first query of an
// isolate has no span. Await a load in withPgClient if that ever matters.
let tracing: Tracing | undefined;
let loading: Promise<void> | undefined;

// The generated runtime types predate the tracing API.
const hasTracing = (workers: object): workers is { tracing: Tracing } =>
  "tracing" in workers;

export function traceQuery<T>(
  query: string,
  run: (span?: QuerySpan) => Promise<T>,
): Promise<T> {
  loading ??= import("cloudflare:workers").then(
    (workers: object) => {
      if (hasTracing(workers)) tracing = workers.tracing;
    },
    () => {},
  );
  if (!tracing) return run();
  return tracing.enterSpan("pg_query", async (span) => {
    span.setAttribute("db.system.name", "postgresql");
    span.setAttribute(
      "db.operation.name",
      /^\s*(\w+)/.exec(query)?.[1]?.toUpperCase() ?? "UNKNOWN",
    );
    // Drizzle sends parameterized SQL, so values are not in the text.
    span.setAttribute("db.query.text", query.slice(0, 1000));
    try {
      return await run(span);
    } catch (error) {
      // postgres.js and socket errors carry a code; anything else, its name.
      const code: unknown = Reflect.get(Object(error), "code");
      const name = error instanceof Error ? error.name : "unknown";
      span.setAttribute("error.type", typeof code === "string" ? code : name);
      throw error;
    }
  });
}
