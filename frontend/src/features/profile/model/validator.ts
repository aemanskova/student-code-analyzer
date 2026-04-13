import { REQUIRED_RULE } from "@shared/lib/rules.ts"
import { z } from "zod"

export const validationSchema = z.object({
  name: z.string(REQUIRED_RULE).trim().min(1, "Введите имя").max(120, "Слишком длинное имя"),
  surname: z
    .string(REQUIRED_RULE)
    .trim()
    .min(1, "Введите фамилию")
    .max(120, "Слишком длинная фамилия"),
  email: z
    .string(REQUIRED_RULE)
    .nonempty(REQUIRED_RULE)
    .pipe(z.email({ message: "Введите корректный email" })),
  github: z.string().trim().max(100, "Слишком длинный GitHub")
})
