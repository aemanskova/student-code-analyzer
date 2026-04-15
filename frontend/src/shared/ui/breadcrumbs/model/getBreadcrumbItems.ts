import type { Params } from "react-router"
import { matchPath } from "react-router"

import { BREADCRUMB_RULES } from "./config"

type BreadcrumbItem = {
  href: string
  label: string
}

const toPathnameSlices = (pathname: string): string[] => {
  const segments = pathname.split("/").filter(Boolean)
  if (!segments.length) {
    return ["/"]
  }
  return segments.map((_, index) => `/${segments.slice(0, index + 1).join("/")}`)
}

const getRuleForPath = (pathname: string): { label: string; hidden?: boolean } | null => {
  for (const rule of BREADCRUMB_RULES) {
    const match = matchPath({ path: rule.path, end: true }, pathname)
    if (!match) {
      continue
    }

    const label =
      typeof rule.label === "function" ? rule.label(match.params as Params<string>) : rule.label
    return {
      label,
      hidden: rule.hidden
    }
  }

  return null
}

export const getBreadcrumbItems = (pathname: string): BreadcrumbItem[] => {
  const pathSlices = toPathnameSlices(pathname)

  return pathSlices
    .map((slicePath) => {
      const matched = getRuleForPath(slicePath)
      if (!matched || matched.hidden) {
        return null
      }
      return {
        href: slicePath,
        label: matched.label
      }
    })
    .filter((item): item is BreadcrumbItem => Boolean(item))
}
