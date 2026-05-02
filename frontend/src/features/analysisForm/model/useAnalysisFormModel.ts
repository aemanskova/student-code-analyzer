import { useRunS3AsyncMutation } from "@entities/analysis/api"
import type { UploadedArchiveInfo } from "@features/archiveUpload"
import { zodResolver } from "@hookform/resolvers/zod"
import { getApiErrorMessage } from "@shared/lib"
import { useState } from "react"
import { useForm } from "react-hook-form"

import type { AnalysisFormValues, AnalysisRunResult } from "./types"
import { analysisSchema } from "./validator"

type Params = {
  onSuccess: (result: AnalysisRunResult) => void
}

export const useAnalysisFormModel = ({ onSuccess }: Params) => {
  const [runS3Async, { isLoading: isAnalyzing, error: analyzeError, reset: resetAnalyzeError }] =
    useRunS3AsyncMutation()
  const [uploadedArchive, setUploadedArchive] = useState<UploadedArchiveInfo | null>(null)
  const [runFormError, setRunFormError] = useState<string | null>(null)

  const form = useForm<AnalysisFormValues>({
    resolver: zodResolver(analysisSchema),
    mode: "onBlur",
    defaultValues: {
      archive: null,
      direction: "html_css",
      metrics: [],
      recursive: false,
      depth: undefined,
      includeGitMetrics: true
    }
  })

  const onSubmit = form.handleSubmit(async (values) => {
    if (!uploadedArchive || isAnalyzing) {
      setRunFormError("Сначала загрузите архив в хранилище.")
      return
    }

    setRunFormError(null)
    try {
      const request = {
        key: uploadedArchive.key,
        direction: values.direction,
        metrics: values.metrics.length > 0 ? values.metrics : undefined,
        r: values.recursive,
        depth: values.recursive ? values.depth : undefined,
        includeGitMetrics: values.includeGitMetrics,
        includePlagiarismHeatmap: false
      }
      const response = await runS3Async(request).unwrap()
      onSuccess({ response, request })
    } catch (error) {
      setRunFormError(getApiErrorMessage(error, "Не удалось запустить анализ. Повторите попытку."))
    }
  })

  return {
    analyzeError,
    form,
    isAnalyzing,
    onSubmit,
    runFormError,
    resetAnalyzeError,
    setRunFormError,
    setUploadedArchive,
    uploadedArchive
  }
}
