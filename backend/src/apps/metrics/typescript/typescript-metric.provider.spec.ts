import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { TypeScriptMetricProvider } from "./typescript-metric.provider";

describe("TypeScriptMetricProvider", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ts-metrics-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("computes TypeScript-only metrics using tsconfig settings", async () => {
    await fs.writeFile(
      path.join(tempDir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          target: "ES2022",
          module: "ESNext"
        }
      })
    );
    await fs.writeFile(
      path.join(tempDir, "index.ts"),
      [
        "type ApiResult = { kind: 'ok'; value: string } | { kind: 'error'; error: Error };",
        "export async function load(input: any): Promise<ApiResult> {",
        "  const raw: unknown = await Promise.resolve(input);",
        "  const text = raw as string;",
        "  return { kind: 'ok', value: text };",
        "}",
        "export function chain(user: { profile?: { name?: string } }) {",
        "  return user.profile?.name?.toUpperCase();",
        "}"
      ].join("\n")
    );
    await fs.writeFile(path.join(tempDir, "ignored.spec.ts"), "const ignored: any = 1;");

    const jsProvider = {
      computeSelected: jest.fn()
    };
    const provider = new TypeScriptMetricProvider(jsProvider as never);

    const result = await provider.computeSelected({ absolutePath: tempDir, relativePath: "." }, [
      "LOC",
      "Files count analyzed",
      "strict enabled",
      "explicit any count",
      "explicit unknown count",
      "type assertions count (as/<T>)",
      "ASYNC_USAGE total (async function + await + then/catch/finally + new Promise)",
      "CHAIN_LENGTH max (длинные цепочки вызовов/обращений)"
    ]);

    expect(result["Files count analyzed"]).toBe(1);
    expect(result["strict enabled"]).toBe(true);
    expect(result["explicit any count"]).toBe(1);
    expect(result["explicit unknown count"]).toBe(1);
    expect(result["type assertions count (as/<T>)"]).toBe(1);
    expect(
      result["ASYNC_USAGE total (async function + await + then/catch/finally + new Promise)"]
    ).toBe(2);
    expect(result["CHAIN_LENGTH max (длинные цепочки вызовов/обращений)"]).toBeGreaterThanOrEqual(
      2
    );
    expect(Number(result.LOC)).toBeGreaterThan(0);
    expect(jsProvider.computeSelected).not.toHaveBeenCalled();
  });

  it("delegates requested JavaScript metrics and returns null for TS metrics without TS files", async () => {
    const jsProvider = {
      computeSelected: jest.fn().mockResolvedValue({ files_count: 1 })
    };
    const provider = new TypeScriptMetricProvider(jsProvider as never);

    await fs.writeFile(path.join(tempDir, "index.js"), "const value = 1;");

    await expect(
      provider.computeSelected({ absolutePath: tempDir, relativePath: "." }, [
        "files_count",
        "LOC",
        "strict enabled"
      ])
    ).resolves.toEqual({
      files_count: 1,
      LOC: null,
      "strict enabled": null
    });
    expect(jsProvider.computeSelected).toHaveBeenCalledWith(
      { absolutePath: tempDir, relativePath: "." },
      ["files_count"]
    );
  });
});
