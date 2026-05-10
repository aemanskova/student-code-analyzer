import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { HtmlCssMetricProvider } from "./html-css-metric.provider";

describe("HtmlCssMetricProvider", () => {
  let tempDir: string;
  const provider = new HtmlCssMetricProvider();

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "html-css-provider-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("computes tag count, average selector specificity, and unused css classes", async () => {
    const htmlPath = path.join(tempDir, "index.html");
    const cssPath = path.join(tempDir, "styles.css");
    await fs.writeFile(
      htmlPath,
      [
        "<!doctype html>",
        "<html>",
        "<head>",
        '<link rel="stylesheet" href="styles.css">',
        "<style>.used-inline { color: red; }</style>",
        "</head>",
        '<body><main class="used external"><h1>Hello</h1></main></body>',
        "</html>"
      ].join("")
    );
    await fs.writeFile(cssPath, ".external { color: blue; } #hero .missing span { color: green; }");

    const result = await provider.computeSelected(
      { absolutePath: htmlPath, relativePath: "index.html" },
      ["tag_count", "css_specificity", "unused_classes"]
    );

    expect(result.tag_count).toBe(7);
    expect(result.css_specificity).toBeCloseTo(43.667, 3);
    expect(result.unused_classes).toBe(2);
  });

  it("ignores missing linked stylesheets and returns zero selector metrics", async () => {
    const htmlPath = path.join(tempDir, "index.html");
    await fs.writeFile(
      htmlPath,
      '<html><head><link rel="stylesheet" href="missing.css"></head><body></body></html>'
    );

    await expect(
      provider.computeSelected({ absolutePath: htmlPath, relativePath: "index.html" }, [
        "css_specificity",
        "unused_classes"
      ])
    ).resolves.toEqual({
      css_specificity: 0,
      unused_classes: 0
    });
  });
});
