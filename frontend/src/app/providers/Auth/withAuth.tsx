import { ACCESS_TOKEN_KEY } from '@shared/api/auth';
import { AuthContext, clearLS, loadFromLS, saveToLocaleStorage } from '@shared/lib';
import { EMPTY_AUTH_INFO } from '@shared/lib/authContext';
import type { AuthContextModel, AuthInfo } from '@shared/model';
import { type ComponentType, useCallback, useMemo, useState } from 'react';

export const withAuth = (WrappedComponent: ComponentType) => () => {
  const [authInfo, setAuthInfo] = useState<AuthInfo>(() => {
    const accessToken = loadFromLS<string>({
      key: ACCESS_TOKEN_KEY,
    });

    return { accessToken: accessToken || '' };
  });

  const login = useCallback(async (accessToken: string) => {
    setAuthInfo({ accessToken });
    saveToLocaleStorage({
      key: ACCESS_TOKEN_KEY,
      state: accessToken,
    });
  }, []);

  const logout = useCallback(() => {
    setAuthInfo(EMPTY_AUTH_INFO);
    clearLS({ key: ACCESS_TOKEN_KEY });
  }, []);

  const contextValue: AuthContextModel = useMemo(
    () => ({
      ...authInfo,
      login,
      logout,
    }),
    [authInfo, login, logout],
  );

  return (
    <AuthContext.Provider value={contextValue}>
      <WrappedComponent />
    </AuthContext.Provider>
  );
};
