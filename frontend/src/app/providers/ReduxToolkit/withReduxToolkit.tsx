import { store } from '@app/store';
import type { ComponentType } from 'react';
import { Provider } from 'react-redux';

export const withReduxToolkit = (WrappedComponent: ComponentType) => () => (
  <Provider store={store}>
    <WrappedComponent />
  </Provider>
);
