import type { Direction } from "@entities/analysis/api"
import { ANALYSIS_DIRECTION_OPTIONS } from "@entities/analysis/model/direction"

export const PAGE_SIZE = 8

export const DIRECTION_OPTIONS: Array<{ value: Direction; label: string }> =
  ANALYSIS_DIRECTION_OPTIONS
