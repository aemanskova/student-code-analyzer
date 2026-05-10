import { BadRequestException } from "@nestjs/common";
import { GLOSSARY_METRICS_BY_SECTION, GLOSSARY_SECTIONS } from "./glossary.constants";
import { GlossaryService } from "./glossary.service";

describe("GlossaryService", () => {
  const service = new GlossaryService();

  it("returns all glossary sections", () => {
    expect(service.getSections()).toBe(GLOSSARY_SECTIONS);
  });

  it("returns metrics for a known section", () => {
    expect(service.getMetrics("html")).toEqual({
      section: "html",
      metrics: GLOSSARY_METRICS_BY_SECTION.html
    });
  });

  it("rejects unknown sections", () => {
    expect(() => service.getMetrics("unknown")).toThrow(BadRequestException);
  });
});
