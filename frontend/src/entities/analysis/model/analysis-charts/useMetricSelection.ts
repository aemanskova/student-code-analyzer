import { useEffect, useMemo, useState } from "react"

import { ALL_METRICS_OPTION } from "./constants"

type Params = {
  availableMetrics: string[]
}

export const useMetricSelection = ({ availableMetrics }: Params) => {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([ALL_METRICS_OPTION])

  useEffect(() => {
    setSelectedMetrics((prev) => {
      if (prev.includes(ALL_METRICS_OPTION)) {
        return [ALL_METRICS_OPTION]
      }
      const filtered = prev.filter((metric) => availableMetrics.includes(metric))
      return filtered.length ? filtered : [ALL_METRICS_OPTION]
    })
  }, [availableMetrics])

  const metricOptions = useMemo(
    () => [
      { value: ALL_METRICS_OPTION, label: "Все метрики" },
      ...availableMetrics.map((metric) => ({ value: metric, label: metric }))
    ],
    [availableMetrics]
  )

  const metrics = useMemo(() => {
    if (selectedMetrics.includes(ALL_METRICS_OPTION)) {
      return availableMetrics
    }
    return selectedMetrics.filter((metric) => availableMetrics.includes(metric))
  }, [availableMetrics, selectedMetrics])

  const handleChange = (values: string[]) => {
    setSelectedMetrics((prev) => {
      const normalizedValues = values.filter(
        (value) => value === ALL_METRICS_OPTION || availableMetrics.includes(value)
      )
      if (!normalizedValues.length) {
        return [ALL_METRICS_OPTION]
      }

      const hadAllBefore = prev.includes(ALL_METRICS_OPTION)
      const hasAllNow = normalizedValues.includes(ALL_METRICS_OPTION)
      if (hasAllNow && normalizedValues.length === 1) {
        return [ALL_METRICS_OPTION]
      }
      if (hasAllNow && normalizedValues.length > 1) {
        return hadAllBefore
          ? normalizedValues.filter((value) => value !== ALL_METRICS_OPTION)
          : [ALL_METRICS_OPTION]
      }
      return normalizedValues
    })
  }

  return {
    handleChange,
    metrics,
    metricOptions,
    selectedMetrics
  }
}
