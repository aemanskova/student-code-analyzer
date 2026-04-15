import "@mantine/core/styles.css"
import "@mantine/charts/styles.css"
import "@mantine/notifications/styles.css"
import "@mantine/dates/styles.css"
import "dayjs/locale/ru"

import {
  createTheme,
  localStorageColorSchemeManager,
  type MantineColorsTuple,
  MantineProvider
} from "@mantine/core"
import { DatesProvider } from "@mantine/dates"
import { Notifications } from "@mantine/notifications"
import type { ComponentType } from "react"

const myColor: MantineColorsTuple = [
  "#f1f4fe",
  "#e4e6ed",
  "#c8cad3",
  "#a9adb9",
  "#9094a3",
  "#7f8496",
  "#777c91",
  "#63687c",
  "#595e72",
  "#4a5167"
]

const theme = createTheme({
  colors: {
    myColor
  },
  primaryColor: "myColor",
  defaultRadius: "md",
  components: {
    Card: {
      defaultProps: {
        p: "md",
        radius: "md"
      }
    },
    Stack: {
      defaultProps: {
        gap: "md"
      }
    },
    Group: {
      defaultProps: {
        gap: "md"
      }
    },
    Grid: {
      defaultProps: {
        gutter: "md"
      }
    }
  }
})

export const withStyles = (WrappedComponent: ComponentType) => () => (
  <MantineProvider
    colorSchemeManager={localStorageColorSchemeManager({ key: "mantine-color-scheme" })}
    defaultColorScheme="light"
    theme={theme}
  >
    <DatesProvider settings={{ locale: "ru", firstDayOfWeek: 1 }}>
      <Notifications />
      <WrappedComponent />
    </DatesProvider>
  </MantineProvider>
)
