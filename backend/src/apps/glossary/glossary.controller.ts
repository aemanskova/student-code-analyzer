import { Controller, Get, Param } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { GlossaryService } from "./glossary.service";

@Controller("glossary")
@ApiTags("Glossary")
export class GlossaryController {
  constructor(private readonly glossaryService: GlossaryService) {}

  @Get("sections")
  @ApiOperation({ summary: "Получить список разделов глоссария" })
  getSections() {
    return this.glossaryService.getSections();
  }

  @Get(":section")
  @ApiOperation({ summary: "Получить метрики раздела глоссария" })
  @ApiParam({ name: "section", enum: ["html", "css", "git", "javascript", "typescript", "vue"] })
  getMetrics(@Param("section") section: string) {
    return this.glossaryService.getMetrics(section);
  }
}
