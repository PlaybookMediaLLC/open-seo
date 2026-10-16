import { z } from "zod";
import { AppError } from "@/server/lib/errors";
import type { PublishingConnectionRecord } from "@/types/schemas/publishing";
import type { GithubClient } from "./githubClient";
import { metadataHelperCandidates } from "./metadataHelper";
import { readTitleTemplate } from "./layoutTitle";
import { prepareIndexingChange, type Robots } from "./indexingMetadata";
import {
  currentDescription,
  metadataHelperImport,
  prepareMetadataChange,
  validateMetadataTarget,
} from "./nextMetadata";
import {
  isPagesRouterFile,
  preparePagesHeadChange,
  validatePagesTarget,
} from "./pagesRouterHead";
import { gitBlobHash } from "./proposalFingerprint";

const manifestSchema = z.object({
  dependencies: z.record(z.string(), z.unknown()).optional(),
  devDependencies: z.record(z.string(), z.unknown()).optional(),
});

function verifyNextManifest(source: string) {
  let version: unknown;
  try {
    const manifest = manifestSchema.parse(JSON.parse(source));
    version = manifest.dependencies?.next ?? manifest.devDependencies?.next;
  } catch {
    throw new AppError("VALIDATION_ERROR");
  }
  const parts =
    typeof version === "string"
      ? /^[~^]?(\d+)\.(\d+)\.\d+(?:-[a-zA-Z0-9.-]+)?$/.exec(version)
      : null;
  if (
    !parts ||
    !(
      Number(parts[1]) > 13 ||
      (Number(parts[1]) === 13 && Number(parts[2]) >= 2)
    )
  )
    throw new AppError("VALIDATION_ERROR");
}

// Tries each candidate in order. A missing file in a folder that was already
// read costs no extra GitHub request.
async function readMetadataHelper(
  client: Pick<GithubClient, "readFile">,
  sha: string,
  candidates: string[],
) {
  for (const path of candidates) {
    try {
      const file = await client.readFile(path, sha);
      if ((await gitBlobHash(file.source)) !== file.blobSha)
        throw new AppError("CONFLICT");
      return { path, ...file };
    } catch (error) {
      if (!(error instanceof AppError && error.code === "NOT_FOUND"))
        throw error;
    }
  }
  throw new AppError(
    "VALIDATION_ERROR",
    "Relay could not find the metadata helper module in the repository.",
  );
}

type AdapterId = "app_router_metadata" | "pages_router_head";

/** Checks the page path and URL before any GitHub request. */
export function validateTarget(
  path: string,
  url: string,
  rootDirectory: string,
): AdapterId {
  if (isPagesRouterFile(path, rootDirectory)) {
    validatePagesTarget(path, url, rootDirectory);
    return "pages_router_head";
  }
  validateMetadataTarget({ path, url, rootDirectory });
  return "app_router_metadata";
}

// Every patch has the same fields, whatever it changes.
const NO_INDEXING_CHANGE = {
  canonicalBefore: null,
  canonicalAfter: null,
  canonicalBeforeSnippet: null,
  canonicalAfterSnippet: null,
  robotsBefore: null,
  robotsAfter: null,
  robotsBeforeSnippet: null,
  robotsAfterSnippet: null,
};
const NO_TEXT_CHANGE = {
  beforeTitle: null,
  afterTitle: null,
  titleBeforeSnippet: null,
  titleAfterSnippet: null,
  finalTitle: null,
  helperNote: null,
};

/**
 * Reads the page at one commit and prepares the change with the adapter for
 * its router: App Router metadata (with its helper module and layout title
 * template) or Pages Router next/head (RFC-0005 5.8).
 */
export async function prepareChangeAt(
  client: Pick<GithubClient, "readFile">,
  connection: Pick<PublishingConnectionRecord, "rootDirectory">,
  input: {
    filePath: string;
    url: string;
    sha: string;
    newDescription?: string;
    newTitle?: string;
    newCanonical?: string;
    newRobots?: Robots;
    restore?: boolean;
    // Execution skips it: the base commit is pinned, and prepare checked it.
    verifyManifest?: boolean;
  },
) {
  const { filePath, sha, url } = input;
  const rootDirectory = connection.rootDirectory;
  const rootPrefix = rootDirectory ? `${rootDirectory}/` : "";
  const adapterId = validateTarget(filePath, url, rootDirectory);
  if (input.verifyManifest ?? true)
    verifyNextManifest(
      (await client.readFile(`${rootPrefix}package.json`, sha)).source,
    );
  const file = await client.readFile(filePath, sha);
  if ((await gitBlobHash(file.source)) !== file.blobSha)
    throw new AppError("CONFLICT");
  const indexing =
    input.newCanonical !== undefined || input.newRobots !== undefined;
  if (indexing && adapterId !== "app_router_metadata")
    throw new AppError(
      "VALIDATION_ERROR",
      "Relay changes canonical and robots only in App Router pages.",
    );
  if (indexing) {
    const patch = prepareIndexingChange({
      path: filePath,
      url,
      rootDirectory,
      source: file.source,
      newCanonical: input.newCanonical,
      newRobots: input.newRobots,
    });
    const description = currentDescription(file.source, filePath);
    return {
      adapterId,
      file,
      helper: undefined,
      patch: {
        ...patch,
        ...NO_TEXT_CHANGE,
        beforeDescription: description.value,
        afterDescription: description.value,
        beforeSnippet: description.snippet,
        afterSnippet: description.snippet,
        validationSummary:
          "Validated direct path correspondence, a literal metadata object, literal canonical and robots values, reparsed output, and unchanged surrounding source. Human-provided values only.",
      },
    };
  }
  const change = {
    path: filePath,
    url,
    rootDirectory,
    source: file.source,
    newDescription: input.newDescription,
    newTitle: input.newTitle,
    restore: input.restore,
  };
  if (adapterId === "pages_router_head")
    return {
      adapterId,
      file,
      helper: undefined,
      patch: { ...preparePagesHeadChange(change), ...NO_INDEXING_CHANGE },
    };
  const helperImport = metadataHelperImport(file.source, filePath);
  const helper = helperImport
    ? await readMetadataHelper(
        client,
        sha,
        metadataHelperCandidates({
          specifier: helperImport.specifier,
          pagePath: filePath,
          rootDirectory,
          tsconfig: helperImport.specifier.startsWith(".")
            ? undefined
            : (await client.readFile(`${rootPrefix}tsconfig.json`, sha)).source,
        }),
      )
    : undefined;
  const patch = prepareMetadataChange({
    ...change,
    helper,
    titleTemplate:
      input.newTitle === undefined
        ? null
        : await readTitleTemplate(client, sha, filePath, rootDirectory),
  });
  return {
    adapterId,
    file,
    helper,
    patch: { ...patch, ...NO_INDEXING_CHANGE },
  };
}
