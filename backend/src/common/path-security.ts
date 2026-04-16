import * as path from "node:path";

export class PathOutsideRootError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathOutsideRootError";
  }
}

/**
 * Resolves userPath relative to rootDir, or validates an absolute path is under rootDir.
 */
export function resolvePathUnderRoot(rootDir: string, userPath: string): string {
  const root = path.resolve(rootDir);
  const trimmed = String(userPath || "").trim();
  if (!trimmed) {
    throw new PathOutsideRootError("Path is empty");
  }
  const candidate = path.isAbsolute(trimmed) ? path.resolve(trimmed) : path.resolve(root, trimmed);
  const rel = path.relative(root, candidate);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new PathOutsideRootError(`Path must be inside ${root}`);
  }
  return candidate;
}
