import type { CSSProperties } from "react"

export const CELL_STYLE: CSSProperties = {
  borderBottom: "1px solid var(--mantine-color-gray-3)",
  overflowWrap: "anywhere",
  padding: "10px 12px",
  textAlign: "left",
  verticalAlign: "top"
}

export const HEAD_CELL_STYLE: CSSProperties = {
  ...CELL_STYLE,
  background: "var(--mantine-color-gray-0)",
  fontWeight: 600
}
