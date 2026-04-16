import { withProviders } from "@app/providers"
import { sidebarLinks } from "@app/routing"
import { ProfileHeaderActions } from "@features/profileActions"
import { AppShell, Box, Burger, Group } from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import { AppBreadcrumbs } from "@shared/ui"
import { Sidebar } from "@widgets/sidebar"
import { Outlet } from "react-router"

export const App = withProviders(() => {
  const [opened, { toggle }] = useDisclosure()

  return (
    <AppShell
      header={{ height: 64 }}
      padding="md"
      navbar={{ width: 260, breakpoint: "sm", collapsed: { mobile: !opened, desktop: !opened } }}
    >
      <AppShell.Header px="md">
        <Group h="100%" justify="space-between">
          <Group gap="md">
            <Burger opened={opened} onClick={toggle} size="sm" />
            {/*<Text component={NavLink} fw={700} to={routes.home} td="none" c="inherit">*/}
            {/*  Инструмент для анализа кода студенческих работ*/}
            {/*</Text>*/}
          </Group>
          <ProfileHeaderActions />
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md">
        <Sidebar links={sidebarLinks} />
      </AppShell.Navbar>
      <AppShell.Main>
        <Box mb="sm">
          <AppBreadcrumbs />
        </Box>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
})
