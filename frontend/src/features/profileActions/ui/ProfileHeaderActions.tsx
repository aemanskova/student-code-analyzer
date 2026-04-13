import { ActionIcon, Button, Group, Tooltip } from "@mantine/core"
import { routes } from "@shared/config"
import { useAuth, useAuthContext } from "@shared/lib"
import { NavLink } from "react-router"

export function ProfileHeaderActions() {
  const { isAuthenticated } = useAuth()
  const { logout } = useAuthContext()

  return (
    <Group gap="sm">
      {isAuthenticated && (
        <Tooltip label="Профиль">
          <ActionIcon
            aria-label="Открыть профиль"
            component={NavLink}
            size="lg"
            to={routes.profile}
            variant="light"
          >
            <svg
              aria-hidden="true"
              fill="none"
              height="18"
              viewBox="0 0 24 24"
              width="18"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
              <path
                d="M4 21C4 17.6863 7.58172 15 12 15C16.4183 15 20 17.6863 20 21"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </ActionIcon>
        </Tooltip>
      )}
      {!isAuthenticated && (
        <Button component={NavLink} to={routes.login} variant="light">
          Войти
        </Button>
      )}
      {isAuthenticated && (
        <Button disabled={!isAuthenticated} onClick={logout} variant="default">
          Выйти
        </Button>
      )}
    </Group>
  )
}
