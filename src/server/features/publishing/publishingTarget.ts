import { z } from "zod";
import { AppError } from "@/server/lib/errors";
import type { PublishingConnectionRecord } from "@/types/schemas/publishing";
import type { GithubClient } from "./githubClient";
import { metadataHelperCandidates } from "./metadataHelper";
import { metadataHelperImport } from "./nextMetadata";
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
  client: GithubClient,
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

/**
 * Reads what a metadata change needs at one commit: the package manifest
 * (Next.js 13.2 or later), the page file, and the helper module when the page
 * sets metadata through a helper call.
 */
export async function readPublishingTarget(
  client: GithubClient,
  connection: PublishingConnectionRecord,
  filePath: string,
  sha: string,
) {
  const rootPrefix = connection.rootDirectory
    ? `${connection.rootDirectory}/`
    : "";
  verifyNextManifest(
    (await client.readFile(`${rootPrefix}package.json`, sha)).source,
  );
  const file = await client.readFile(filePath, sha);
  if ((await gitBlobHash(file.source)) !== file.blobSha)
    throw new AppError("CONFLICT");
  const helperImport = metadataHelperImport(file.source, filePath);
  const helper = helperImport
    ? await readMetadataHelper(
        client,
        sha,
        metadataHelperCandidates({
          specifier: helperImport.specifier,
          pagePath: filePath,
          rootDirectory: connection.rootDirectory,
          tsconfig: helperImport.specifier.startsWith(".")
            ? undefined
            : (await client.readFile(`${rootPrefix}tsconfig.json`, sha)).source,
        }),
      )
    : undefined;
  return { file, helper };
}
