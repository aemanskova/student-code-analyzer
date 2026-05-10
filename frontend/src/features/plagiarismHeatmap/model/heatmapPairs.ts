import type { PlagiarismPair } from "@entities/analysis/api"

export const toShortPath = (value: string): string => {
  const normalized = String(value || "").replace(/\\/g, "/")
  const parts = normalized.split("/").filter(Boolean)
  const last = parts.pop() || normalized
  const prev = parts.pop()
  return prev ? `${prev}/${last}` : last
}

export const sortPairs = (pairs: PlagiarismPair[]): PlagiarismPair[] =>
  [...pairs]
    .filter((pair) => pair.comparedFiles > 0 && pair.avgSimilarity > 30)
    .sort((a, b) => b.avgSimilarity - a.avgSimilarity)
