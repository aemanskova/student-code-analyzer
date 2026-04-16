import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { PathOutsideRootError, resolvePathUnderRoot } from "./path-security";

describe("resolvePathUnderRoot", () => {
  let root: string;
  let outside: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "path-sec-in-"));
    outside = fs.mkdtempSync(path.join(os.tmpdir(), "path-sec-out-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    try {
      fs.rmSync(outside, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("allows a relative path inside root", () => {
    expect(resolvePathUnderRoot(root, "group/a")).toBe(path.join(root, "group", "a"));
  });

  it("allows an absolute path when it stays under root", () => {
    const inside = path.join(root, "sub");
    expect(resolvePathUnderRoot(root, inside)).toBe(inside);
  });

  it("rejects traversal via relative segments", () => {
    expect(() => resolvePathUnderRoot(root, "..")).toThrow(PathOutsideRootError);
  });

  it("rejects absolute path outside root", () => {
    const foreign = path.join(outside, "file");
    expect(() => resolvePathUnderRoot(root, foreign)).toThrow(PathOutsideRootError);
  });

  it("rejects empty path", () => {
    expect(() => resolvePathUnderRoot(root, "  ")).toThrow(PathOutsideRootError);
  });
});
