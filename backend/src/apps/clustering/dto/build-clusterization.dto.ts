import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, IsOptional, Min } from "class-validator";

export class BuildClusterizationDto {
  @ApiPropertyOptional({
    description:
      "Пользовательское значение eps для DBSCAN. Если не передано, eps рассчитывается автоматически.",
    minimum: Number.EPSILON
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(Number.EPSILON)
  eps?: number;
}
