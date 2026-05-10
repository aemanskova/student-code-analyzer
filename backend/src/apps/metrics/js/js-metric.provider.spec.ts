import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { JsMetricProvider } from "./js-metric.provider";

describe("JsMetricProvider", () => {
  let tempDir: string;

  const createProvider = () =>
    new JsMetricProvider({
      get: jest.fn((key: string, fallback?: string) => {
        if (key === "JS_ESLINT_ENABLED") {
          return "false";
        }
        return fallback;
      })
    } as never);

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "js-metrics-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("computes local JavaScript metrics and ignores generated folders", async () => {
    await fs.writeFile(
      path.join(tempDir, "index.js"),
      [
        "function render(user, count, flag) {",
        "  if (flag) {",
        "    document.body.innerHTML = user.name;",
        "  }",
        "  switch (count) {",
        "    case 1:",
        "      return user.profile?.name;",
        "  }",
        "  return count;",
        "}",
        "const helper = (value) => value + 1;",
        "render({ name: 'Ada', profile: { name: 'A' } }, helper(1), true);"
      ].join("\n")
    );
    await fs.mkdir(path.join(tempDir, "node_modules"), { recursive: true });
    await fs.writeFile(path.join(tempDir, "node_modules", "ignored.js"), "function ignored() {}");

    const result = await createProvider().computeSelected(
      { absolutePath: tempDir, relativePath: "." },
      [
        "files_count",
        "functions_count_user",
        "functions_count_all",
        "lines_of_code",
        "max_parameters_per_function",
        "inner_html_usage_count",
        "switch_without_default_count",
        "eslint_errors_count",
        "eslint_warnings_count"
      ]
    );

    expect(result.files_count).toBe(1);
    expect(result.functions_count_user).toBe(2);
    expect(result.functions_count_all).toBe(2);
    expect(result.lines_of_code).toBe(12);
    expect(result.max_parameters_per_function).toBe(3);
    expect(result.inner_html_usage_count).toBe(1);
    expect(result.switch_without_default_count).toBe(1);
    expect(result.eslint_errors_count).toBe(0);
    expect(result.eslint_warnings_count).toBe(0);
  });

  it("returns zero summary values when no JavaScript files are found", async () => {
    await fs.writeFile(path.join(tempDir, "README.md"), "# docs");

    await expect(
      createProvider().computeSelected({ absolutePath: tempDir, relativePath: "." }, [
        "files_count",
        "lines_of_code",
        "functions_count_user"
      ])
    ).resolves.toEqual({
      files_count: 0,
      lines_of_code: 0,
      functions_count_user: 0
    });
  });
});
