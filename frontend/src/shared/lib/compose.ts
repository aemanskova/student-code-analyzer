import type { ComponentType } from 'react';

type Enhancer = (component: ComponentType<any>) => ComponentType<any>;

export const compose =
  (...enhancers: Enhancer[]) =>
  (component: ComponentType<any>): ComponentType<any> =>
    enhancers.reduceRight<ComponentType<any>>((acc, enhancer) => enhancer(acc), component);
