import type { AuthContextModel } from '@shared/model';
import { createContext, useContext } from 'react';

export const EMPTY_AUTH_INFO = {
  accessToken: '',
};

export const AuthContext = createContext<AuthContextModel>({
  ...EMPTY_AUTH_INFO,
  login: () => {},
  logout: () => {},
});

export const useAuthContext = () => {
  const authInfo = useContext(AuthContext);
  if (!authInfo) {
    throw new Error('Хук useAuthContext должен использоваться внутри провайдера авторизации');
  }
  return authInfo;
};
