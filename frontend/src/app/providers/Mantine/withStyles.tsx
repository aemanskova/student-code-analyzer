import { createTheme, type MantineColorsTuple, MantineProvider } from "@mantine/core"
import type { ComponentType } from "react"
import { Notifications } from "@mantine/notifications"
import "@mantine/core/styles.css"
import "@mantine/charts/styles.css"
import "@mantine/notifications/styles.css"

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
  primaryColor: "myColor"
})

export const withStyles = (WrappedComponent: ComponentType) => () => (
  <MantineProvider theme={theme}>
    <Notifications />
    <WrappedComponent />
  </MantineProvider>
)
