import type { CSSProperties } from "react"

export const CELL_STYLE: CSSProperties = {
  borderBottom: "1px solid var(--mantine-color-default-border)",
  color: "inherit",
  overflowWrap: "anywhere",
  padding: "10px 12px",
  textAlign: "left",
  verticalAlign: "top"
}

export const HEAD_CELL_STYLE: CSSProperties = {
  ...CELL_STYLE,
  background: "var(--mantine-color-body)",
  fontWeight: 600
}
