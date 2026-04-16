import { z } from "zod"

export const analysisSchema = z
  .object({
    archive: z.instanceof(File).nullable(),
    direction: z.enum(["html_css", "js"]),
    metrics: z.array(z.string()),
    recursive: z.boolean(),
    depth: z.number().int().min(1).optional(),
    includeGitMetrics: z.boolean()
  })
  .superRefine((value, ctx) => {
    if (!value.archive) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["archive"],
        message: "Загрузите zip-архив"
      })
    }

    if (value.recursive && !value.depth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["depth"],
        message: "Укажите глубину в рекурсивном режиме"
      })
    }
  })
