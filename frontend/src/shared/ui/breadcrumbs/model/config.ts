import { routes } from "@shared/config/routes"
import type { Params } from "react-router"

export type BreadcrumbRule = {
  path: string
  hidden?: boolean
  label: string | ((params: Params<string>) => string)
}

export const BREADCRUMB_RULES: BreadcrumbRule[] = [
  {
    path: routes.login,
    hidden: true,
    label: "Вход"
  },
  {
    path: routes.analysis,
    label: "Анализ"
  },
  {
    path: routes.archive,
    label: "Архив"
  },
  {
    path: routes.archiveDetails,
    label: (params) => {
      const raw = String(params.encodedPath || "").trim()
      if (!raw) {
        return "Отчет"
      }
      try {
        return decodeURIComponent(raw)
      } catch {
        return raw
      }
    }
  },
  {
    path: routes.profile,
    label: "Профиль"
  }
]
