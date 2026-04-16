import type { GitAnalysisRow } from "@entities/analysis/api"
import { buildCsv } from "@shared/lib"

const GIT_HEADERS = [
  "path",
  "branch",
  "hash",
  "date",
  "message",
  "author",
  "filename",
  "filetype",
  "extraMetadata",
  "changes",
  "added",
  "deleted"
]

export const toGitCsv = (rows: GitAnalysisRow[]): string => {
  const dataRows = rows.map((row) => [
    row.path,
    row.branch,
    row.hash,
    row.date,
    row.message,
    row.author,
    row.filename,
    row.filetype,
    row.extraMetadata,
    row.changes,
    String(row.added),
    String(row.deleted)
  ])
  return buildCsv(GIT_HEADERS, dataRows)
}
