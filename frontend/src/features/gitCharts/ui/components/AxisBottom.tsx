import { AXIS_COLOR, LABEL_COLOR } from "../../model/constants"
import { formatNumber } from "../../model/utils"

type Props = {
  ticks: number[]
  y: number
  x: (value: number) => number
  width: number
  labelFormatter?: (value: number) => string
}

export const AxisBottom = ({ ticks, y, x, width, labelFormatter }: Props) => (
  <g>
    <line x1={0} x2={width} y1={y} y2={y} stroke={AXIS_COLOR} strokeWidth={1} />
    {ticks.map((tick) => (
      <g key={tick} transform={`translate(${x(tick)}, ${y})`}>
        <line y2={6} stroke={AXIS_COLOR} strokeWidth={1} />
        <text dy="1.4em" fill={LABEL_COLOR} fontSize={11} textAnchor="middle">
          {labelFormatter ? labelFormatter(tick) : formatNumber(tick)}
        </text>
      </g>
    ))}
  </g>
)
