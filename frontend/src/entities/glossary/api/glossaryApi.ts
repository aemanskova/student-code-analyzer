import { baseApi } from "@shared/api/baseApi"

import type { GlossaryMetricsResponse, GlossarySectionInfo, GlossarySectionKey } from "./types"

const glossaryTag = { type: "Glossary" as const, id: "LIST" }

export const glossaryApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getGlossarySections: build.query<GlossarySectionInfo[], void>({
      query: () => ({
        url: "/glossary/sections",
        method: "GET"
      }),
      providesTags: [glossaryTag]
    }),
    getGlossaryMetrics: build.query<GlossaryMetricsResponse, GlossarySectionKey>({
      query: (section) => ({
        url: `/glossary/${encodeURIComponent(section)}`,
        method: "GET"
      }),
      providesTags: (_result, _error, section) => [{ type: "Glossary", id: section }]
    })
  })
})

export const { useGetGlossaryMetricsQuery, useGetGlossarySectionsQuery } = glossaryApi
