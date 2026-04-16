export type NounForms = [one: string, few: string, many: string]

export const getRussianNounForm = (value: number, forms: NounForms): string => {
  const absValue = Math.abs(Math.trunc(value))
  const mod10 = absValue % 10
  const mod100 = absValue % 100

  if (mod10 === 1 && mod100 !== 11) {
    return forms[0]
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return forms[1]
  }
  return forms[2]
}

export const formatCountWithRussianNoun = (value: number, forms: NounForms): string =>
  `${value} ${getRussianNounForm(value, forms)}`
