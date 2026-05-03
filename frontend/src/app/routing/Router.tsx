import { App } from "@app/App"
import { AnalysisPage } from "@pages/analysis"
import { ArchivePage } from "@pages/archive"
import { ArchiveDetailsPage } from "@pages/archive-details"
import { ClusterizingPage } from "@pages/clusterizing"
import { ClusterizingCreatePage } from "@pages/clusterizing-create"
import { ClusterizingDetailsPage } from "@pages/clusterizing-details"
import { GlossaryPage } from "@pages/glossary"
import { HeatmapPage } from "@pages/heatmap"
import { HeatmapBuildPage } from "@pages/heatmap-build"
import { HeatmapDetailsPage } from "@pages/heatmap-details"
import { LoginPage } from "@pages/login"
import { MainPage } from "@pages/main"
import { NotFoundPage } from "@pages/not-found"
import { ProfilePage } from "@pages/profile"
import { routes } from "@shared/config/routes"
import { withProtection } from "@shared/lib"
import { Route, Routes } from "react-router"

const ProtectedAnalysisPage = withProtection(AnalysisPage)
const ProtectedArchivePage = withProtection(ArchivePage)
const ProtectedArchiveDetailsPage = withProtection(ArchiveDetailsPage)
const ProtectedHeatmapPage = withProtection(HeatmapPage)
const ProtectedHeatmapBuildPage = withProtection(HeatmapBuildPage)
const ProtectedHeatmapDetailsPage = withProtection(HeatmapDetailsPage)
const ProtectedClusterizingPage = withProtection(ClusterizingPage)
const ProtectedClusterizingCreatePage = withProtection(ClusterizingCreatePage)
const ProtectedClusterizingDetailsPage = withProtection(ClusterizingDetailsPage)
const ProtectedGlossaryPage = withProtection(GlossaryPage)
const ProtectedProfilePage = withProtection(ProfilePage)

export function Router() {
  return (
    <Routes>
      <Route path={routes.home} element={<App />}>
        <Route index element={<MainPage />} />
        <Route path={routes.login} element={<LoginPage />} />
        <Route path={routes.profile} element={<ProtectedProfilePage />} />
        <Route path={routes.analysis} element={<ProtectedAnalysisPage />} />
        <Route path={routes.analysisLegacy} element={<ProtectedAnalysisPage />} />
        <Route path={routes.archive} element={<ProtectedArchivePage />} />
        <Route path={routes.archiveLegacy} element={<ProtectedArchivePage />} />
        <Route path={routes.archiveDetails} element={<ProtectedArchiveDetailsPage />} />
        <Route path={routes.archiveDetailsLegacy} element={<ProtectedArchiveDetailsPage />} />
        <Route path={routes.heatmap} element={<ProtectedHeatmapPage />} />
        <Route path={routes.heatmapBuild} element={<ProtectedHeatmapBuildPage />} />
        <Route path={routes.heatmapDetailsFallbackPath} element={<ProtectedHeatmapDetailsPage />} />
        <Route path={routes.heatmapDetailsPath} element={<ProtectedHeatmapDetailsPage />} />
        <Route path={routes.clusterizing} element={<ProtectedClusterizingPage />} />
        <Route path={routes.clusterizingCreate} element={<ProtectedClusterizingCreatePage />} />
        <Route
          path={routes.clusterizingDetailsPath}
          element={<ProtectedClusterizingDetailsPage />}
        />
        <Route path={routes.glossary} element={<ProtectedGlossaryPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
