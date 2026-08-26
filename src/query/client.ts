import { QueryCache, QueryClient } from '@tanstack/vue-query'
import { AppApiError } from '@/api/errors'

export function createAppQueryClient(options?: { onUnauthorized?: () => void }): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError(error) {
        if (error instanceof AppApiError && error.kind === 'unauthorized') {
          options?.onUnauthorized?.()
        }
      },
    }),
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
