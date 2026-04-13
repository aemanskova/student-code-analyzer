import { useAuth } from '@shared/lib/useAuth';
import type { ComponentType } from 'react';
import { Navigate } from 'react-router';

export const withProtection = <P extends object>(WrappedComponent: ComponentType<P>) => {
  const EnhancedComponent = (props: P) => {
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated)
      return (
        <Navigate
          replace={true}
          state={{
            fromUrl: location.pathname,
          }}
          to={'/login'}
        />
      );

    return <WrappedComponent {...props} />;
  };

  EnhancedComponent.displayName = `withProtection${WrappedComponent.displayName}`;

  return EnhancedComponent;
};
