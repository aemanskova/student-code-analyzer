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
  clusterizing: "/clusterizing",
  clusterizingCreate: "/clusterizing/create",
  clusterizingDetailsPath: "/clusterizing/:jobId",
  clusterizingDetails: (jobId: string) => `/clusterizing/${encodeURIComponent(jobId)}`,
  glossary: "/glossary",
  login: "/login",
  profile: "/profile"
} as const
