import { NavLink, Stack } from "@mantine/core"
import { NavLink as RouterNavLink } from "react-router"

type SidebarLink = {
  label: string
  to: string
}

type Props = {
  links: SidebarLink[]
}

export function Sidebar({ links }: Props) {
  return (
    <Stack gap="lg" h="100%">
      <Stack gap="xs">
        {links.map((link) => (
          <NavLink key={link.to} component={RouterNavLink} end label={link.label} to={link.to} />
        ))}
      </Stack>
    </Stack>
  )
}
