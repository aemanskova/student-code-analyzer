import { Module } from "@nestjs/common";
import { PathParserService } from "./path-parser.service";

@Module({
  providers: [PathParserService],
  exports: [PathParserService]
})
export class PathParserModule {}
