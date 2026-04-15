import { App } from "@app/App"
import { AnalysisPage } from "@pages/analysis"
import { ArchivePage } from "@pages/archive"
import { ArchiveDetailsPage } from "@pages/archive-details"
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
const ProtectedProfilePage = withProtection(ProfilePage)

export function Router() {
  return (
    <Routes>
      <Route path={routes.home} element={<App />}>
        <Route index element={<MainPage />} />
        <Route path={routes.login} element={<LoginPage />} />
        <Route path={routes.profile} element={<ProtectedProfilePage />} />
        <Route path={routes.analysis} element={<ProtectedAnalysisPage />} />
        <Route path={routes.archive} element={<ProtectedArchivePage />} />
        <Route path={routes.archiveDetails} element={<ProtectedArchiveDetailsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
