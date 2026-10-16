import { AppError } from "@/server/lib/errors";
import { createGithubReader, type GithubRequest } from "./githubRead";
import { validateMetadataTarget } from "./nextMetadata";

// RFC-0004 5.2: find the App Router page file for a URL without reading any
// file contents. Dynamic segments and rewrites stay unsupported.
const REQUEST_BUDGET = 12;
const MAX_ROUTE_GROUPS = 10;
const ROUTE_GROUP = /^\([a-z0-9-]+\)$/;
const PAGE_FILE = /^page\.(?:tsx|ts|jsx|js)$/;
const DYNAMIC_SEGMENT = /^\[.+\]$/;

export type LocateResult =
  | { status: "found"; filePath: string }
  | { status: "not_found" | "ambiguous" | "unsupported"; message: string };

const join = (...parts: string[]) => parts.filter(Boolean).join("/");
const isDirectory = (entry: { type: string; mode: string }) =>
  entry.type === "tree" && entry.mode === "040000";

function isNotFound(error: unknown) {
  return error instanceof AppError && error.code === "NOT_FOUND";
}

/** The route segments of a plain page URL, or null when it is not plain. */
function routeSegments(url: string): string[] | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.search || parsed.hash || url.includes("%")) return null;
  const segments = parsed.pathname.split("/").filter(Boolean);
  return segments.every((segment) =>
    /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(segment),
  )
    ? segments
    : null;
}

export async function locateMetadataFile(
  request: GithubRequest,
  connection: { rootDirectory: string; baseBranch: string },
  url: string,
): Promise<LocateResult> {
  const segments = routeSegments(url);
  if (!segments)
    return {
      status: "unsupported",
      message:
        "Relay finds files only for plain page URLs without a query or encoded characters.",
    };
  let used = 0;
  const reader = createGithubReader((route, schema, options) => {
    if (++used > REQUEST_BUDGET)
      throw new AppError(
        "RATE_LIMITED",
        "Finding the page file needs too many GitHub requests. Enter the file path.",
      );
    return request(route, schema, options);
  });
  const base = await reader.getRef(connection.baseBranch);
  if (!base)
    return {
      status: "not_found",
      message: `The branch ${connection.baseBranch} was not found.`,
    };
  const list = async (path: string) => {
    try {
      return await reader.listDirectory(path, base.sha);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  };
  const root = connection.rootDirectory;
  const rootEntries = (await list(root)) ?? [];
  const appDirectories = [
    rootEntries.some((entry) => entry.name === "app" && isDirectory(entry))
      ? join(root, "app")
      : null,
    rootEntries.some((entry) => entry.name === "src" && isDirectory(entry)) &&
    (await list(join(root, "src")))?.some(
      (entry) => entry.name === "app" && isDirectory(entry),
    )
      ? join(root, "src", "app")
      : null,
  ].filter((path): path is string => path !== null);
  if (appDirectories.length !== 1)
    return appDirectories.length
      ? {
          status: "ambiguous",
          message:
            "The repository has both app/ and src/app/. Enter the file path.",
        }
      : {
          status: "not_found",
          message: "No App Router app/ or src/app/ directory was found.",
        };
  const appDirectory = appDirectories[0];
  const groups = ((await list(appDirectory)) ?? [])
    .filter((entry) => isDirectory(entry) && ROUTE_GROUP.test(entry.name))
    .map((entry) => entry.name);
  if (groups.length > MAX_ROUTE_GROUPS)
    return {
      status: "unsupported",
      message: `The app directory has more than ${MAX_ROUTE_GROUPS} route groups. Enter the file path.`,
    };
  // Route group folders do not appear in URLs, so try the path with no group
  // and under each group. Only the candidates' own directories are read.
  const matches: string[] = [];
  for (const group of ["", ...groups]) {
    const directory = join(appDirectory, group, ...segments);
    for (const entry of (await list(directory)) ?? [])
      if (entry.type === "blob" && PAGE_FILE.test(entry.name))
        matches.push(join(directory, entry.name));
  }
  if (!matches.length && segments.length) {
    // ponytail: one level only. A dynamic folder deeper up the path still
    // gets the general message below.
    for (const group of ["", ...groups]) {
      const parent = await list(
        join(appDirectory, group, ...segments.slice(0, -1)),
      ).catch(() => null);
      const dynamic = parent?.find(
        (entry) => isDirectory(entry) && DYNAMIC_SEGMENT.test(entry.name),
      );
      if (dynamic)
        return {
          status: "unsupported",
          message: `This URL matches the dynamic segment ${dynamic.name}. Relay does not change dynamic routes; create a ticket instead.`,
        };
    }
  }
  if (matches.length !== 1)
    return matches.length
      ? {
          status: "ambiguous",
          message: `More than one page file matches: ${matches.join(", ")}. Enter the file path.`,
        }
      : {
          status: "not_found",
          message:
            "No static page file matches this URL. Dynamic routes and rewrites are not supported; create a ticket instead.",
        };
  try {
    validateMetadataTarget({
      path: matches[0],
      url,
      rootDirectory: connection.rootDirectory,
    });
  } catch (error) {
    return {
      status: "unsupported",
      message:
        error instanceof Error
          ? error.message
          : "The page file is not supported.",
    };
  }
  return { status: "found", filePath: matches[0] };
}
