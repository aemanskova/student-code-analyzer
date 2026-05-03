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
    label: "Новый анализ"
  },
  {
    path: routes.archive,
    label: "Анализ"
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
    path: routes.analysisMetricChartPath,
    label: "График метрики"
  },
  {
    path: routes.archiveLegacy,
    label: "Анализ"
  },
  {
    path: routes.archiveDetailsLegacy,
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
    path: routes.heatmap,
    label: "Тепловые карты"
  },
  {
    path: routes.heatmapBuild,
    label: "Построение"
  },
  {
    path: routes.heatmapDetailsPath,
    label: (params) => {
      const raw = String(params.encodedFolder || "").trim()
      if (!raw) {
        return "Карта"
      }
      try {
        return decodeURIComponent(raw)
      } catch {
        return raw
      }
    }
  },
  {
    path: routes.heatmapDetailsFallbackPath,
    hidden: true,
    label: "Карта"
  },
  {
    path: routes.clusterizing,
    label: "Кластеризация"
  },
  {
    path: routes.clusterizingCreate,
    label: "Новая кластеризация"
  },
  {
    path: routes.clusterizingDetailsPath,
    label: "Результат"
  },
  {
    path: routes.clusterizingMetricChartPath,
    label: "График метрики"
  },
  {
    path: routes.glossary,
    label: "Глоссарий"
  },
  {
    path: routes.profile,
    label: "Профиль"
  }
]
