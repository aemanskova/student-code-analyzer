import type { ComponentType } from "react"

type Enhancer = (component: ComponentType) => ComponentType

export const compose =
  (...enhancers: Enhancer[]) =>
  (component: ComponentType): ComponentType =>
    enhancers.reduceRight<ComponentType>((acc, enhancer) => enhancer(acc), component)
