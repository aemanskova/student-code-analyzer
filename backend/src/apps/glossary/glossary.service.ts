import { BadRequestException, Injectable } from "@nestjs/common";
import { GLOSSARY_METRICS_BY_SECTION, GLOSSARY_SECTIONS } from "./glossary.constants";
import { glossarySections, type GlossarySection } from "./glossary.types";

@Injectable()
export class GlossaryService {
  getSections() {
    return GLOSSARY_SECTIONS;
  }

  getMetrics(section: string) {
    const glossarySection = this.parseSection(section);

    return {
      section: glossarySection,
      metrics: GLOSSARY_METRICS_BY_SECTION[glossarySection]
    };
  }

  private parseSection(section: string): GlossarySection {
    if (glossarySections.includes(section as GlossarySection)) {
      return section as GlossarySection;
    }

    throw new BadRequestException("Unknown glossary section");
  }
}
