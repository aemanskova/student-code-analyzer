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
    <Stack h="100%">
      <Stack gap="md">
        {links.map((link) => (
          <NavLink
            key={link.to}
            component={RouterNavLink}
            end
            label={link.label}
            styles={{
              root: {
                border: "none",
                borderRadius: 10,
                color: "inherit"
              },
              label: {
                color: "inherit"
              },
              section: {
                color: "inherit"
              }
            }}
            sx={{
              "&[data-active]": {
                color: "inherit"
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
