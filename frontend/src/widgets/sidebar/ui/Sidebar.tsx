import { NavLink, Stack } from "@mantine/core"
import { NavLink as RouterNavLink, useLocation } from "react-router"

type SidebarLink = {
  label: string
  to: string
}

type Props = {
  links: SidebarLink[]
}

export function Sidebar({ links }: Props) {
  const location = useLocation()
  const pathname = location.pathname || "/"

  const isActivePath = (to: string): boolean => {
    if (to === "/") {
      return pathname === "/"
    }
    return pathname === to || pathname.startsWith(to)
  }

  return (
    <Stack h="100%">
      <Stack gap="md">
        {links.map((link) => (
          <NavLink
            active={isActivePath(link.to)}
            key={link.to}
            component={RouterNavLink}
            label={link.label}
            styles={{
              root: {
                border: "none",
                borderRadius: 10
              }
            }}
            to={link.to}
            variant="subtle"
          />
        ))}
      </Stack>
    </Stack>
  )
}
