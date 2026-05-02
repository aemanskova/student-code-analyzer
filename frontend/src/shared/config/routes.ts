export const routes = {
  home: "/",
  analysis: "/analysis/new",
  analysisLegacy: "/archive/new",
  archive: "/analysis",
  archiveLegacy: "/archive",
  archiveDetails: "/analysis/:encodedPath",
  archiveDetailsLegacy: "/archive/:encodedPath",
  heatmap: "/heatmap",
  heatmapBuild: "/heatmap/build",
  heatmapDetailsPath: "/heatmap/:jobId/:encodedFolder",
  heatmapDetailsFallbackPath: "/heatmap/:jobId",
  heatmapDetails: (jobId: string, folder?: string) =>
    folder
      ? `/heatmap/${encodeURIComponent(jobId)}/${encodeURIComponent(folder)}`
      : `/heatmap/${encodeURIComponent(jobId)}`,
  login: "/login",
  profile: "/profile"
} as const
