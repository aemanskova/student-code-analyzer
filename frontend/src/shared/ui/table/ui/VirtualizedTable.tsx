import { forwardRef, type ReactNode } from "react"
import { TableVirtuoso } from "react-virtuoso"

import { CELL_STYLE, HEAD_CELL_STYLE } from "../model/styles"

export type VirtualizedColumn<T> = {
  key: string
  title: string
  minWidth?: number
  render: (row: T, index: number) => ReactNode
}

type Props<T> = {
  data: T[]
  columns: Array<VirtualizedColumn<T>>
  getRowKey: (row: T, index: number) => string
  maxHeight: number
  minTableWidth?: number
  fullWidth?: boolean
  disableVerticalScroll?: boolean
  rowHeight?: number
  overscan?: number
}

export function VirtualizedTable<T>({
  data,
  columns,
  getRowKey,
  maxHeight,
  minTableWidth,
  fullWidth = false,
  disableVerticalScroll = false,
  rowHeight = 42,
  overscan = 120
}: Props<T>) {
  const headerHeight = 42
  const tableHeight = Math.min(maxHeight, headerHeight + data.length * rowHeight)
  const computedMinWidth =
    minTableWidth || columns.reduce((sum, column) => sum + (column.minWidth || 140), 0)

  const Scroller = forwardRef<HTMLDivElement, React.ComponentProps<"div">>((props, ref) => (
    <div
      {...props}
      ref={ref}
      style={{
        ...props.style,
        overflowX: "auto",
        overflowY: disableVerticalScroll ? "hidden" : "auto"
      }}
    />
  ))
  Scroller.displayName = "VirtuosoScroller"

  const Table = (props: React.ComponentProps<"table">) => (
    <table
      {...props}
      style={{
        ...props.style,
        borderCollapse: "separate",
        borderSpacing: 0,
        minWidth: fullWidth ? undefined : computedMinWidth,
        tableLayout: fullWidth ? "auto" : "fixed",
        width: fullWidth ? "100%" : "max-content"
      }}
    />
  )

  return (
    <div style={{ overflowX: "auto", width: "100%" }}>
      <TableVirtuoso
        components={{
          Scroller,
          Table
        }}
        computeItemKey={(index, row) => getRowKey(row, index)}
        data={data}
        defaultItemHeight={rowHeight}
        fixedHeaderContent={() => (
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{
                  ...HEAD_CELL_STYLE,
                  minWidth: column.minWidth || 140,
                  ...(fullWidth ? {} : { width: column.minWidth || 140 })
                }}
              >
                {column.title}
              </th>
            ))}
          </tr>
        )}
        itemContent={(index, row) =>
          columns.map((column) => (
            <td
              key={column.key}
              style={{
                ...CELL_STYLE,
                minWidth: column.minWidth || 140,
                ...(fullWidth ? {} : { width: column.minWidth || 140 })
              }}
            >
              {column.render(row, index)}
            </td>
          ))
        }
        overscan={overscan}
        style={{ height: tableHeight }}
      />
    </div>
  )
}
