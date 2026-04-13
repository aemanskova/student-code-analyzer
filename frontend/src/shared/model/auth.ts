export type AuthInfo = {
  accessToken: string;
};

export type AuthContextModel = AuthInfo & {
  login: (accessToken: string) => void;
  logout: VoidFunction;
};
