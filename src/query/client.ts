import { QueryClient } from '@tanstack/vue-query'

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        refetchIntervalInBackground: false,
        retry: false,
      },
    },
  })
}
