import { Anchor, Breadcrumbs, Group, Text } from "@mantine/core"
import { useMemo } from "react"
import { NavLink, useLocation } from "react-router"

import { getBreadcrumbItems } from "../model/getBreadcrumbItems"

export const AppBreadcrumbs = () => {
  const location = useLocation()

  const items = useMemo(() => getBreadcrumbItems(location.pathname), [location.pathname])

  if (!items.length) {
    return null
  }

  const links = items.map((item, index) => {
    const isLast = index === items.length - 1

    if (isLast) {
      return (
        <Text c="dimmed" fw={600} key={item.href} size="sm">
          {item.label}
        </Text>
      )
    }

    return (
      <Anchor c="myColor.6" component={NavLink} fw={500} key={item.href} size="sm" to={item.href}>
        {item.label}
      </Anchor>
    )
  })

  return (
    <Group gap="md" wrap="nowrap">
      <Breadcrumbs separator="/">{links}</Breadcrumbs>
    </Group>
  )
}
