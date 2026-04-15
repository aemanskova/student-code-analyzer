import { ActionIcon, Button, Group, Tooltip, useMantineColorScheme } from "@mantine/core"
import { routes } from "@shared/config"
import { useAuth, useAuthContext } from "@shared/lib"
import { NavLink } from "react-router"

export function ProfileHeaderActions() {
  const { isAuthenticated } = useAuth()
  const { logout } = useAuthContext()
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const isDark = colorScheme === "dark"
  const toggleColorScheme = () => setColorScheme(isDark ? "light" : "dark")

  return (
    <Group gap="md">
      <Tooltip label={isDark ? "Светлая тема" : "Тёмная тема"}>
        <ActionIcon
          aria-label={isDark ? "Включить светлую тему" : "Включить тёмную тему"}
          onClick={toggleColorScheme}
          size="lg"
          variant="light"
        >
          {isDark ? (
            <svg
              aria-hidden="true"
              fill="none"
              height="18"
              viewBox="0 0 24 24"
              width="18"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M12 2V4M12 20V22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M2 12H4M20 12H22M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.8"
              />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              fill="none"
              height="18"
              viewBox="0 0 24 24"
              width="18"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M21 14.2A9 9 0 1 1 9.8 3a7 7 0 1 0 11.2 11.2Z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          )}
        </ActionIcon>
      </Tooltip>
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
