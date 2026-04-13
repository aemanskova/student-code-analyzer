import { z } from 'zod';

export const validationSchema = z.object({
  identifier: z.string().min(1, 'Введите электронную почту или GitHub'),
  password: z.string().min(8, 'Минимум 8 символов'),
});
