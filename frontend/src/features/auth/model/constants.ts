import type { LoginFormValues, RegisterFormValues } from "./types"

export const LOGIN_DEFAULT_VALUES: LoginFormValues = {
  identifier: "",
  password: ""
}

export const REGISTER_DEFAULT_VALUES: RegisterFormValues = {
  name: "",
  surname: "",
  email: "",
  github: "",
  password: ""
}
