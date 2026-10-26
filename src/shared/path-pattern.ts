import { RE2JS } from "re2js";

/** User-authored path patterns must not run a backtracking regex engine. */
export function createPathMatcher(pattern: string): (path: string) => boolean {
  try {
    const regex = RE2JS.compile(pattern);
    return (path) => regex.matcher(path).find();
  } catch {
    // The shared error translator preserves this public code for saved patterns.
    throw new Error("INVALID_PATH_PATTERN");
  }
}

export function isValidPathPattern(pattern: string): boolean {
  try {
    createPathMatcher(pattern);
    return true;
  } catch {
    return false;
  }
}
