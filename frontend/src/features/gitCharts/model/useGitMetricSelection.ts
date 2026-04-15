import { useEffect, useMemo, useState } from "react"

import { ALL_GIT_METRICS_OPTION, GIT_METRIC_OPTIONS } from "./constants"

type Params = {
  availableMetrics: string[]
}

export const useGitMetricSelection = ({ availableMetrics }: Params) => {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([ALL_GIT_METRICS_OPTION])

  useEffect(() => {
    setSelectedMetrics((prev) => {
      if (prev.includes(ALL_GIT_METRICS_OPTION)) {
        return [ALL_GIT_METRICS_OPTION]
      }
      const filtered = prev.filter((metric) => availableMetrics.includes(metric))
      return filtered.length ? filtered : [ALL_GIT_METRICS_OPTION]
    })
  }, [availableMetrics])

  const metricOptions = useMemo(
    () =>
      GIT_METRIC_OPTIONS.filter(
        (option) =>
          option.value === ALL_GIT_METRICS_OPTION || availableMetrics.includes(option.value)
      ),
    [availableMetrics]
  )

  const selectedMetricSet = useMemo(() => {
    const values = selectedMetrics.includes(ALL_GIT_METRICS_OPTION)
      ? availableMetrics
      : selectedMetrics
    return new Set(values)
  }, [availableMetrics, selectedMetrics])

  const handleChange = (values: string[]) => {
    const normalizedValues = values.filter(
      (value) => value === ALL_GIT_METRICS_OPTION || availableMetrics.includes(value)
    )
    if (!normalizedValues.length) {
      setSelectedMetrics([ALL_GIT_METRICS_OPTION])
      return
    }

    const hadAllBefore = selectedMetrics.includes(ALL_GIT_METRICS_OPTION)
    const hasAllNow = normalizedValues.includes(ALL_GIT_METRICS_OPTION)
    if (hasAllNow && normalizedValues.length === 1) {
      setSelectedMetrics([ALL_GIT_METRICS_OPTION])
      return
    }
    if (hasAllNow && normalizedValues.length > 1) {
      setSelectedMetrics(
        hadAllBefore
          ? normalizedValues.filter((value) => value !== ALL_GIT_METRICS_OPTION)
          : [ALL_GIT_METRICS_OPTION]
      )
      return
    }
    setSelectedMetrics(normalizedValues)
  }

  return {
    handleChange,
    metricOptions,
    selectedMetricSet,
    selectedMetrics
  }
}
