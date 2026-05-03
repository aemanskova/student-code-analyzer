import { z } from "zod"

export const loginValidationSchema = z.object({
  identifier: z.string().min(1, "Введите электронную почту или GitHub"),
  password: z.string().min(8, "Минимум 8 символов")
})

export const registerValidationSchema = z.object({
  name: z.string().trim().min(1, "Введите имя").max(120, "Слишком длинное имя"),
  surname: z.string().trim().min(1, "Введите фамилию").max(120, "Слишком длинная фамилия"),
  email: z.string().trim().min(1, "Введите email").pipe(z.email("Введите корректный email")),
  github: z.string().trim().max(100, "Слишком длинный GitHub"),
  password: z.string().min(8, "Минимум 8 символов")
})
