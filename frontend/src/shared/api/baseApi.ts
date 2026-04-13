import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { ACCESS_TOKEN_KEY } from '@shared/api/auth';
import { loadFromLS } from '@shared/lib';

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
    prepareHeaders: (headers: Headers) => {
      const token = loadFromLS<string>({ key: ACCESS_TOKEN_KEY });
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['ArchiveResults'],
  endpoints: () => ({}),
});
