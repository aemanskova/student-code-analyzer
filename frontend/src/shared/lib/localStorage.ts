import { hasOwnProperty, isPlainObject } from "./common"

interface SaveToLS {
  state: unknown
  key: string
  subTitle?: string
}

export const saveToLocaleStorage = ({ state, key, subTitle }: SaveToLS): void => {
  try {
    if (subTitle) {
      const prevDataByKey = loadFromLS<Record<string, unknown>>({ key })
      const newData = {
        ...prevDataByKey,
        [subTitle]: state
      }
      localStorage.setItem(key, JSON.stringify(newData))
      return
    }

    localStorage.setItem(key, JSON.stringify(state))
  } catch (err) {
    console.error(err)
  }
}

interface LoadFromLS {
  key: string
  subTitle?: string
}

export const loadFromLS = <T>({ key, subTitle }: LoadFromLS): T | undefined => {
  try {
    const serializedState = localStorage.getItem(key)
    if (!serializedState) {
      return undefined
    }

    const parsed = JSON.parse(serializedState)
    if (!subTitle) {
      return parsed
    }

    return isPlainObject(parsed) && hasOwnProperty(parsed, subTitle)
      ? (parsed[subTitle] as T)
      : undefined
  } catch (err) {
    console.error(err)
    return undefined
  }
}

interface ClearLS {
  key: string
  subTitle?: string
}

export const clearLS = ({ key, subTitle }: ClearLS): void => {
  try {
    const serializedState = localStorage.getItem(key)
    if (!serializedState) {
      return
    }

    if (!subTitle) {
      localStorage.removeItem(key)
      return
    }

    const parsed = JSON.parse(serializedState)
    if (isPlainObject(parsed) && hasOwnProperty(parsed, subTitle)) {
      delete parsed[subTitle]
      saveToLocaleStorage({ key, state: parsed })
    }
  } catch (err) {
    console.error(err)
  }
}
