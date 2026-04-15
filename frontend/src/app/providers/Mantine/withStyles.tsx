import "@mantine/core/styles.css"
import "@mantine/charts/styles.css"
import "@mantine/notifications/styles.css"
import "@mantine/dates/styles.css"
import "dayjs/locale/ru"

import { createTheme, type MantineColorsTuple, MantineProvider } from "@mantine/core"
import { DatesProvider } from "@mantine/dates"
import { Notifications } from "@mantine/notifications"
import type { ComponentType } from "react"

const myColor: MantineColorsTuple = [
  "#f6f4f4",
  "#e7e7e7",
  "#cccccc",
  "#b0b0b0",
  "#9a9897",
  "#8e8987",
  "#88817e",
  "#766e6b",
  "#6b615e",
  "#3b3330"
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
    Grid: {
      defaultProps: {
        gutter: "md"
      }
    }
  }
})

export const withStyles = (WrappedComponent: ComponentType) => () => (
  <MantineProvider theme={theme}>
    <DatesProvider settings={{ locale: "ru", firstDayOfWeek: 1 }}>
      <Notifications />
      <WrappedComponent />
    </DatesProvider>
  </MantineProvider>
)
