import { AppError } from "@/server/lib/errors";
import type { GithubClient } from "./githubClient";
import {
  fieldProperty,
  invalid,
  parseSource,
  unwrap,
  walk,
} from "./metadataSyntax";

const LAYOUT_FILES = ["layout.tsx", "layout.ts", "layout.jsx", "layout.js"];

/** The folders whose layouts wrap a page, nearest first. */
function layoutFolders(pagePath: string, rootDirectory: string) {
  const prefix = rootDirectory ? `${rootDirectory}/` : "";
  const relative = pagePath.slice(prefix.length);
  const app = relative.startsWith("src/app/") ? "src/app" : "app";
  const folders = relative
    .slice(app.length + 1)
    .split("/")
    .slice(0, -1);
  const result: string[] = [];
  for (let depth = folders.length; depth >= 0; depth--)
    result.push([`${prefix}${app}`, ...folders.slice(0, depth)].join("/"));
  return result;
}

/** A layout's literal `title.template`, or null when it sets none. */
export function layoutTitleTemplate(source: string, path: string) {
  const program = parseSource(source, path);
  walk(program, (node) => {
    if (node.type === "Identifier" && node.name === "generateMetadata")
      invalid(
        `${path} generates its metadata. Relay cannot read its title template.`,
      );
  });
  let metadata: ReturnType<typeof unwrap> | undefined;
  for (const statement of program.body)
    if (
      statement.type === "ExportNamedDeclaration" &&
      statement.declaration?.type === "VariableDeclaration"
    )
      for (const declaration of statement.declaration.declarations)
        if (
          declaration.id.type === "Identifier" &&
          declaration.id.name === "metadata" &&
          declaration.init
        )
          metadata = unwrap(declaration.init);
  if (!metadata) return null;
  if (metadata.type !== "ObjectExpression")
    invalid(`Relay cannot read the title template in ${path}.`);
  const title = fieldProperty(metadata, "title")?.value;
  if (!title || title.type === "StringLiteral") return null;
  if (title.type !== "ObjectExpression")
    invalid(`Relay cannot read the title template in ${path}.`);
  const template = fieldProperty(title, "template")?.value;
  if (!template) return null;
  if (template.type !== "StringLiteral" || !template.value.includes("%s"))
    invalid(`Relay cannot read the title template in ${path}.`);
  return template.value;
}

// Next.js applies the nearest layout's title.template to a page's title.
// Reads at most 3 layout files. A missing file in a folder that was already
// read costs no GitHub request.
export async function readTitleTemplate(
  client: Pick<GithubClient, "readFile">,
  sha: string,
  pagePath: string,
  rootDirectory: string,
) {
  let read = 0;
  for (const folder of layoutFolders(pagePath, rootDirectory)) {
    for (const name of LAYOUT_FILES) {
      const path = `${folder}/${name}`;
      let source: string;
      try {
        ({ source } = await client.readFile(path, sha));
      } catch (error) {
        if (error instanceof AppError && error.code === "NOT_FOUND") continue;
        throw error;
      }
      if (++read > 3)
        invalid(
          "More than 3 layouts wrap this page. Relay cannot verify the final title.",
        );
      const template = layoutTitleTemplate(source, path);
      if (template !== null) return template;
      break;
    }
  }
  return null;
}
